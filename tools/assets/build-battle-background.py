"""Build a runtime 960x540 pixel-art battle background from a source master."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def center_crop_16_9(image: Image.Image) -> Image.Image:
    width, height = image.size
    target = 16 / 9
    if width / height > target:
        new_width = round(height * target)
        left = (width - new_width) // 2
        return image.crop((left, 0, left + new_width, height))
    new_height = round(width / target)
    top = (height - new_height) // 2
    return image.crop((0, top, width, top + new_height))


def build(source: Path, output: Path) -> None:
    cropped = center_crop_16_9(Image.open(source).convert("RGB"))
    low = cropped.resize((480, 270), Image.Resampling.LANCZOS)
    low = low.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    runtime = low.resize((960, 540), Image.Resampling.NEAREST)
    output.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    build(args.source, args.output)


if __name__ == "__main__":
    main()
