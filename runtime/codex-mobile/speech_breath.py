"""Optional, low-volume breaths in existing silent intervals of synthesized speech."""
import math
import random
import re
import wave
import torch
import torch.nn.functional as F

RATE = 24000
BREATH_FILE = '/root/codex-mobile/voices/breath/inhale.wav'

def prepare_text(text):
    # Keep disfluencies rare and away from figures, URLs and technical text.
    if len(text) >= 180 and not re.search(r'[0-9`/<>]', text) and random.random() < .12:
        return random.choice(('Хм... ', 'Ну... ')) + text
    return text

def add_breaths(audio):
    try:
        with wave.open(BREATH_FILE, 'rb') as wav:
            if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != RATE:
                return audio
            data = bytearray(wav.readframes(min(wav.getnframes(), RATE)))
        breath = torch.frombuffer(data, dtype=torch.int16).float() / 32768
        if len(breath) < RATE * .15:
            return audio
    except (OSError, wave.Error, ValueError):
        return audio
    # 10 ms energy windows; only replace already quiet portions of the output.
    frame = RATE // 100
    windows = audio[:len(audio)//frame*frame].reshape(-1, frame)
    quiet = (windows.abs().amax(dim=1) < .008).tolist()
    gaps = []
    start = None
    for i, is_quiet in enumerate(quiet + [False]):
        if is_quiet and start is None: start = i
        if not is_quiet and start is not None:
            if i-start >= 30: gaps.append((start*frame, i*frame))
            start = None
    last = 0
    result = audio.clone()
    count = 0
    for start, end in gaps:
        if start-last < RATE*5 or end > len(audio)-RATE or count >= 3: continue
        duration = min(random.uniform(.24, .36), (end-start)/RATE - .06)
        if duration < .20: continue
        size = int(duration*RATE)
        sample = F.interpolate(breath.view(1,1,-1), size=size, mode='linear', align_corners=False).view(-1)
        envelope = torch.sin(torch.linspace(0, math.pi, size)).clamp_min(0).pow(1.5)
        peak = sample.abs().max().item()
        if peak < .0001: continue
        sample = sample / peak * random.uniform(.018, .032) * envelope
        offset = start + (end-start-size)//2
        result[offset:offset+size] += sample
        last, count = end, count+1
    return result
