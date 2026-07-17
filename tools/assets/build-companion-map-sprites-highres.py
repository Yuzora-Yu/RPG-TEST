"""Build transparent, source-resolution companion map art from chroma-key masters.

The generated foreground is never resized.  It is only keyed, de-fringed and
bottom-centred on a square transparent canvas so the runtime renderer can scale
it once to the authored one-tile footprint without losing source detail first.
"""

from __future__ import annotations

import argparse
from collections import Counter, deque
from pathlib import Path

from PIL import Image


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return max(abs(a[i] - b[i]) for i in range(3))


def dominant_border_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    border: list[tuple[int, int, int]] = []
    for x in range(width):
        border.extend((rgb.getpixel((x, 0)), rgb.getpixel((x, height - 1))))
    for y in range(1, height - 1):
        border.extend((rgb.getpixel((0, y)), rgb.getpixel((width - 1, y))))
    return Counter(border).most_common(1)[0][0]


def remove_connected_chroma(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    key = dominant_border_color(rgba)
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(1, height - 1):
        queue.extend(((0, y), (width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        rgb = pixels[x, y][:3]
        if color_distance(rgb, key) > 92:
            continue
        pixels[x, y] = (*rgb, 0)
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    # Limbs, capes and weapons can enclose small islands of the flat key colour.
    # They are background as well, even though a border flood fill cannot reach them.
    for y in range(height):
        for x in range(width):
            r, g, b, alpha = pixels[x, y]
            if alpha and color_distance((r, g, b), key) <= 92:
                pixels[x, y] = (r, g, b, 0)

    # Remove only chroma-coloured edge pixels which touch removed background.
    source = rgba.copy()
    source_pixels = source.load()
    for y in range(height):
        for x in range(width):
            r, g, b, alpha = source_pixels[x, y]
            if not alpha:
                continue
            touches_transparent = any(
                0 <= nx < width and 0 <= ny < height and source_pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if touches_transparent and color_distance((r, g, b), key) <= 138:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def build(source: Path, output: Path, padding: int = 24) -> None:
    keyed = remove_connected_chroma(Image.open(source))
    bbox = keyed.getbbox()
    if not bbox:
        raise ValueError(f"No foreground remained after chroma removal: {source}")
    foreground = keyed.crop(bbox)
    side = max(keyed.width, keyed.height, foreground.width + padding * 2, foreground.height + padding * 2)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x = (side - foreground.width) // 2
    y = side - padding - foreground.height
    canvas.alpha_composite(foreground, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--padding", type=int, default=24)
    args = parser.parse_args()
    build(args.source, args.output, max(0, args.padding))


if __name__ == "__main__":
    main()
