#!/usr/bin/env python3
"""Compile and run JVM tests for the Android application."""
from pathlib import Path
import os
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parents[1]
    tests = sorted((root / "tests").glob("*/*Test.java"))
    jdk = Path(os.environ["JAVA_HOME"], "bin") if os.environ.get("JAVA_HOME") else None
    def tool(name):
        return jdk / name if jdk else name
    with tempfile.TemporaryDirectory(prefix="eva-java-tests-") as tmp:
        subprocess.run([tool("javac"), "-encoding", "UTF-8", "--release", "17",
                        "-sourcepath", root / "app/src/main/src", "-d", tmp, *tests], check=True)
        for test in tests:
            subprocess.run([tool("java"), "-cp", tmp, "ru.eva.envtest." + test.stem], check=True, cwd=root)
    print(f"{len(tests)} Java suites passed.")


if __name__ == "__main__":
    main()
