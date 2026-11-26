#!/usr/bin/env python3
"""Verify the package and signing certificate before installing an Eva APK."""
import argparse
from pathlib import Path
import re
import subprocess
import tempfile


def run(command):
    return subprocess.check_output(command, text=True).strip()


def apk_info(aapt, apk):
    line = next(line for line in run([aapt, "dump", "badging", str(apk)]).splitlines()
                if line.startswith("package:"))
    match = re.search(r"name='([^']+)'.*versionCode='(\d+)'", line)
    if not match:
        raise ValueError("Cannot read APK package and version")
    return match[1], int(match[2])


def apk_signers(apksigner, apk):
    output = run([apksigner, "verify", "--print-certs", str(apk)])
    signers = re.findall(r"Signer #\d+ certificate SHA-256 digest: ([0-9a-f]{64})", output)
    if not signers:
        raise ValueError("The APK has no verified signing certificate")
    return set(signers)


def installed_paths(adb, package):
    result = subprocess.run([*adb, "shell", "pm", "path", package], text=True, capture_output=True)
    if result.returncode and (result.stdout.strip() or result.stderr.strip()):
        raise ValueError(result.stderr.strip() or result.stdout.strip())
    return [line.removeprefix("package:").strip() for line in result.stdout.splitlines()
            if line.startswith("package:")]


def check_update(adb, args, package, version, candidate_signers, paths):
    base = next((item for item in paths if item.endswith("/base.apk")), paths[0])
    with tempfile.TemporaryDirectory(prefix="eva-apk-") as directory:
        installed = Path(directory) / "installed.apk"
        run([*adb, "pull", base, str(installed)])
        installed_package, installed_version = apk_info(args.aapt, installed)
        if installed_package != package:
            raise ValueError("Installed APK package does not match")
        if installed_version > version:
            raise ValueError(f"Installed version {installed_version} is newer than {version}")
        if apk_signers(args.apksigner, installed) != candidate_signers:
            raise ValueError("Signing certificate mismatch. Keep the installed app and its data.")
        return installed_version


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--package", default="org.evaassistant.app", help="expected Android application ID")
    parser.add_argument("--serial", help="ADB device serial, if multiple devices are connected")
    parser.add_argument("--check", action="store_true", help="check the build and device without installing")
    parser.add_argument("--adb", default="adb")
    parser.add_argument("--aapt", default="aapt")
    parser.add_argument("--apksigner", default="apksigner")
    args = parser.parse_args()
    apk = args.apk.resolve(strict=True)
    package, version = apk_info(args.aapt, apk)
    if package != args.package:
        raise ValueError(f"Expected {args.package}, got {package}")
    signers = apk_signers(args.apksigner, apk)
    adb = [args.adb, *["-s", args.serial]] if args.serial else [args.adb]
    if run([*adb, "get-state"]) != "device":
        raise ValueError("No authorized ADB device")
    paths = installed_paths(adb, package)
    if paths:
        old = check_update(adb, args, package, version, signers, paths)
        print(f"{package}: verified update {old} -> {version}")
    else:
        print(f"{package}: verified fresh install {version}")
    if args.check:
        return
    command = [*adb, "install", *(["-r"] if paths else []), str(apk)]
    subprocess.run(command, check=True)
    verified = installed_paths(adb, package)
    if not verified:
        raise ValueError("Android did not report an installed APK")
    if check_update(adb, args, package, version, signers, verified) != version:
        raise ValueError("Android still reports a different installed version")
    print("Package and signature verified on Android.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, StopIteration, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
