"""Preserve the CLI package and add the source/font license notices."""
from pathlib import Path
import sys
from zipfile import ZipFile, ZIP_DEFLATED

target, root = (Path(value).resolve() for value in sys.argv[1:])
release_dir = root / ".local" / "release"
if target.parent != release_dir or target.suffix != ".zip":
    raise ValueError("The package must be a ZIP in this project's .local/release")

parts = ["Brewbench source and third-party notices\nhttps://github.com/fullstack-nick/brewbench"]
for title, relative in [
    ("SHOPIFY DAWN THEME LICENSE", "theme/LICENSE.md"),
    ("BREWBENCH ORIGINAL CONTRIBUTIONS", "LICENSE"),
    ("LORA FONT LICENSE", "design/licenses/lora-OFL.txt"),
    ("DM SANS FONT LICENSE", "design/licenses/dmsans-OFL.txt"),
]:
    parts.append(title + "\n" + (root / relative).read_text(encoding="utf-8"))

notice_name = "assets/brewbench-third-party-notices.txt"
temporary = target.with_suffix(".licensed.zip")
with ZipFile(target) as source, ZipFile(temporary, "w", ZIP_DEFLATED) as output:
    if source.testzip() is not None:
        raise ValueError("Shopify's package failed its CRC check")
    for entry in source.infolist():
        if entry.filename != notice_name:
            output.writestr(entry, source.read(entry.filename))
    output.writestr(notice_name, "\n\n".join(parts))

with ZipFile(temporary) as result:
    if result.testzip() is not None:
        raise ValueError("The licensed package failed its CRC check")
    checked = 0
    for entry in result.infolist():
        if entry.is_dir() or entry.filename == notice_name:
            continue
        if result.read(entry.filename) != (root / "theme" / entry.filename).read_bytes():
            raise ValueError(f"Packaged theme differs from source: {entry.filename}")
        checked += 1
temporary.replace(target)
print(f"Verified {checked} theme files and bundled theme/font licenses.")
