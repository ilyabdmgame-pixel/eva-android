#!/usr/bin/env python3
"""Publish a checked draft only after every APK/source asset matches the local SHA-256."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from release import digest, sha


def api(path, method="GET", data=None):
    headers = {"User-Agent": "Eva-public-release", "Authorization": "Bearer " + os.environ["GH_TOKEN"],
               "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    url = "https://api.github.com/repos/" + os.environ["GITHUB_REPOSITORY"] + "/" + path
    request = Request(url, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
    with urlopen(request, timeout=60) as response:
        return None if response.status == 204 else json.load(response)


def release_for(tag):
    try:
        return api("releases/tags/" + tag)
    except HTTPError as error:
        if error.code != 404:
            raise
    page = 1
    while True:
        releases = api(f"releases?per_page=100&page={page}")
        for item in releases:
            if item["tag_name"] == tag:
                return item
        if len(releases) < 100:
            return None
        page += 1


def assets_for(release_id):
    assets = {}
    for page in range(1, 1000):
        rows = api(f"releases/{release_id}/assets?per_page=100&page={page}")
        for row in rows:
            if row["name"] in assets:
                raise ValueError("Duplicate name in remote release")
            assets[row["name"]] = row
        if len(rows) < 100:
            return assets
    raise ValueError("Too many release assets")


def source_names(tag, names):
    prefix = f"Eva-{tag[1:]}-"
    required = {prefix + "arm64.apk", prefix + "native-sources.tar", "SOURCE-INSTRUCTIONS.txt", "SHA256SUMS"}
    parts = sorted(name for name in names if re.fullmatch(re.escape(prefix) + r"linux-sources\.tar\.part-[0-9]{3}", name))
    expected = [prefix + f"linux-sources.tar.part-{n:03}" for n in range(1, len(parts) + 1)]
    if not parts or parts != expected or set(names) != (required | set(parts)):
        raise ValueError("Incomplete or unexpected release asset set")


def checksums(text):
    hashes = {}
    for line in text.splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  ([a-zA-Z0-9_.-]+)", line)
        if not match or match[2] in hashes or match[2] in (".", "..", "SHA256SUMS"):
            raise ValueError("Invalid release checksum manifest")
        hashes[match[2]] = match[1]
    return hashes


def validate_assets(remote, expected):
    if set(remote) != set(expected):
        raise ValueError("Incomplete or unexpected release assets")
    for name, value in expected.items():
        if remote[name]["state"] != "uploaded" or remote[name].get("digest") != "sha256:" + value:
            raise ValueError("GitHub asset differs from the expected checksum: " + name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["status", "publish"])
    parser.add_argument("tag")
    parser.add_argument("signed_sha256")
    parser.add_argument("directory", nargs="?", type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r"v[0-9]+(?:\.[0-9]+){1,3}", args.tag):
        raise ValueError("Invalid release tag")
    signed_sha = sha(args.signed_sha256)
    apk = f"Eva-{args.tag[1:]}-arm64.apk"
    release = release_for(args.tag)
    if args.operation == "status":
        if not release or release["draft"]:
            print("complete=false")
            return
        remote = assets_for(release["id"])
        source_names(args.tag, remote)
        # SHA256SUMS is itself committed by GitHub's independent per-asset digest.
        result = subprocess.check_output(
            ["gh", "api", "-H", "Accept: application/octet-stream",
             f"repos/{os.environ['GITHUB_REPOSITORY']}/releases/assets/{remote['SHA256SUMS']['id']}"])
        expected = checksums(result.decode("ascii"))
        expected["SHA256SUMS"] = hashlib.sha256(result).hexdigest()
        if expected[apk] != signed_sha:
            raise ValueError("Published APK differs from the receipt")
        validate_assets(remote, expected)
        print("complete=true")
        return
    directory = args.directory
    if not directory or not directory.is_dir():
        raise ValueError("Expected directory of audited release assets")
    paths = {p.name: p for p in directory.iterdir() if p.is_file() and not p.is_symlink()}
    source_names(args.tag, paths)
    hashes = checksums(paths["SHA256SUMS"].read_text())
    actual = {name: digest(path) for name, path in paths.items()}
    if actual != {**hashes, "SHA256SUMS": actual["SHA256SUMS"]} or actual[apk] != signed_sha:
        raise ValueError("Local release files differ from the manifest or the signed receipt")
    if release is None:
        notes = ("Android ARM64, API 26+. Установочный APK, контрольные суммы и соответствующие исходники "
                 "зависимостей приложены к выпуску. Инструкции по проверке и распаковке есть в SOURCE-INSTRUCTIONS.txt.")
        release = api("releases", "POST", {"tag_name": args.tag, "name": "Ева " + args.tag[1:], "body": notes, "draft": True})
    remote = assets_for(release["id"])
    if not remote.keys() <= actual.keys():
        raise ValueError("The existing release contains unrecognized assets")
    for name in sorted(paths):
        # GitHub can leave a zero-byte starter after a disconnected draft upload.
        if name in remote and release["draft"] and remote[name]["state"] == "starter" and remote[name]["size"] == 0:
            api("releases/assets/" + str(remote[name]["id"]), "DELETE")
            del remote[name]
        if name in remote:
            validate_assets({name: remote[name]}, {name: actual[name]})
        elif release["draft"]:
            subprocess.run(["gh", "release", "upload", args.tag, str(paths[name]), "--repo", os.environ["GITHUB_REPOSITORY"]], check=True)
        else:
            raise ValueError("An already published release is missing " + name)
    validate_assets(assets_for(release["id"]), actual)
    if release["draft"]:
        release = api("releases/" + str(release["id"]), "PATCH", {"draft": False})
    print(release["html_url"])


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
