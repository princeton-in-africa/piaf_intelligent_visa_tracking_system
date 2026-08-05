"""
Build the app's logo assets from the Princeton in Africa lockup.

Input:
    frontend/public/piaf-logo.jpeg   the full stacked lockup (mark + wordmark)

Output:
    frontend/public/piaf-mark.png        just the Africa mark, white keyed out
    frontend/public/favicon.ico          multi-size ICO (16/32/48)
    frontend/public/apple-touch-icon.png 180x180 on a white tile

Why the mark is separated out: the supplied logo is a square lockup with
"PRINCETON IN AFRICA" set beneath the mark. At the ~30px a sidebar or a browser
tab gives you, that wordmark is an illegible smudge. Every product with a
stacked logo uses the icon alone at small sizes, so that is what this produces.

The source is a JPEG on solid white, so the white is keyed to transparency and
the colour is un-premultiplied to avoid leaving a pale halo around the artwork.

Re-run after replacing the logo:
    python3 frontend/scripts/make_favicon.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# Anything at or above this per-channel value counts as background.
WHITE_CUTOFF = 246


def load_source():
    for name in ("piaf-logo.jpeg", "piaf-logo.jpg", "piaf-logo.png"):
        path = PUBLIC / name
        if path.exists():
            return Image.open(path).convert("RGB"), path
    raise SystemExit(f"No piaf-logo.(jpeg|jpg|png) found in {PUBLIC}")


def content_bands(rgb):
    """Row ranges that contain artwork, split by the gaps of pure white."""
    arr = np.asarray(rgb).astype(int)
    ink = arr.sum(axis=2) < WHITE_CUTOFF * 3
    rows = ink.any(axis=1)

    bands, start = [], None
    for index, filled in enumerate(rows):
        if filled and start is None:
            start = index
        elif not filled and start is not None:
            bands.append((start, index - 1))
            start = None
    if start is not None:
        bands.append((start, len(rows) - 1))

    return bands, ink


def key_out_white(rgb):
    """
    Turn the white background transparent.

    Alpha comes from how far the darkest channel sits from white, then the
    colour is un-premultiplied so anti-aliased edges keep their true hue
    instead of staying washed out against a dark background.
    """
    arr = np.asarray(rgb).astype(np.float64)
    alpha = 255.0 - arr.min(axis=2)

    safe = np.maximum(alpha, 1.0)[..., None] / 255.0
    unpremultiplied = (arr - 255.0 * (1.0 - safe)) / safe

    rgba = np.dstack(
        [np.clip(unpremultiplied, 0, 255), np.clip(alpha, 0, 255)]
    ).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def trim(image):
    bbox = image.getbbox()
    return image.crop(bbox) if bbox else image


def square(art, size, margin_ratio=0.08, background=None):
    """Centre the artwork on a square canvas with an even margin."""
    inner = max(int(size * (1 - margin_ratio * 2)), 1)
    scaled = art.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    canvas.paste(
        scaled,
        ((size - scaled.width) // 2, (size - scaled.height) // 2),
        scaled,
    )
    return canvas


def main():
    rgb, source = load_source()
    print(f"source: {source.name} {rgb.size[0]}x{rgb.size[1]}")

    bands, _ = content_bands(rgb)
    if not bands:
        raise SystemExit("The logo appears to be blank.")

    # The mark is the tallest band; the wordmark below it splits into several
    # short bands (one per line of type).
    top, bottom = max(bands, key=lambda band: band[1] - band[0])
    print(f"mark occupies rows {top}-{bottom} of {rgb.size[1]}")

    mark = trim(key_out_white(rgb.crop((0, top, rgb.width, bottom + 1))))
    mark_path = PUBLIC / "piaf-mark.png"
    mark.save(mark_path, format="PNG", optimize=True)
    print(f"wrote {mark_path.name} ({mark.width}x{mark.height}, transparent)")

    # Favicons sit on white so the orange mark stays visible in both light and
    # dark browser chrome.
    ico_path = PUBLIC / "favicon.ico"
    square(mark, 256, margin_ratio=0.06, background=(255, 255, 255, 255)).save(
        ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print(f"wrote {ico_path.name} (16/32/48)")

    apple_path = PUBLIC / "apple-touch-icon.png"
    square(mark, 180, margin_ratio=0.12, background=(255, 255, 255, 255)).save(
        apple_path, format="PNG", optimize=True
    )
    print(f"wrote {apple_path.name} (180x180)")


if __name__ == "__main__":
    main()
