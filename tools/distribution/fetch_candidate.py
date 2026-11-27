#!/usr/bin/env python3
"""Check the candidate run with GitHub, verify its artifact ZIP digest, and extract the two expected files."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import sys
import tempfile
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, HTTPSHandler, Request
import zipfile

from release import CANDIDATE, UNSIGNED, checked_candidate, sha


class GitHubRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirect = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirect and urlsplit(redirect.full_url).scheme != "https":
            raise ValueError("Refusing an insecure artifact redirect")
        if redirect and urlsplit(req.full_url).netloc != urlsplit(redirect.full_url).netloc:
            redirect.remove_header("Authorization")
        return redirect


def request(url, token=None):
    headers = {"User-Agent": "Eva-public-release", "Accept": "application/vnd.github+json"}
    if token and urlsplit(url).hostname == "api.github.com":
        headers["Authorization"] = "Bearer " + token
    trust = ssl.create_default_context()
    debian_bundle = Path("/etc/ssl/certs/ca-certificates.crt")
    if not trust.get_ca_certs() and debian_bundle.is_file():
        trust.load_verify_locations(cafile=str(debian_bundle))
    return build_opener(HTTPSHandler(context=trust), GitHubRedirect()).open(Request(url, headers=headers), timeout=120)


def api(url, token):
    with request(url, token) as response:
        return json.load(response)


def identify(repository, run_id, attempt, token=None):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository) or run_id < 1 or (attempt is not None and attempt < 1):
        raise ValueError("Invalid repository, run ID or attempt")
    base = f"https://api.github.com/repos/{repository}/actions/runs/{run_id}"
    run = api(base + (f"/attempts/{attempt}" if attempt is not None else ""), token)
    if (run["id"] != run_id or run["event"] != "push" or run["conclusion"] != "success"
            or run["path"].split("@")[0] != ".github/workflows/release.yml"
            or run["head_repository"]["full_name"].lower() != repository.lower()):
        raise ValueError("Expected a successful candidate push in the public release workflow")
    attempt = run["run_attempt"]
    name = f"eva-candidate-{run_id}-{attempt}"
    matches = [a for a in api(base + "/artifacts?per_page=100&name=" + name, token)["artifacts"]
               if a["name"] == name and not a["expired"]]
    if len(matches) != 1:
        raise ValueError("The selected candidate artifact is missing or expired")
    artifact = matches[0]
    digest = artifact["digest"]
    if not digest.startswith("sha256:"):
        raise ValueError("GitHub did not provide its SHA-256 artifact digest")
    return run, artifact, sha(digest[7:])


def extract(archive, target, expected_hash, expected_size):
    if archive.stat().st_size != expected_size:
        raise ValueError("Artifact ZIP size differs from GitHub")
    with archive.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != expected_hash:
            raise ValueError("Artifact ZIP checksum differs from GitHub")
    with zipfile.ZipFile(archive) as z:
        if sorted(z.namelist()) != sorted([CANDIDATE, UNSIGNED]):
            raise ValueError("Unexpected files in candidate artifact")
        for name, limit in ((CANDIDATE, 4096), (UNSIGNED, 2_000_000_000)):
            entry = z.getinfo(name)
            if not 0 < entry.file_size <= limit or entry.flag_bits & 1:
                raise ValueError("Unexpected candidate artifact member")
            with z.open(entry) as source, (target / name).open("xb") as output:
                shutil.copyfileobj(source, output, 1024 * 1024)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("repository")
    ap.add_argument("run_id", type=int)
    ap.add_argument("output", type=Path)
    ap.add_argument("--attempt", type=int)
    source = ap.add_mutually_exclusive_group()
    source.add_argument("--archive", type=Path, help="already downloaded official artifact ZIP")
    source.add_argument("--public-relay", action="store_true", help="fallback for a public repository without GitHub sign-in")
    args = ap.parse_args()
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    run, artifact, digest = identify(args.repository, args.run_id, args.attempt, token)
    if args.output.exists():
        raise ValueError("Choose a new candidate output directory")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.output.parent) as temp:
        work = Path(temp)
        archive = args.archive
        if not archive:
            url = (f"https://nightly.link/{args.repository}/actions/runs/{args.run_id}/{artifact['name']}.zip"
                   if args.public_relay else artifact["archive_download_url"])
            archive = work / "artifact.zip"
            with request(url, None if args.public_relay else token) as source, archive.open("xb") as out:
                shutil.copyfileobj(source, out, 1024 * 1024)
        dest = work / "candidate"
        dest.mkdir()
        extract(archive, dest, digest, artifact["size_in_bytes"])
        data, _ = checked_candidate(dest)
        if (data["run_id"] != args.run_id or data["run_attempt"] != run["run_attempt"]
                or data["source_commit"] != run["head_sha"] or data["candidate_tag"] != run["head_branch"]):
            raise ValueError("Candidate receipt differs from its GitHub run")
        dest.rename(args.output)
    print(f"Verified GitHub ZIP {digest} and unsigned APK {data['unsigned_sha256']}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, HTTPError, zipfile.BadZipFile) as error:
        sys.exit(str(error))
