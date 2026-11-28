#!/usr/bin/env python3
"""Build the public ARM64 Linux runtime from checked upstream archives (Python 3.11+)."""
import argparse
import concurrent.futures
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import platform
import posixpath
import re
import selectors
import signal
import shutil
import stat
import subprocess
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile

LOCK = Path(__file__).with_name('public-rootfs.lock.json')
NODE_PREFIX = 'usr'
NPM = 'usr/lib/node_modules/@openai/'
VENDOR = NPM + 'codex-linux-arm64/vendor/aarch64-unknown-linux-musl/'
PRIVATE = re.compile(r'(?:^|/)(?:\.git|\.ssh|\.android|\.codex|\.env(?:\.|$)|sessions|auth\.json|\.bash_history)(?:/|$)|\.(?:pem|jks|keystore|p12|jsonl)$', re.I)


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def fetch(directory, name, urls, expected):
    path = directory / name
    if path.is_file() and not path.is_symlink() and sha(path) == expected:
        return path
    directory.mkdir(parents=True, exist_ok=True)
    errors = []
    for url in urls:
        for attempt in range(2):
            temp = None
            try:
                with tempfile.NamedTemporaryFile(dir=directory, suffix='.part', delete=False) as dest:
                    temp = Path(dest.name)
                    request = urllib.request.Request(url, headers={'User-Agent': 'Eva-public-userspace/1'})
                    with urllib.request.urlopen(request, timeout=90) as response:
                        shutil.copyfileobj(response, dest, 1 << 20)
                if sha(temp) != expected:
                    raise ValueError(f'SHA-256 mismatch from {url}')
                temp.replace(path)
                return path
            except (OSError, ValueError) as error:
                errors.append(str(error))
                if attempt == 0:
                    time.sleep(.5)
            finally:
                if temp:
                    temp.unlink(missing_ok=True)
    raise RuntimeError(f'{name}: ' + ', '.join(errors))


def mirrors(lock, relative):
    encoded = urllib.parse.quote(relative, safe='/+~.-')
    return [mirror + encoded for mirror in lock['debian_mirrors']]


def artifacts(lock, cache):
    jobs = []
    for name, _version, relative, digest, _source in lock['packages']:
        jobs.append((name, Path(relative).name, mirrors(lock, relative), digest))
    for role, url, digest in lock['components']:
        filename = url.rsplit('/', 1)[1] if role in ('node','codex','platform') else role
        jobs.append((role, filename, [url], digest))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        files = pool.map(lambda job: (job[0], fetch(cache, *job[1:])), jobs)
        return dict(files)


def sources(lock, dest, cache):
    # Group each Debian .dsc with its referenced upstream archive(s) and Debian patches.
    jobs = []
    for package, records in lock['sources'].items():
        for relative, digest in records:
            jobs.append((dest / package, Path(relative).name, mirrors(lock, relative), digest))
    for url, digest in lock['component_sources']:
        parsed = urllib.parse.urlsplit(url)
        parts = [part for part in parsed.path.split('/') if part]
        filename = parts[-1]
        if parsed.hostname == 'codeload.github.com':
            filename = parts[1] + '-' + parts[-1] + '.tar.gz'
        jobs.append((dest / 'upstream', filename, [url], digest))
    for role, url, digest in lock['components']:
        if role not in ('node','codex','platform'):
            jobs.append((dest/'notices', role, [url], digest))
    expected = {directory / filename for directory, filename, _, _ in jobs}
    expected.add(dest / LOCK.name)
    expected.update(dest / 'notices/debian' / package for package in lock['sources'])
    directories = {parent for p in expected for parent in p.parents if parent.is_relative_to(dest)}
    if dest.is_symlink() or any(p.is_symlink() or p not in (directories if p.is_dir() else expected) for p in dest.rglob('*')):
        raise ValueError('Source export contains unrelated files or links. Select a dedicated output directory.')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda job: fetch(*job), jobs))
    for package, records in lock['sources'].items():
        archives = [dest/package/Path(path).name for path, _ in records if '.tar.' in path]
        archives.sort(key=lambda p: ('.debian.tar.' not in p.name, '.orig.tar.' in p.name))
        target = dest/'notices/debian'/package
        target.parent.mkdir(parents=True, exist_ok=True)
        for path in archives:
            with tarfile.open(path,'r|*') as tar:
                doc = next((m for m in tar if m.isfile() and (m.name=='debian/copyright' or m.name.endswith('/debian/copyright'))), None)
                if doc:
                    with target.open('wb') as out:
                        shutil.copyfileobj(tar.extractfile(doc),out)
                    break
        if not target.is_file():
            # A few packages generate their copyright or keep debian/ in a predecessor
            # .diff.gz. Take their distributed notice from the same verified binary.
            for name, _, relative_path, digest, origin in lock['packages']:
                if origin != package:
                    continue
                deb = fetch(cache, Path(relative_path).name, mirrors(lock, relative_path), digest)
                with tarfile.open(fileobj=deb_data(deb), mode='r|*') as tar:
                    doc = next((m for m in tar if m.isfile() and m.name.endswith('/copyright') and 'share/doc/' in m.name), None)
                    if doc:
                        target.write_bytes(tar.extractfile(doc).read())
                        break
        if not target.is_file():
            raise ValueError('Missing source notice: '+package)
    shutil.copyfile(LOCK, dest / LOCK.name)


def deb_data(path):
    with path.open('rb') as stream:
        if stream.read(8) != b'!<arch>\n':
            raise ValueError(f'{path.name}: expected a Debian ar archive')
        while header := stream.read(60):
            if len(header) != 60 or header[-2:] != b'`\n':
                raise ValueError(f'{path.name}: malformed ar header')
            size = int(header[48:58])
            if header[:16].rstrip(b' /').startswith(b'data.tar.'):
                return io.BytesIO(stream.read(size))
            stream.seek(size + size % 2, os.SEEK_CUR)
    raise ValueError(f'{path.name}: no package data')


def relative(name):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '\x00' in name:
        raise ValueError(f'Unsafe archive path: {name}')
    return path.as_posix()


def include_deb(name):
    if name.split('/')[0] not in ('bin', 'sbin', 'lib', 'lib64', 'usr', 'etc'):
        return False
    if PRIVATE.search(name) or name.startswith(('etc/skel/', 'usr/share/man/', 'usr/share/info/', 'usr/share/lintian/')):
        return False
    parts = PurePosixPath(name).parts
    if parts[:3] == ('usr', 'share', 'locale') and len(parts) > 3:
        return parts[3].split('_')[0] in ('en', 'ru') or parts[3] == 'locale.alias'
    if parts[:3] == ('usr', 'share', 'doc') and len(parts) > 4:
        return any(term in parts[-1].lower() for term in ('copyright', 'license', 'copying', 'notice'))
    return True


def write_member(root, name, member, archive, map_name):
    if not name or name == '.':
        return
    path = root / name
    # All symlinks in the staging tree are relative guest paths. A broken parent or
    # unexpected upstream path can never be used to write outside this directory.
    if not path.parent.resolve().is_relative_to(root):
        raise ValueError(f'Path leaves build root: {name}')
    path.parent.mkdir(parents=True, exist_ok=True)
    if member.isdir():
        path.mkdir(exist_ok=True)
        return
    if member.issym():
        link = member.linkname
        if link.startswith('/'):
            link = posixpath.relpath(relative(link.lstrip('/')), posixpath.dirname(name))
        if not (path.parent / link).resolve().is_relative_to(root):
            raise ValueError(f'Link leaves build root: {name}')
        path.unlink(missing_ok=True)
        path.symlink_to(link)
    elif member.islnk():
        source = root / map_name(relative(member.linkname))
        if not source.resolve().is_relative_to(root) or not source.is_file():
            raise ValueError(f'Unresolved hardlink: {name} -> {member.linkname}')
        path.unlink(missing_ok=True)
        # Android app filesystems can forbid hardlinks even when both names share a
        # directory. Relative aliases preserve argv[0] for multicall binaries and
        # produce the same small archive on ordinary Linux and Android builders.
        path.symlink_to(os.path.relpath(source, path.parent))
    elif member.isfile():
        if path.is_symlink():
            path.unlink()
        with archive.extractfile(member) as src, path.open('wb') as dest:
            shutil.copyfileobj(src, dest, 1 << 20)
        path.chmod(0o755 if member.mode & 0o111 else 0o644)
    else:
        raise ValueError(f'Unexpected device or special file: {name}')


def unpack(root, stream, map_name, include):
    with tarfile.open(fileobj=stream, mode='r|*') as archive:
        for member in archive:
            name = map_name(relative(member.name))
            if name and include(name):
                write_member(root, name, member, archive, map_name)


def strip_top(prefix):
    def mapped(name):
        parts = PurePosixPath(name).parts
        return str(PurePosixPath(prefix, *parts[1:])) if len(parts) > 1 else ''
    return mapped


def write(root, name, text):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    path.chmod(0o644)


def symlink(root, name, target):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and not path.is_symlink():
        raise ValueError(f'Cannot replace regular file: {name}')
    path.unlink(missing_ok=True)
    path.symlink_to(target)


def build_tree(root, lock, files):
    # Trixie uses /usr-merge, including the ELF loader /lib/ld-linux-aarch64.so.1.
    for sub in ('bin', 'sbin', 'lib'):
        (root / 'usr' / sub).mkdir(parents=True, exist_ok=True)
        symlink(root, sub, 'usr/' + sub)
    for name, *_ in lock['packages']:
        unpack(root, deb_data(files[name]), lambda path: path, include_deb)
    for role, prefix in [('node', NODE_PREFIX), ('codex', NPM+'codex'), ('platform', NPM+'codex-linux-arm64')]:
        with files[role].open('rb') as stream:
            unpack(root, stream, strip_top(prefix), lambda name: not PRIVATE.search(name))
    for name, target in [('usr/bin/codex', '../lib/node_modules/@openai/codex/bin/codex.js'),
                         ('usr/bin/rg', '../'+VENDOR.removeprefix('usr/')+'codex-path/rg'),
                         ('usr/bin/sh', 'dash'), ('usr/bin/awk', 'mawk'), ('usr/bin/pager', 'less')]:
        symlink(root, name, target)
    # libadb's auxiliary libraries normally enter the postinstall ld.so.cache. A direct
    # per-soname link also works for a rootfs cross-built without executing maintainer scripts.
    lib = root / 'usr/lib/aarch64-linux-gnu'
    for file in sorted((lib / 'android').glob('*.so*')):
        direct = lib / file.name
        if not direct.exists() and not direct.is_symlink():
            direct.symlink_to('android/' + file.name)
    for sub in ('root', 'home', 'sdcard', 'dev', 'proc', 'sys', 'tmp', 'run', 'var/tmp', 'var/log', 'var/lib'):
        (root/sub).mkdir(exist_ok=True, parents=True)
    write(root, 'etc/passwd', 'root:x:0:0:root:/root:/bin/bash\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n')
    write(root, 'etc/group', 'root:x:0:\nnogroup:x:65534:\n')
    write(root, 'etc/hosts', '127.0.0.1 localhost\n::1 localhost ip6-localhost\n')
    write(root, 'etc/nsswitch.conf', 'passwd: files\ngroup: files\nhosts: files dns\nnetworks: files\nservices: files\n')
    write(root, 'etc/resolv.conf', '# Eva writes the active Android network resolvers here at startup.\n')
    certs = sorted((root / 'usr/share/ca-certificates/mozilla').glob('*.crt'))
    if len(certs) < 75 or not all(b'BEGIN CERTIFICATE' in p.read_bytes() for p in certs):
        raise ValueError('Debian CA roots missing')
    write(root, 'etc/ssl/certs/ca-certificates.crt', ''.join(p.read_text().rstrip()+'\n' for p in certs))
    doc = root / 'usr/share/doc/openai-codex'
    doc.mkdir(parents=True, exist_ok=True)
    notices = {'codex-license':'LICENSE','codex-notice':'NOTICE','rg-license':'ripgrep-LICENSE-MIT',
               'rg-unlicense':'ripgrep-UNLICENSE','bwrap-license':'bubblewrap-LICENSE','bwrap-copying':'bubblewrap-COPYING'}
    for role, name in notices.items():
        shutil.copyfile(files[role], doc/name)
    missing = [name for name, *_ in lock['packages'] if not (root/'usr/share/doc'/name/'copyright').is_file()]
    if missing:
        raise ValueError('Missing Debian package copyrights: ' + ', '.join(missing))
    manifest = ['package\tversion\tsource\tsha256']
    manifest += ['\t'.join((name, version, lock['debian_mirrors'][0]+url, digest)) for name, version, url, digest, _ in lock['packages']]
    manifest += ['\t'.join((name, '22.22.1' if name=='node' else '15.2.0' if name.startswith('rg-') else '0.167.1', url, digest)) for name,url,digest in lock['components']]
    write(root, 'usr/share/eva-userspace/manifest.tsv', '\n'.join(manifest)+'\n')
    shutil.copyfile(LOCK, root/'usr/share/eva-userspace'/LOCK.name)


def pack(root, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=path.name+'.', suffix='.partial', dir=path.parent, delete=False) as dest:
        temp = Path(dest.name)
        try:
            with gzip.GzipFile(filename='', fileobj=dest, mode='wb', compresslevel=6, mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as archive:
                for source in sorted(root.rglob('*'), key=lambda p: p.relative_to(root).as_posix()):
                    name = source.relative_to(root).as_posix()
                    entry = archive.gettarinfo(str(source), name)
                    entry.uid = entry.gid = entry.mtime = 0
                    entry.uname = entry.gname = ''
                    if entry.isdir():
                        entry.mode = 0o700 if name=='root' else 0o1777 if name in ('tmp','var/tmp') else 0o755
                    if entry.isfile():
                        entry.mode = 0o755 if entry.mode & 0o111 else 0o644
                        with source.open('rb') as data:
                            archive.addfile(entry, data)
                    else:
                        archive.addfile(entry)
            dest.flush()
            temp.replace(path)
        finally:
            temp.unlink(missing_ok=True)


def events(child, timeout=45):
    deadline = time.monotonic() + timeout
    pending = bytearray()
    with selectors.DefaultSelector() as watcher:
        watcher.register(child.stdout, selectors.EVENT_READ)
        while time.monotonic() < deadline and watcher.select(max(0, deadline - time.monotonic())):
            chunk = os.read(child.stdout.fileno(), 16384)
            if not chunk:
                break
            pending.extend(chunk)
            while b'\n' in pending:
                line, _, rest = pending.partition(b'\n')
                pending = bytearray(rest)
                yield line.decode('utf-8', errors='replace').strip()
    raise RuntimeError('Guest process exited or timed out before reporting ready')


def stop_process_group(child):
    # The npm launcher and the chat service each start a native Codex subprocess.
    try:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=3)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        pass
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    child.wait(timeout=5)


def smoke_application(archive, root, env, app_archive=None):
    if app_archive is None:
        if __package__:
            from .stage_runtime import pack_application
        else:
            from stage_runtime import pack_application
        assets = root.parent / 'apk-assets'
        pack_application(assets, archive)
        app_archive = assets / 'eva-runtime.pack'
    if any((root / 'root').iterdir()):
        raise RuntimeError('First-launch test requires a clean application home')
    with tarfile.open(app_archive, 'r:gz') as layer:
        layer.extractall(root, filter='data')

    def enter():
        os.chroot(root)
        os.chdir('/root')

    env = dict(env, HOME='/root')
    command = ['/usr/bin/env', '-i', *(key+'='+value for key,value in env.items()),
               '/usr/bin/node', '/root/codex-mobile/server.js']
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with subprocess.Popen(command, env=env, preexec_fn=enter, start_new_session=True,
                          stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE) as child:
        try:
            for line in events(child):
                match = re.fullmatch(r'EVA_READY (http://127\.0\.0\.1:\d+)/#([a-f0-9]{48})', line)
                if match:
                    base, token = match.groups()
                    break
            for route, mime, marker in [('/', 'text/html', b'<html lang="ru">'),
                                        ('/portrait.js', 'text/javascript', b'EvaPortrait'),
                                        ('/avatar/idle.png', 'image/webp', b'RIFF')]:
                with opener.open(base+route, timeout=5) as response:
                    if response.status != 200 or response.headers.get_content_type() != mime or marker not in response.read():
                        raise RuntimeError(f'Invalid first-launch response for {route}')
                print(f'Chat HTTP 200 {route} ({mime})', flush=True)
            atlases = sorted((root/'root/codex-mobile/avatar').glob('cel-*.webp'))
            avatar_dir = root/'root/codex-mobile/avatar'
            idle_clips = [avatar_dir/name for name in ('idle-body.webp', 'idle-hair.webp', 'idle-yawn.webp')]
            for atlas in [*atlases, *idle_clips]:
                with opener.open(base+'/avatar/'+atlas.name, timeout=5) as response:
                    if (response.headers.get_content_type() != 'image/webp'
                            or hashlib.file_digest(response, 'sha256').hexdigest() != sha(atlas)):
                        raise RuntimeError(f'HTTP portrait atlas differs from APK: {atlas.name}')
            if atlases:
                print(f'Chat HTTP 200: {len(atlases)} 2D atlases and {len(idle_clips)} idle clips verified byte for byte', flush=True)
            status = urllib.request.Request(base+'/status', headers={'X-Codex-Token': token})
            deadline = time.monotonic() + 40
            while time.monotonic() < deadline:
                with opener.open(status, timeout=5) as response:
                    state = json.load(response)
                if state.get('ready') is True and state.get('authenticated') is False:
                    print('First launch: EVA_READY, separate Codex ready, no account', flush=True)
                    return
                time.sleep(.25)
            raise RuntimeError('Codex on first launch did not reach ready state')
        finally:
            stop_process_group(child)


def smoke(archive_path, root, app_archive=None):
    if platform.machine() not in ('aarch64','arm64'):
        raise RuntimeError('--smoke needs ARM64 Linux; build itself is cross-platform')
    if os.geteuid() != 0:
        raise RuntimeError('Guest boot needs root in an isolated mount namespace')
    with tarfile.open(archive_path, 'r:gz') as src:
        src.extractall(root, filter='data')
    proc = root / 'proc'
    proc.mkdir(exist_ok=True)
    subprocess.run(['mount', '-t', 'proc', '-o', 'nosuid,nodev,noexec', 'proc', str(proc)], check=True)
    try:
        smoke_guest(archive_path, root, app_archive)
    finally:
        subprocess.run(['umount', str(proc)], check=True)


def smoke_guest(archive_path, root, app_archive):
    # Android bind-mounts /dev at startup. Use only this disposable tree for the tests.
    for name, major, minor in [('null',1,3),('zero',1,5),('urandom',1,9)]:
        dev = root/'dev'/name
        try:
            os.mknod(dev, stat.S_IFCHR|0o666, os.makedev(major,minor))
        except (PermissionError, NotImplementedError):
            pass
        # Under an Android PRoot, mknod can report success while creating no node.
        if not dev.exists():
            if name == 'urandom':
                dev.write_bytes(os.urandom(65536))
            else:
                dev.touch()
    (root/'home/eva-smoke').mkdir()
    def enter():
        os.chroot(root)
        os.chdir('/home/eva-smoke')
    certs = '/etc/ssl/certs/ca-certificates.crt'
    env = {'PATH':'/usr/local/bin:/usr/bin:/bin', 'HOME':'/home/eva-smoke', 'LANG':'C.UTF-8',
           'SSL_CERT_FILE':certs, 'NODE_EXTRA_CA_CERTS':certs, 'GIT_SSL_CAINFO':certs, 'ADB_SERVER_SOCKET':'tcp:localhost:5038'}
    cases = [(['/usr/bin/env','node','--version'],'v22.22.1'),(['npm','--version'],None),(['codex','--version'],'0.167.1'),
             (['rg','--version'],'ripgrep'),(['git','--version'],'git version'),(['ssh','-V'],'OpenSSH_'),
             (['adb','version'],'Android Debug Bridge'),(['adb','help'],'pair HOST'),
             (['python3','-c','import ssl,sqlite3,ctypes; print(ssl.create_default_context().cert_store_stats()["x509_ca"])'],None),
             (['/bin/sh','-c','printf ok | grep ok; command -v awk'],'/usr/bin/awk')]
    for cmd, expected in cases:
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, preexec_fn=enter, timeout=45)
        output = result.stdout + result.stderr
        if result.returncode or expected and expected.lower() not in output.lower():
            raise RuntimeError(f'{cmd[:2]} ({result.returncode}): {output[:500]}')
        print(f'{cmd[0]}: {output.strip().splitlines()[0]}', flush=True)
    with subprocess.Popen(['codex','app-server'], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, env=env, preexec_fn=enter, start_new_session=True) as child:
        try:
            request = {'id':1,'method':'initialize','params':{'clientInfo':{'name':'eva_smoke','version':'1'}}}
            child.stdin.write((json.dumps(request)+'\n').encode())
            child.stdin.flush()
            for line in events(child):
                reply = json.loads(line)
                if reply.get('id') == 1:
                    if not reply.get('result'):
                        raise RuntimeError('Codex initialize failed')
                    break
            print('Codex app-server: initialize OK', flush=True)
        finally:
            stop_process_group(child)
    smoke_application(archive_path, root, env, app_archive)


def smoke_apk(apk_path):
    if os.geteuid() != 0:
        raise RuntimeError('--smoke-apk requires root in an isolated Linux mount namespace')
    with tempfile.TemporaryDirectory(prefix='eva-apk-boot-') as directory, zipfile.ZipFile(apk_path) as apk:
        work = Path(directory)
        names = ('assets/rootfs.pack', 'assets/eva-runtime.pack')
        version = 'assets/eva-runtime.version'
        if any(apk.namelist().count(path) != 1 for path in (*names, version)) or apk.getinfo(version).file_size > 150:
            raise RuntimeError('Missing or duplicate packaged runtime')
        hashes = apk.read(version).decode('ascii').splitlines()
        if len(hashes) != 2 or not all(re.fullmatch(r'[a-f0-9]{64}', h) for h in hashes):
            raise RuntimeError('Invalid packaged runtime manifest')
        packs = []
        for path, expected in zip(names, hashes):
            target = work / Path(path).name
            with apk.open(path) as source, target.open('xb') as destination:
                shutil.copyfileobj(source, destination, 1 << 20)
            if sha(target) != expected:
                raise RuntimeError('Pack differs from Android runtime manifest: ' + path)
            packs.append(target)
        smoke(packs[0], work / 'root', app_archive=packs[1])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('local-runtime/rootfs.pack'))
    parser.add_argument('--cache',type=Path,default=Path(os.environ.get('XDG_CACHE_HOME',Path.home()/'.cache'))/'eva-public-rootfs')
    parser.add_argument('--smoke',action='store_true',help='run the packaged ARM64 programs in an isolated chroot')
    parser.add_argument('--smoke-apk',type=Path,help='boot both actual APK packs under sudo unshare --mount --propagation private on ARM64')
    parser.add_argument('--sources',type=Path,help='additionally download corresponding source archives into this directory')
    parser.add_argument('--sources-only',action='store_true',help='download sources and notices without building the binary image')
    args=parser.parse_args()
    if args.smoke_apk:
        smoke_apk(args.smoke_apk)
        return
    lock=json.loads(LOCK.read_text())
    if args.sources_only:
        if not args.sources:parser.error('--sources-only requires --sources DIRECTORY')
        sources(lock,args.sources,args.cache)
        print('Corresponding sources and notices:', args.sources)
        return
    files=artifacts(lock,args.cache)
    with tempfile.TemporaryDirectory(prefix='eva-public-') as work:
        root=Path(work).resolve()/'root'
        build_tree(root,lock,files)
        pack(root,args.output)
        if args.smoke:smoke(args.output,Path(work)/'smoke')
    if args.sources:sources(lock,args.sources,args.cache)
    print(f'{sha(args.output)}  {args.output}  ({args.output.stat().st_size:,} bytes)')


if __name__=='__main__':
    main()
