"""Build seamless Wind Temple tiles and pixel-art battle backgrounds."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def center_crop(image: Image.Image, ratio: float) -> Image.Image:
    width, height = image.size
    current = width / height
    if current > ratio:
        new_width = round(height * ratio)
        left = (width - new_width) // 2
        return image.crop((left, 0, left + new_width, height))
    new_height = round(width / ratio)
    top = (height - new_height) // 2
    return image.crop((0, top, width, top + new_height))


def build_tile(source: Path, output: Path) -> None:
    raw = center_crop(Image.open(source).convert("RGB"), 1.0)
    sample = raw.resize((128, 128), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (256, 256))
    canvas.paste(sample, (0, 0))
    canvas.paste(sample.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (128, 0))
    canvas.paste(sample.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, 128))
    canvas.paste(sample.transpose(Image.Transpose.ROTATE_180), (128, 128))
    canvas = canvas.quantize(colors=56, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True)


def build_battle(source: Path, output: Path) -> None:
    raw = center_crop(Image.open(source).convert("RGB"), 16 / 9)
    low = raw.resize((480, 270), Image.Resampling.LANCZOS)
    low = low.quantize(colors=112, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    runtime = low.resize((960, 540), Image.Resampling.NEAREST)
    output.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--floor-source", required=True, type=Path)
    parser.add_argument("--wall-source", required=True, type=Path)
    parser.add_argument("--indoor-battle-source", required=True, type=Path)
    parser.add_argument("--ruins-battle-source", required=True, type=Path)
    parser.add_argument("--project-root", required=True, type=Path)
    args = parser.parse_args()
    build_tile(args.floor_source, args.project_root / "assets/map/terrain/tile_wind_temple_floor.png")
    build_tile(args.wall_source, args.project_root / "assets/map/terrain/tile_wind_temple_wall.png")
    build_battle(args.indoor_battle_source, args.project_root / "assets/generated/battle-wind-temple.png")
    build_battle(args.ruins_battle_source, args.project_root / "assets/generated/battle-mountain-wind-ruins.png")


if __name__ == "__main__":
    main()
