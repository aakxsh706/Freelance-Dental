"""Install the Python packages without pip.

A wheel is a zip file whose contents are laid out exactly as they should
appear in site-packages, so for pure-Python packages "installing" one is
extracting it. Every dependency in requirements-clinic.txt is pure Python -
no compiled extensions - which is what makes this legitimate rather than a
shortcut.

This matters because the self-contained Windows build ships Python's
embeddable package, which deliberately omits pip. Bootstrapping pip would
mean downloading get-pip.py, and the whole point is that this machine never
reaches the network.

Run with the embedded interpreter; it uses nothing outside the standard
library.
"""

import shutil
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
WHEELS = HERE / "wheels"


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: unpack_wheels.py <destination-directory>", file=sys.stderr)
        return 2

    target = Path(sys.argv[1]).resolve()

    if not WHEELS.is_dir():
        print(f"ERROR: no wheels directory at {WHEELS}", file=sys.stderr)
        print("This copy of the project is incomplete.", file=sys.stderr)
        return 1

    wheels = sorted(WHEELS.glob("*.whl"))
    if not wheels:
        print(f"ERROR: {WHEELS} contains no .whl files.", file=sys.stderr)
        return 1

    # Start clean so a reinstall cannot leave a half-replaced older version
    # shadowing the new one - the kind of fault that surfaces much later as an
    # inexplicable import error.
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)

    for wheel in wheels:
        with zipfile.ZipFile(wheel) as archive:
            archive.extractall(target)
        print(f"  {wheel.name}")

    print(f"\n{len(wheels)} packages unpacked into {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
