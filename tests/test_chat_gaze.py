"""Track visible iris paint in the shipped WebPs, independently of the art generator."""
import unittest
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    np = None


ART = Path(__file__).resolve().parents[1] / "runtime/codex-mobile/avatar"
EXPRESSIONS = (
    "warm", "joy", "laugh", "curious", "surprised", "sly", "thinking", "skeptical",
    "shy", "pout", "confident", "sad", "excited", "blink", "wink", "annoyed",
    "tired", "relieved", "confused", "glance",
)
# Two independent landmarks per eye: the specular highlight above the dark pupil
# and the golden paint in the lower iris. Their resting positions belong to the
# original drawing; the face isn't mirror-symmetric.
LANDMARKS = (
    ((101, 92, 120, 108), (278, 86, 295, 101)),
    ((103, 111, 120, 130), (281, 108, 299, 126)),
)


def load_frames(path):
    with Image.open(path) as atlas:
        if atlas.size != (1600, 852):
            raise AssertionError(f"Unexpected cel grid: {path}")
        rgb = np.asarray(atlas.convert("RGB"))
    return [rgb[i // 4 * 284:(i // 4 + 1) * 284, i % 4 * 400:(i % 4 + 1) * 400]
            for i in range(12)]


def locate(frame, rest, bounds):
    x, y, end_x, end_y = bounds
    template = rest[y:end_y, x:end_x].astype(np.float32)
    template -= template.mean(axis=(0, 1))
    h, w = template.shape[:2]
    roi = frame[y-13:end_y+13, x-12:end_x+35].astype(np.float32)
    patches = np.lib.stride_tricks.sliding_window_view(roi, (h, w), axis=(0, 1))
    numerator = np.einsum("ijchw,hwc->ij", patches, template)

    def window_sums(data):
        table = np.pad(data, ((1, 0), (1, 0), (0, 0))).cumsum(0, dtype=np.float64).cumsum(1)
        return table[h:, w:] - table[:-h, w:] - table[h:, :-w] + table[:-h, :-w]

    variance = (window_sums(roi * roi) - window_sums(roi)**2 / (h*w)).sum(axis=2)
    scores = numerator / np.sqrt(np.maximum(1e-9, variance * np.square(template).sum()))
    row, col = np.unravel_index(np.argmax(scores), scores.shape)

    def subpixel(values, peak):
        if peak == 0 or peak + 1 == len(values):
            return 0.
        left, middle, right = values[peak-1:peak+2]
        curvature = left - 2*middle + right
        return (left - right) / (2*curvature) if curvature < -1e-8 else 0.

    displacement = np.array([col-12+subpixel(scores[row], col), row-13+subpixel(scores[:, col], row)])
    return float(scores[row, col]), displacement


def amber_pixels(frame, left):
    x = 110 if left else 288
    y = 121 if left else 116
    block = frame[y-17:y+13, x-22:x+23].astype(np.int16)
    red, green, blue = block.transpose(2, 0, 1)
    return int(((red - blue > 80) & (green - blue > 35) & (red > 140)).sum())


@unittest.skipUnless(np is not None, "The portrait pixel audit requires Pillow and NumPy")
class ChatGazeTest(unittest.TestCase):
    def test_glance_has_one_smooth_horizontal_displacement(self):
        frames = load_frames(ART / "cel-glance.webp")
        for pair in LANDMARKS:
            previous = None
            for i, frame in enumerate(frames):
                with self.subTest(frame=i, feature=pair[0][:2]):
                    tracks = [locate(frame, frames[0], bounds) for bounds in pair]
                    self.assertGreater(min(score for score, _ in tracks), .95)
                    left, right = (point for _, point in tracks)
                    self.assertLess(np.linalg.norm(left-right), .35)
                    for horizontal, vertical in (left, right):
                        self.assertAlmostEqual(horizontal, 16*i/11, delta=.38)
                        self.assertAlmostEqual(vertical, 0., delta=.30)
                    if previous is not None:
                        self.assertGreater(left[0] - previous, .9)
                        self.assertLess(left[0] - previous, 2.)
                    previous = left[0]

    def test_visible_features_remain_binocular_through_the_expression_library(self):
        observed = 0
        for mood in EXPRESSIONS:
            frames = load_frames(ART / f"cel-{mood}.webp")
            visible = 0
            for i, frame in enumerate(frames):
                candidates = [[locate(frame, frames[0], bounds) for bounds in pair] for pair in LANDMARKS]
                best = max(candidates, key=lambda pair: min(score for score, _ in pair))
                if min(score for score, _ in best) < .965:
                    # A closed lid hides the visible paint; excited adds a painted star.
                    continue
                left, right = (point for _, point in best)
                with self.subTest(expression=mood, frame=i):
                    self.assertLess(np.linalg.norm(left-right), .70)
                visible += 1
            with self.subTest(expression=mood):
                self.assertGreaterEqual(visible, 4)
            observed += visible
        self.assertGreaterEqual(observed, 190)

    def test_eyelids_can_cover_iris_without_moving_the_other_eye(self):
        for mood in ("blink", "laugh", "relieved", "wink"):
            frames = load_frames(ART / f"cel-{mood}.webp")
            for left in (True, False):
                with self.subTest(expression=mood, left=left):
                    open_pixels = amber_pixels(frames[0], left)
                    self.assertGreater(open_pixels, 160)
                    end_pixels = amber_pixels(frames[-1], left)
                    if mood == "wink" and left:
                        self.assertGreater(end_pixels, .85*open_pixels)
                        for frame in frames:
                            score, offset = locate(frame, frames[0], LANDMARKS[1][0])
                            self.assertGreater(score, .985)
                            self.assertLess(np.linalg.norm(offset), .28)
                    else:
                        self.assertLessEqual(end_pixels, 2)
