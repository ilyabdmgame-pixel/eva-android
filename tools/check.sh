#!/usr/bin/env bash
set -euo pipefail
eva_script=${BASH_SOURCE[0]}
[[ "$eva_script" == */* ]] || eva_script="./$eva_script"
cd "${eva_script%/*}/.."
TZ=Europe/Moscow node --test tests/*.test.cjs tests/pet/*.cjs tests/home/tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tools/check_java.py
