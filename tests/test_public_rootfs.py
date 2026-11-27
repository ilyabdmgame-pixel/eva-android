import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from tools import prepare_public_rootfs as image


class PublicRuntimeTests(unittest.TestCase):
    def test_every_debian_binary_maps_to_pinned_source(self):
        lock = json.loads(image.LOCK.read_text())
        for name, version, path, digest, source in lock['packages']:
            self.assertTrue(name and version and path.startswith('pool/main/'))
            self.assertRegex(digest, r'^[\da-f]{64}$')
            self.assertTrue(any(url.endswith('.dsc') for url, _ in lock['sources'][source]))
            for _, value in lock['sources'][source]:
                self.assertRegex(value, r'^[\da-f]{64}$')
        expected = {'node','codex','platform','codex-license','codex-notice','rg-license','rg-unlicense','bwrap-copying','bwrap-license'}
        self.assertEqual({x[0] for x in lock['components']},expected)

    def test_source_release_rejects_unrelated_files_before_network_or_packaging(self):
        with tempfile.TemporaryDirectory() as temp:
            export = Path(temp) / 'sources'
            export.mkdir()
            extra = export / 'unrelated.txt'
            extra.write_text('personal draft')
            with self.assertRaisesRegex(ValueError, 'unrelated files'):
                image.sources(json.loads(image.LOCK.read_text()), export, Path(temp) / 'cache')
            self.assertEqual(extra.read_text(), 'personal draft')
            extra.unlink()
            (export / 'private-project-name').mkdir()
            with self.assertRaisesRegex(ValueError, 'unrelated files'):
                image.sources(json.loads(image.LOCK.read_text()), export, Path(temp) / 'cache')

    def test_selects_runtime_and_notices_without_personal_or_demo_key_files(self):
        for name in ['root/.bashrc','home/me/.ssh/id_rsa','usr/share/doc/test/samples/private.pem','etc/skel/.profile']:
            self.assertFalse(image.include_deb(name))
        self.assertTrue(image.include_deb('usr/share/doc/git/copyright'))
        self.assertTrue(image.include_deb('usr/share/common-licenses/GPL-2'))
        self.assertTrue(image.include_deb('usr/share/ca-certificates/mozilla/Example_root.crt'))
        with self.assertRaises(ValueError):
            image.relative('respect/../../host')

    def test_absolute_guest_links_are_relative_and_repeated_archives_are_identical(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);root=base/'root';root.mkdir()
            stream=io.BytesIO()
            with tarfile.open(fileobj=stream,mode='w') as tar:
                data=tarfile.TarInfo('usr/bin/app');data.size=4;data.mode=0o4755
                tar.addfile(data,io.BytesIO(b'test'))
                link=tarfile.TarInfo('usr/bin/absolute');link.type=tarfile.SYMTYPE;link.linkname='/usr/bin/app';tar.addfile(link)
                link=tarfile.TarInfo('usr/bin/alias');link.type=tarfile.LNKTYPE;link.linkname='usr/bin/app';tar.addfile(link)
            stream.seek(0)
            image.unpack(root,stream,lambda name:name,image.include_deb)
            for name in ['absolute','alias']:
                link=root/'usr/bin'/name
                self.assertTrue(link.is_symlink());self.assertFalse(link.readlink().is_absolute());self.assertEqual(link.read_bytes(),b'test')
            for n in ['first','second']:image.pack(root,base/n)
            self.assertEqual(image.sha(base/'first'),image.sha(base/'second'))
            with tarfile.open(base/'first') as tar:
                self.assertEqual(tar.getmember('usr/bin/app').mode,0o755)
                self.assertEqual(tar.getmember('usr/bin/app').mtime,0)


if __name__=='__main__':unittest.main()
