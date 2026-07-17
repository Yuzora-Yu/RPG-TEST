"""Build reproducible 64x64 transparent companion map sprites from chroma sources."""

from __future__ import annotations

import argparse
from collections import Counter, deque
from pathlib import Path

from PIL import Image


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return max(abs(a[i] - b[i]) for i in range(3))


def dominant_border_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    w, h = rgb.size
    border = []
    for x in range(w):
        border.extend((rgb.getpixel((x, 0)), rgb.getpixel((x, h - 1))))
    for y in range(1, h - 1):
        border.extend((rgb.getpixel((0, y)), rgb.getpixel((w - 1, y))))
    return Counter(border).most_common(1)[0][0]


def remove_connected_chroma(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    key = dominant_border_color(rgba)
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()

    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(1, h - 1):
        queue.append((0, y))
        queue.append((w - 1, y))

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
        if x + 1 < w:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < h:
            queue.append((x, y + 1))

    # Remove one-pixel chroma fringe only where it touches transparent background.
    source = rgba.copy()
    source_pixels = source.load()
    for y in range(h):
        for x in range(w):
            r, g, b, alpha = source_pixels[x, y]
            if not alpha:
                continue
            touches_transparent = any(
                0 <= nx < w and 0 <= ny < h and source_pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if touches_transparent and color_distance((r, g, b), key) <= 138:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def build(source: Path, output: Path) -> None:
    keyed = remove_connected_chroma(Image.open(source))
    bbox = keyed.getbbox()
    if not bbox:
        raise ValueError(f"No foreground remained after chroma removal: {source}")
    cropped = keyed.crop(bbox)
    max_w, max_h = 58, 60
    scale = min(max_w / cropped.width, max_h / cropped.height)
    size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    sprite = cropped.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    x = (64 - size[0]) // 2
    y = 62 - size[1]
    canvas.alpha_composite(sprite, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    build(args.source, args.output)


if __name__ == "__main__":
    main()
