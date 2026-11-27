# Android arm64 runtime

Eva ships four native ELF files derived from the Google Play distribution of Termux for Android. The accompanying full license texts retain the upstream notices.

| Files in the APK | Upstream source | Termux distribution |
| --- | --- | --- |
| `libproot.so`, `libproot-loader.so` | PRoot 5.1.107.80, revision `cd02c79e0ff84db3a22616e49ad44b0cc22ef4f2`. The PRoot and loader sources grant GPL version 2 or later. See `PRoot-COPYING.txt`. | The `proot_5.1.107.80_aarch64.deb` package and the separately released arm64 loader |
| `libtalloc.so` | Samba talloc 2.4.3, release revision `77229f73c20af69ab0f3c96efbb229ff64a9dfe4`. Copyright Andrew Tridgell, Stefan Metzmacher and contributors. The library sources grant LGPL version 3 or later. See `talloc-LGPL-3.0.txt` and `GPL-3.0.txt`. | The `libtalloc_2.4.3_aarch64.deb` package identifies its license file as GPL-3.0. Eva includes both texts. |
| `libandroid-shmem.so` | libandroid-shmem 0.7, revision `7f0bd7e25dbdd146265aff7c6a890029e374622d`. Copyright Sergii Pylypenko and Fredrik Fornwall. See `libandroid-shmem-LICENSE.txt` for the BSD 3-Clause terms. | The `libandroid-shmem_0.7_aarch64.deb` package |

## Reproducing the APK files

The complete [Termux packaging tree at 57401119](https://github.com/termux-play-store/termux-packages/tree/57401119f9988f79fa095398a9b33b03380222b3) includes the build scripts and patches for all three versions. Termux publishes the binary packages through its [arm64 package index](https://termux.net/dists/stable/main/binary-aarch64/Packages.xz) and the loader through its [June 2026 PRoot release](https://github.com/termux-play-store/termux-packages/releases/tag/proot-2026.06.21-r1).

For this audit, GnuPG verified the signed repository metadata dated 21 October 2026 against the key in the packaging tree, fingerprint `FE9D544EA817CD35966A4EB51584981E6CDDB22D`. Its arm64 package index has SHA-256 `fb23c0ec3c5eab37747dab2256855de49dac9730f9a244a1b05fedeb1b3164db` and records the three package digests pinned by Eva. The Termux app build also pins the SHA-256 of the separately published loader. [Release metadata](https://termux.net/dists/stable/InRelease) · [Termux signing key](https://github.com/termux-play-store/termux-packages/blob/57401119f9988f79fa095398a9b33b03380222b3/packages/termux-keyring/termux-packages.gpg) · [Termux app build](https://github.com/termux-play-store/termux-apps/blob/termux-app-googleplay.2026.06.21/termux-app/build.gradle.kts)

Eva changes the one NUL-terminated loader path in the PRoot executable from `/data/data/com.termux/files/applib/libproot-loader.so` to `/data/data/org.evaassistant.app/files/p` and fills the rest of that string with NUL bytes. The separately published loader is processed with `llvm-strip --strip-unneeded`. LLVM 15 produces the APK file byte for byte. The two shared libraries are copied from their verified packages. These ELF files have no GNU build-ID note. The final SHA-256 values are pinned in `tools/native_provenance.py`.

From the Eva source tree, use `python3 tools/native_provenance.py fetch local-runtime` to obtain the four native files. Use `python3 tools/native_provenance.py verify Eva.apk` to compare the installed archive entries to the pinned output hashes. Use `python3 tools/native_provenance.py sources native-source` to collect the three complete upstream source archives, the complete Termux packaging tree and the Eva transformation script for redistribution.

Upstream source trees are available from [PRoot](https://github.com/termux/proot/tree/cd02c79e0ff84db3a22616e49ad44b0cc22ef4f2), [Samba talloc](https://github.com/samba-team/samba/tree/77229f73c20af69ab0f3c96efbb229ff64a9dfe4/lib/talloc) and [libandroid-shmem](https://github.com/termux/libandroid-shmem/tree/7f0bd7e25dbdd146265aff7c6a890029e374622d).
