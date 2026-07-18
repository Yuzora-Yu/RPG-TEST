"""Build small, transparent map-event markers from managed source art."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def build_blue_glimmer(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"no visible pixels: {source}")

    cropped = image.crop(bbox)
    max_size = 18
    scale = min(max_size / cropped.width, max_size / cropped.height)
    size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    cropped = cropped.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    canvas.alpha_composite(cropped, ((32 - size[0]) // 2, (32 - size[1]) // 2))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    build_blue_glimmer(args.source, args.target)


if __name__ == "__main__":
    main()
