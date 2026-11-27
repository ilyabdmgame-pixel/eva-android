#!/usr/bin/env python3
"""Check tracked paths and text blobs for private Eva state before publication."""
import argparse
import os
from pathlib import Path
import re
import subprocess

from audit_apk import clean_path

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".md", ".py", ".sh", ".js", ".cjs", ".mjs", ".java", ".json", ".xml", ".toml",
                 ".gradle", ".yaml", ".yml", ".tsv", ".txt", ".css", ".html", ".properties", ".asc"}
SECRET = re.compile(rb"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bgithub_pat_[A-Za-z0-9_]{22,}"
                    rb"|\bgh[pousr]_[A-Za-z0-9]{25,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}"
                    rb"|\bAKIA[A-Z0-9]{16}\b")
PRIVATE_LOCAL = re.compile(rb"/sdcard/Documents/Codex/\d{12,}-|/root/[a-z0-9._-]+-(?:ssh|vpn)-(?:recovery|credentials?)/")


def git(*args, **kwargs):
    return subprocess.check_output([os.getenv("EVA_GIT_BIN", "git"), *args], cwd=ROOT, **kwargs)


def check_blob(name, content):
    if SECRET.search(content) or PRIVATE_LOCAL.search(content):
        raise ValueError(f"Possible private content in {name}. Inspect locally before publishing.")


def verify(history=False):
    if history:
        entries = git("rev-list", "--objects", "--all").decode().splitlines()
        files = [entry.split(" ", 1) for entry in entries if " " in entry]
        paths = set(git("log", "--all", "--format=", "--name-only", "--no-renames", "-z")
                    .decode().split("\0"))
    else:
        rows = git("ls-files", "-s", "-z").decode().rstrip("\0").split("\0")
        files = [(row.split("\t", 1)[0].split()[1], row.split("\t", 1)[1]) for row in rows if row]
        paths = {name for _, name in files}
    for name in paths:
        if name:
            clean_path(name)
    text = {}
    for oid, name in files:
        if Path(name).suffix.lower() in TEXT_SUFFIXES or name in {"LICENSE", ".gitignore"}:
            text[oid] = name
    # A single process keeps a history scan inexpensive, even with thousands of small blobs.
    with subprocess.Popen([os.getenv("EVA_GIT_BIN", "git"), "cat-file", "--batch"],
                          cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE) as reader:
        try:
            for oid, name in text.items():
                reader.stdin.write(oid.encode("ascii")+b"\n")
                reader.stdin.flush()
                header = reader.stdout.readline().split()
                if len(header) != 3:
                    raise ValueError("Unavailable tracked object: " + name)
                content = reader.stdout.read(int(header[2]))
                if reader.stdout.read(1) != b"\n":
                    raise ValueError("Incomplete tracked object: " + name)
                if header[1] == b"blob":
                    check_blob(name, content)
        finally:
            reader.stdin.close()
    if reader.returncode != 0:
        raise ValueError("Git could not finish reading tracked objects")
    print(f"Checked {len(files)} tracked objects and {len(text)} text entries for private data.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", action="store_true")
    try:
        verify(parser.parse_args().history)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
