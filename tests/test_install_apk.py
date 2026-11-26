import unittest
from types import SimpleNamespace
from unittest.mock import patch

from tools.audit_apk import clean_path
from tools.install_apk import check_update


class ApkUpdateTest(unittest.TestCase):
    args = SimpleNamespace(aapt="aapt", apksigner="apksigner")
    package = "org.evaassistant.app"

    @patch("tools.install_apk.run")
    @patch("tools.install_apk.apk_info")
    @patch("tools.install_apk.apk_signers")
    def test_accepts_existing_install_only_with_matching_signer(self, signers, info, run):
        info.return_value = (self.package, 89)
        signers.return_value = {"trusted"}
        paths = ["/data/app/eva/base.apk"]
        self.assertEqual(check_update(["adb"], self.args, self.package, 90, {"trusted"}, paths), 89)
        with self.assertRaisesRegex(ValueError, "certificate mismatch"):
            check_update(["adb"], self.args, self.package, 90, {"other"}, paths)
        with self.assertRaisesRegex(ValueError, "newer"):
            check_update(["adb"], self.args, self.package, 88, {"trusted"}, paths)
        self.assertEqual(run.call_count, 3)

    def test_archive_audit_rejects_local_state_and_traversal(self):
        self.assertEqual(clean_path("./root/codex-mobile/app.js"), "root/codex-mobile/app.js")
        for name in ("root/.codex/sessions/readme.md", "assets/private.p12", "root/../auth.json"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                clean_path(name)
