import io
import tarfile
import unittest

from tools.stage_runtime import add_parent_dirs


class RuntimePackTest(unittest.TestCase):
    def test_explicit_directories_precede_every_asset_and_occur_once(self):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode="w") as archive:
            seen = set()
            for name in ("root/codex-mobile/app.js", "root/codex-mobile/index.html", "root/.codex/media/icon.png"):
                add_parent_dirs(archive, name, seen)
                archive.addfile(tarfile.TarInfo(name))
        output.seek(0)
        with tarfile.open(fileobj=output) as archive:
            members = archive.getmembers()
        self.assertEqual([(member.name, member.isdir()) for member in members], [
            ("root", True),
            ("root/codex-mobile", True),
            ("root/codex-mobile/app.js", False),
            ("root/codex-mobile/index.html", False),
            ("root/.codex", True),
            ("root/.codex/media", True),
            ("root/.codex/media/icon.png", False),
        ])
