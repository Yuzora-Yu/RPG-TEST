"""Normalize generated item-menu category art into transparent 64 px icons."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CATEGORY_KEYS = (
    "vehicle",
    "travel",
    "heal",
    "revive",
    "growth",
    "key",
)


def keep_largest_alpha_component(image: Image.Image) -> Image.Image:
    """Discard isolated chroma-removal specks before measuring visual bounds."""
    alpha = image.getchannel("A")
    width, height = image.size
    opaque = alpha.load()
    visited: set[tuple[int, int]] = set()
    largest: list[tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            if opaque[x, y] < 128 or (x, y) in visited:
                continue
            component: list[tuple[int, int]] = []
            stack = [(x, y)]
            visited.add((x, y))
            while stack:
                cx, cy = stack.pop()
                component.append((cx, cy))
                for ny in range(max(0, cy - 1), min(height, cy + 2)):
                    for nx in range(max(0, cx - 1), min(width, cx + 2)):
                        if (nx, ny) in visited or opaque[nx, ny] < 128:
                            continue
                        visited.add((nx, ny))
                        stack.append((nx, ny))
            if len(component) > len(largest):
                largest = component

    if not largest:
        raise ValueError("no opaque icon component")
    keep = set(largest)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            if (x, y) not in keep:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
    return image


def normalize(source: Path, target: Path) -> None:
    image = keep_largest_alpha_component(Image.open(source).convert("RGBA"))
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"no visible pixels: {source}")

    cropped = image.crop(bbox)
    max_size = 52
    scale = min(max_size / cropped.width, max_size / cropped.height)
    size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    cropped = cropped.resize(size, Image.Resampling.NEAREST)
    # Nearest-neighbour downscaling can drop a one-pixel source speck that
    # affected the first crop. Measure the final visible shape once more so
    # the icon itself, rather than its source canvas, is exactly centered.
    final_bbox = cropped.getchannel("A").getbbox()
    if not final_bbox:
        raise ValueError(f"icon disappeared while resizing: {source}")
    cropped = cropped.crop(final_bbox)
    size = cropped.size
    canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    canvas.alpha_composite(cropped, ((64 - size[0]) // 2, (64 - size[1]) // 2))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("target_dir", type=Path)
    args = parser.parse_args()
    for key in CATEGORY_KEYS:
        normalize(
            args.source_dir / f"item-{key}-alpha-v001.png",
            args.target_dir / f"item-{key}-v001.png",
        )


if __name__ == "__main__":
    main()
