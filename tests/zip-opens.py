"""Does the archive our own writer produced actually open?

Python's zipfile shares no code with src/lib/zip.ts, so this is the part of the
test that could fail. Run tests/zip.test.mjs first — it writes the archive this
reads.

    node --import ./tests/register.mjs --test tests/zip.test.mjs
    python tests/zip-opens.py
"""
import os
import sys
import tempfile
import zipfile

sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

PATH = os.path.join(tempfile.gettempdir(), "servolia-zip-test", "made.zip")
EXPECTED = {
    "index.html": "<h1>Bonjour — hello</h1>\n",
    "css/style.css": "body{color:red}" * 80,
    "img/été.txt": "accented name",
    "empty.txt": "",
}

fails = []


def ck(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  -- {detail}" if detail else ""))
    if not ok:
        fails.append(name)


if not os.path.exists(PATH):
    print(f"no archive at {PATH} — run tests/zip.test.mjs first")
    sys.exit(1)

ck("the file is recognised as a zip", zipfile.is_zipfile(PATH))

with zipfile.ZipFile(PATH) as z:
    # testzip() verifies every CRC. A wrong CRC is the classic hand-rolled-zip
    # bug: the archive opens, the files look right, and they are corrupt.
    ck("every checksum is right", z.testzip() is None, str(z.testzip()))
    ck("all four names are there", sorted(z.namelist()) == sorted(EXPECTED), str(z.namelist()))
    for name, want in EXPECTED.items():
        got = z.read(name).decode("utf-8")
        ck(f"{name} comes back byte for byte", got == want, f"{len(got)} chars vs {len(want)}")
    info = {i.filename: i for i in z.infolist()}
    ck("the compressible file was deflated", info["css/style.css"].compress_type == zipfile.ZIP_DEFLATED)
    ck("the accented name survived", "img/été.txt" in z.namelist())
    ck("nothing escapes the archive", not any(n.startswith(("/", "..")) or "\\" in n for n in z.namelist()))

print("FAILED:", fails if fails else "none")
sys.exit(1 if fails else 0)
