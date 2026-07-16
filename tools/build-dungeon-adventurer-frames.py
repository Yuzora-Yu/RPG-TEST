#!/usr/bin/env python3
"""Build the eight runtime dungeon-adventurer frames from a 4x2 alpha sheet."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


DIRECTIONS = ("down", "left", "right", "up")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--prefix", default="overlay_dungeon_adventurer")
    return parser.parse_args()


def fit_frame(cell: Image.Image) -> Image.Image:
    alpha = cell.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("sprite cell is fully transparent")
    sprite = cell.crop(bbox)
    scale = min(24 / sprite.width, 30 / sprite.height)
    size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    sprite = sprite.resize(size, Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    frame.alpha_composite(sprite, ((32 - size[0]) // 2, 31 - size[1]))
    return frame


def main() -> None:
    args = parse_args()
    sheet = Image.open(args.input).convert("RGBA")
    if sheet.width % 4 or sheet.height % 2:
        raise SystemExit("input must divide evenly into a 4x2 sheet")
    cell_width = sheet.width // 4
    cell_height = sheet.height // 2
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for row, step in enumerate((1, 2)):
        for column, direction in enumerate(DIRECTIONS):
            cell = sheet.crop((
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            ))
            frame = fit_frame(cell)
            output = args.output_dir / f"{args.prefix}_{direction}_{step}_v001.png"
            frame.save(output, optimize=True)
            print(f"Wrote {output} (32x32)")


if __name__ == "__main__":
    main()
