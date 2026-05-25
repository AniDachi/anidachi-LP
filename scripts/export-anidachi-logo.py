#!/usr/bin/env python3
"""Rebuild public/Anidachi_logo.png with transparent background (circular crop)."""
from __future__ import annotations

import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = (
    ROOT.parent.parent
    / "assets"
    / "ChatGPT_Image_May_25__2026__09_38_05_PM-1d17330b-3f1b-4ebf-b999-7768802af02f.png"
)
# Fallback when run from repo root (Cursor assets path)
if not SRC.exists():
    SRC = Path(
        "/Users/macgeorge/.cursor/projects/Users-macgeorge-Downloads-VibeProjects-anidachi-LP-anidachi/assets/ChatGPT_Image_May_25__2026__09_38_05_PM-1d17330b-3f1b-4ebf-b999-7768802af02f.png"
    )

OUT = ROOT / "public" / "Anidachi_logo.png"
APP_ICON = ROOT / "app" / "icon.png"
APP_APPLE = ROOT / "app" / "apple-icon.png"
APP_FAVICON = ROOT / "app" / "favicon.ico"
PUBLIC_FAVICON = ROOT / "public" / "favicon.ico"


def bg_like(rgb: tuple[int, int, int], tol: int = 45) -> bool:
    return max(rgb) < 30 or all(abs(c - b) <= tol for c, b in zip(rgb, (0, 0, 0)))


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()

    q = deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    seen = set(q)
    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        if bg_like((r, g, b)):
            px[x, y] = (0, 0, 0, 0)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                    seen.add((nx, ny))
                    q.append((nx, ny))

    coords = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] > 10]
    cx = sum(x for x, _ in coords) / len(coords)
    cy = sum(y for _, y in coords) / len(coords)
    radius = max(math.hypot(x - cx, y - cy) for x, y in coords) + 2

    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)

    bbox = out.getbbox()
    if bbox:
        pad = 4
        x0, y0, x1, y1 = bbox
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(w, x1 + pad), min(h, y1 + pad)
        side = max(x1 - x0, y1 - y0)
        cx_i, cy_i = (x0 + x1) // 2, (y0 + y1) // 2
        x0, y0 = max(0, cx_i - side // 2), max(0, cy_i - side // 2)
        x1, y1 = min(w, x0 + side), min(h, y0 + side)
        out = out.crop((x0, y0, x1, y1))

    out = out.resize((512, 512), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)

    out.resize((32, 32), Image.Resampling.LANCZOS).save(APP_ICON, optimize=True)
    out.resize((180, 180), Image.Resampling.LANCZOS).save(APP_APPLE, optimize=True)
    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    ico_images = [out.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
    ico_images[0].save(
        APP_FAVICON,
        format="ICO",
        sizes=[(im.width, im.height) for im in ico_images],
        append_images=ico_images[1:],
    )
    PUBLIC_FAVICON.write_bytes(APP_FAVICON.read_bytes())

    print(f"Wrote {OUT} ({out.mode} {out.size})")
    print(f"Wrote tab icons: {APP_ICON.name}, {APP_FAVICON.name}, {APP_APPLE.name}")


if __name__ == "__main__":
    main()
