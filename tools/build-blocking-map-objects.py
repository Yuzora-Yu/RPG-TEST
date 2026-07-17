#!/usr/bin/env python3
"""Normalize chroma-keyed generated objects into small runtime RGBA sprites."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_item(value: str) -> tuple[Path, str, int, int]:
    parts = value.rsplit(":", 3)
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("item must be SOURCE:NAME:WIDTH:HEIGHT")
    source, name, width, height = parts
    return Path(source), name, int(width), int(height)


def fit_alpha(source: Path, target: Path, width: int, height: int) -> None:
    image = Image.open(source).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"source has no opaque pixels: {source}")
    image = image.crop(bbox)
    image.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = (width - image.width) // 2
    y = height - image.height
    canvas.alpha_composite(image, (x, y))
    canvas.save(target, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--item", action="append", type=parse_item, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for source, name, width, height in args.item:
        fit_alpha(source, args.out_dir / f"{name}_v001.png", width, height)


if __name__ == "__main__":
    main()
