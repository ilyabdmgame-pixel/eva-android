import contextlib
import io
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from urllib.request import Request
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools/distribution"))
import fetch_candidate
import github_release
import release
import source_archives


class PublicDistributionTests(unittest.TestCase):
    def test_github_zip_digest_and_exact_members(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "artifact.zip"
            with ZipFile(archive, "w") as z:
                z.writestr(release.CANDIDATE, "{}")
                z.writestr(release.UNSIGNED, "apk bytes")
            out = root / "received"
            out.mkdir()
            with self.assertRaisesRegex(ValueError, "checksum"):
                fetch_candidate.extract(archive, out, "0" * 64, archive.stat().st_size)
            self.assertEqual(list(out.iterdir()), [])
            fetch_candidate.extract(archive, out, release.digest(archive), archive.stat().st_size)
            self.assertEqual((out / release.UNSIGNED).read_bytes(), b"apk bytes")
            with ZipFile(archive, "a") as z:
                z.writestr("../private", "outside candidate")
            with self.assertRaisesRegex(ValueError, "Unexpected files"):
                fetch_candidate.extract(archive, out, release.digest(archive), archive.stat().st_size)

    def test_api_token_stays_on_github(self):
        request = Request("https://api.github.com/repos/test/test", headers={"Authorization": "Bearer fake"})
        redirect = fetch_candidate.GitHubRedirect().redirect_request(request, None, 302, "", {},
                                                                    "https://storage.example.test/artifact")
        self.assertFalse(redirect.has_header("Authorization"))

    def test_receipt_is_idempotent_and_matches_source_version(self):
        version = release.version()
        record = release.metadata({"schema": 1, "version": version, "candidate_tag": "candidate-" + version,
                                   "source_commit": "a" * 40, "unsigned_sha256": "b" * 64,
                                   "run_id": 17, "run_attempt": 1})
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "nested/candidate.json"
            release.write_metadata(path, record)
            release.write_metadata(path, record)
            self.assertEqual(release.load(path), record)
            with self.assertRaisesRegex(ValueError, "Different receipt"):
                release.write_metadata(path, {**record, "run_id": 12})
            for field, invalid in (("candidate_tag", "candidate-Other"), ("run_id", True), ("source_commit", "invalid")):
                with self.assertRaises(ValueError):
                    release.metadata({**record, field: invalid})

    def test_zip_comment_and_partial_signature(self):
        with tempfile.TemporaryDirectory() as temp:
            apk = Path(temp) / "unsigned.apk"
            with ZipFile(apk, "w") as z:
                z.writestr("AndroidManifest.xml", "test")
                z.comment = b"test comment PK\x05\x06"
            with apk.open("rb") as source:
                cd, end, eocd = release.zip_sections(source)
                self.assertGreater(end, cd)
                self.assertTrue(eocd.endswith(b"PK\x05\x06"))
            with self.assertRaisesRegex(ValueError, "Invalid APK signing block"):
                release.insert_block(apk, apk.with_name("bad.apk"), 0, release.MAGIC)
            with ZipFile(apk, "w") as z:
                z.writestr("AndroidManifest.xml", "test")
                z.comment = b"release"
            release.unsigned_check(apk)
            with ZipFile(apk, "a") as z:
                z.writestr("META-INF/Key.SF", b"signed")
            with self.assertRaisesRegex(ValueError, "JAR signature"):
                release.unsigned_check(apk)

    def test_split_tar_preserves_source_and_modes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "input"
            source.mkdir()
            (source / "README").write_text("the public build instructions")
            writer = source_archives.SplitWriter(root / "source.tar", limit=2050)
            source_archives.tar_tree(source, "source", writer)
            writer.close()
            self.assertGreater(len(writer.files), 1)
            self.assertTrue(all(p.stat().st_size <= 2050 for p in writer.files))
            payload = b"".join(p.read_bytes() for p in writer.files)
            with tarfile.open(fileobj=io.BytesIO(payload)) as archive:
                self.assertEqual(archive.extractfile("source/README").read(), b"the public build instructions")
                self.assertEqual(archive.getmember("source/README").mtime, 0)

    def test_release_resumes_draft_and_checks_existing_published_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            tag, prefix = "v0.105", "Eva-0.105-"
            names = [prefix + "arm64.apk", prefix + "linux-sources.tar.part-001",
                     prefix + "native-sources.tar", "SOURCE-INSTRUCTIONS.txt"]
            for name in names:
                (directory / name).write_text(name)
            sums = directory / "SHA256SUMS"
            sums.write_text("".join(release.digest(directory / n) + "  " + n + "\n" for n in names))
            tag_release = {"id": 37, "draft": True, "html_url": "test-release"}
            remote = {names[0]: {"state": "starter", "size": 0, "id": 41}}
            uploaded = []

            def call(method, op, data=None):
                if op == "DELETE":
                    remote.pop(names[0])
                    return None
                self.assertEqual((method, op, data), ("releases/37", "PATCH", {"draft": False}))
                tag_release["draft"] = False
                return tag_release

            def upload(argv, check):
                path = Path(argv[4])
                remote[path.name] = {"id": len(uploaded), "size": path.stat().st_size, "state": "uploaded",
                                     "digest": "sha256:" + release.digest(path)}
                uploaded.append(path.name)

            with patch.object(github_release, "release_for", return_value=tag_release), \
                    patch.object(github_release, "assets_for", side_effect=lambda unused: remote.copy()), \
                    patch.object(github_release, "api", side_effect=call), \
                    patch.object(github_release.subprocess, "run", side_effect=upload), \
                    patch.object(github_release.subprocess, "check_output", return_value=sums.read_bytes()), \
                    patch.dict(os.environ, {"GITHUB_REPOSITORY": "example/test"}), \
                    contextlib.redirect_stdout(io.StringIO()):
                signed = release.digest(directory / names[0])
                with patch.object(sys, "argv", ["tool", "publish", tag, signed, str(directory)]):
                    github_release.main()
                    github_release.main()
                self.assertEqual(sorted(uploaded), sorted([*names, "SHA256SUMS"]))
                self.assertFalse(tag_release["draft"])
                with patch.object(sys, "argv", ["tool", "status", tag, signed]):
                    github_release.main()
                    remote[names[0]]["digest"] = "sha256:" + "0" * 64
                    with self.assertRaisesRegex(ValueError, "differs"):
                        github_release.main()
