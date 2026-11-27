import hashlib
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from tools.audit_apk import audit_runtime, clean_path


def application_archive(entries):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name, content in entries:
            item = tarfile.TarInfo(name)
            item.size = len(content)
            tar.addfile(item, io.BytesIO(content))
    return buffer.getvalue()


class PackageContentsTest(unittest.TestCase):
    def verify(self, entries):
        name = "root/codex-mobile/index.html"
        asset = "assets/eva-runtime.pack"
        content = application_archive(entries)
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "index.html"
            source.write_bytes(b"tracked")
            with zipfile.ZipFile(io.BytesIO(), "w") as apk:
                apk.writestr(asset, content)
                with patch("tools.audit_apk.runtime_files", return_value=[(source, name)]):
                    audit_runtime(apk, asset, hashlib.sha256(content).hexdigest())

    def test_application_must_contain_exactly_the_tracked_files(self):
        name = "root/codex-mobile/index.html"
        valid = [(name, b"tracked")]
        self.verify(valid)
        for invalid in ([], valid + valid, [(name, b"changed")], valid + [("extra", b"x")]):
            with self.subTest(count=len(invalid)), self.assertRaises(ValueError):
                self.verify(invalid)

    def test_rejects_private_runtime_and_configuration_paths(self):
        for name in ("root/.config/eva/operations.json", "root/codex-mobile/current-url",
                     "root/.codex/sessions/chat", "root/secret.jks", "../sibling", "/private"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                clean_path(name)
