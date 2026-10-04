"""Shrink photos uploaded through the editor so phone pictures don't slow the site.

Anything in assets/uploads that is wider or taller than 1600px, or still carries
camera metadata (EXIF, including GPS location), is rotated upright, resized to fit
1600px, stripped of that metadata and re-saved with web compression. File names and
formats stay the same, so the links in data/weekly.json keep working.

Already-processed photos have no EXIF and fit in 1600px, so they are left alone
(re-running never re-compresses them).
"""
import pathlib
import sys

from PIL import Image, ImageOps

MAX_SIDE = 1600
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "assets/uploads")
FORMATS = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}

changed = []
for path in sorted(ROOT.rglob("*")):
    fmt = FORMATS.get(path.suffix.lower())
    if not fmt or not path.is_file():
        continue
    with Image.open(path) as im:
        if max(im.size) <= MAX_SIDE and not im.getexif():
            continue
        before = path.stat().st_size
        icc = im.info.get("icc_profile")
        out = ImageOps.exif_transpose(im)  # apply the camera's rotation before dropping EXIF
        out.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        params = {"icc_profile": icc} if icc else {}
        if fmt == "JPEG":
            out = out.convert("RGB")
            params.update(quality=82, optimize=True, progressive=True)
        elif fmt == "WEBP":
            params.update(quality=80, method=6)
        else:
            params.update(optimize=True)
        tmp = path.with_name(path.name + ".tmp")
        out.save(tmp, fmt, **params)
    tmp.replace(path)
    changed.append(f"{path}: {before // 1024} KB -> {path.stat().st_size // 1024} KB")

print("\n".join(changed) if changed else "No photos needed shrinking.")
