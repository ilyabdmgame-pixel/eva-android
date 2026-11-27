#!/usr/bin/env python3
"""Build and verify an ARM64 Eva APK offline from a local SDK and dependency profile."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZipInfo, ZIP_STORED, ZIP_DEFLATED

from audit_apk import audit
from stage_runtime import ROOT, PACKS, LIBRARIES, pack_application

ANDROID = "http://schemas.android.com/apk/res/android"


def manifest(profile, destination):
    gradle = (ROOT / "app/build.gradle").read_text()
    package = profile.get("applicationId", "org.evaassistant.app")
    if not re.fullmatch(r"[a-zA-Z]\w*(?:\.[a-zA-Z]\w*)+", package):
        raise ValueError("Invalid application ID")
    def field(key):
        return re.search(rf"^\s*{key}\s+['\"]?([\w.]+)", gradle, re.M)[1]
    version = field("versionName")
    code = int(field("versionCode")) + int(profile.get("versionCodeOffset", 0))
    source = (ROOT / "app/src/main/AndroidManifest.xml").read_text().replace("${applicationId}", package)
    root = ET.fromstring(source)
    ET.register_namespace("android", ANDROID)
    def android_attr(key):
        return f"{{{ANDROID}}}{key}"
    root.set("package", package)
    root.set(android_attr("versionCode"), str(code))
    root.set(android_attr("versionName"), version)
    application = root.find("application")
    application.set(android_attr("debuggable"), "true" if profile.get("debuggable") else "false")
    # Gradle sets this through useLegacyPackaging. The standalone aapt path has no manifest merger.
    application.set(android_attr("extractNativeLibs"), "true")
    root.insert(0, ET.Element("uses-sdk", {android_attr(k): field(k.replace("SdkVersion", "Sdk"))
        for k in ["minSdkVersion", "targetSdkVersion"]}))
    destination.write_bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True))
    return version, package, code


def compile_app(profile, scratch, run):
    classes, dex = scratch / "classes", scratch / "dex"
    classes.mkdir()
    dex.mkdir()
    jdk = Path(profile["jdk"]) / "bin"
    jars = []
    for index, aar in enumerate(profile["aars"]):
        with ZipFile(aar) as archive, archive.open("classes.jar") as source:
            target = scratch / f"dependency-{index}.jar"
            with target.open("wb") as out:
                shutil.copyfileobj(source, out)
            jars.append(target)
    sources = sorted((ROOT / "app/src/main/src").rglob("*.java"))
    run([jdk / "javac", "--release", "17", "-encoding", "UTF-8", "-cp",
         os.pathsep.join([profile["androidJar"], *map(str, jars)]), "-d", classes, *sources])
    app = scratch / "app.jar"
    run([jdk / "jar", "cf", app, "-C", classes, "."])
    run([jdk / "java", "-Xmx512m", "-cp", profile["d8Jar"], "com.android.tools.r8.D8",
         "--min-api", "26", "--lib", profile["androidJar"], "--output", dex, app, *jars])
    return sorted(dex.glob("classes*.dex"))


def package_apk(profile, staging, resources, dex, output):
    deps = Path(profile["runtimeDeps"])
    source_assets = ROOT / "app/src/main/assets"
    written = set()
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as apk:
        def entry(name, stream, store=False):
            if name in written:
                raise ValueError(f"Duplicate APK entry {name}")
            written.add(name)
            item = ZipInfo(name)
            item.compress_type = ZIP_STORED if store else ZIP_DEFLATED
            if store:
                pad = (-(apk.fp.tell() + 30 + len(name.encode()) + 4)) % 4
                item.extra = struct.pack("<HH", 0xeaa1, pad) + bytes(pad)
            with apk.open(item, "w") as out:
                shutil.copyfileobj(stream, out, 1 << 20)
        def file(name, source, store=False):
            with source.open("rb") as content:
                entry(name, content, store)
        with ZipFile(resources) as archive:
            for name in archive.namelist():
                with archive.open(name) as src:
                    entry(name, src, name == "resources.arsc")
        for p in dex:
            file(p.name, p)
        for p in sorted(source_assets.rglob("*")):
            if p.is_file() and not p.is_symlink():
                file("assets/" + p.relative_to(source_assets).as_posix(), p, p.suffix in {".png", ".webp", ".jpg"})
        for p in sorted(staging.iterdir()):
            file("assets/" + p.name, p, True)
        for name in PACKS:
            file("assets/" + name, deps / name, True)
        for name in LIBRARIES:
            override = profile.get("nativeLibraries", {}).get(name)
            file("lib/arm64-v8a/" + name, Path(override) if override else deps / name)
        for aar in profile["aars"]:
            with ZipFile(aar) as archive:
                for name in archive.namelist():
                    if name.startswith("jni/arm64-v8a/") and name.endswith(".so"):
                        with archive.open(name) as src:
                            entry("lib/" + name.removeprefix("jni/"), src)


def build(profile, output=None):
    env = dict(os.environ)
    if profile.get("libraryDirs"):
        env["LD_LIBRARY_PATH"] = os.pathsep.join(profile["libraryDirs"] + ([env["LD_LIBRARY_PATH"]] if env.get("LD_LIBRARY_PATH") else []))
    def run(args, **kwargs):
        return subprocess.run(args, check=True, env=env, **kwargs)
    with tempfile.TemporaryDirectory(prefix="eva-build-") as folder:
        scratch = Path(folder)
        xml = scratch / "AndroidManifest.xml"
        version, package, code = manifest(profile, xml)
        print(f"Building {package} {version} ({code})", flush=True)
        if output is None:
            output = Path(profile.get("outputDirectory", ROOT / "app/build/outputs/apk/offline")) / f"Eva-{version}.apk"
        output = output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        resources = scratch / "resources.apk"
        run([profile["aapt"], "package", "-f", "-M", xml, "-S", ROOT / "app/src/main/res",
             "-I", profile.get("resourceJar", profile["androidJar"]), "-F", resources])
        dex = compile_app(profile, scratch, run)
        if not dex:
            raise ValueError("D8 did not produce an application")
        staging = scratch / "assets"
        pack_application(staging, Path(profile["runtimeDeps"]) / "rootfs.pack")
        unsigned = scratch / "unsigned.apk"
        package_apk(profile, staging, resources, dex, unsigned)
        fd, temp = tempfile.mkstemp(prefix=".eva-signed-", suffix=".apk", dir=output.parent)
        os.close(fd)
        candidate = Path(temp)
        try:
            signer = [Path(profile["jdk"]) / "bin/java", "-Xmx384m", "-jar", profile["apkSignerJar"]]
            run([*signer, "sign", "--v4-signing-enabled", "false", "--ks", profile["keyStore"],
                 "--ks-pass", "file:" + profile["keyStorePasswordFile"], "--out", candidate, unsigned])
            verified = run([*signer, "verify", "--print-certs", candidate], capture_output=True, text=True).stdout
            digest = re.search(r"Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]{64})", verified)
            if not digest or digest[1].lower() != profile["certificateSha256"].lower():
                raise ValueError("Signed APK does not match the profile's expected certificate")
            audit(candidate)
            os.replace(candidate, output)
        finally:
            candidate.unlink(missing_ok=True)
        print(f"Verified {package} {version} ({code})\n{output}", flush=True)
        return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        build(json.loads(args.profile.read_text()), args.output)
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
