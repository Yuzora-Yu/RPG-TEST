"""Normalize generated category art into small transparent menu icons."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def normalize(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError(f"no visible pixels: {source}")

    cropped = image.crop(bbox)
    max_size = 54
    scale = min(max_size / cropped.width, max_size / cropped.height)
    size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    # Pixel art remains legible at the 64 px menu size with nearest-neighbour scaling.
    cropped = cropped.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    canvas.alpha_composite(cropped, ((64 - size[0]) // 2, (64 - size[1]) // 2))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("target_dir", type=Path)
    args = parser.parse_args()
    for key in ("attack", "buff", "debuff", "material"):
        normalize(
            args.source_dir / f"item-{key}-alpha-v001.png",
            args.target_dir / f"item-{key}-v001.png",
        )


if __name__ == "__main__":
    main()
