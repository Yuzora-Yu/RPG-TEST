#!/usr/bin/env python3
"""Build runtime-sized map overlays from image-generation source atlases.

The image-generation outputs are kept outside the game. This tool consumes
already chroma-keyed RGBA atlases and emits deterministic 32 px runtime assets.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


DECOR_A = (
    "start_cave_damp",
    "fire_ember_fissure",
    "wind_hole_root",
    "forbidden_forest_moss",
    "big_tower_gear_oil",
    "thunder_fort_wiring",
    "light_palace_prism",
    "galvania_crystal",
    "dark_castle_chain",
)

DECOR_B = (
    "crena_limestone_pool",
    "seabed_temple_ripple",
    "dark_shrine_sigil",
    "grezelia_fossil",
    "abyss_void_dust",
    "ruined_shrine_glyph",
    "start_village_herbs",
    "wind_village_feather",
    "water_city_puddle",
)

DECOR_C = (
    "default_cave_dust",
    "abyss_field_flora",
)

DOORS = ("red", "blue", "gold")


def split_grid(image: Image.Image, columns: int, rows: int):
    width, height = image.size
    for index in range(columns * rows):
        column = index % columns
        row = index // columns
        left = round(width * column / columns)
        right = round(width * (column + 1) / columns)
        top = round(height * row / rows)
        bottom = round(height * (row + 1) / rows)
        yield image.crop((left, top, right, bottom))


def save_fit(cell: Image.Image, target: Path, size: tuple[int, int], crop_alpha: bool = False):
    cell = cell.convert("RGBA")
    if crop_alpha:
        bbox = cell.getchannel("A").getbbox()
        if bbox:
            cell = cell.crop(bbox)
    cell.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - cell.width) // 2
    y = (size[1] - cell.height) // 2
    canvas.alpha_composite(cell, (x, y))
    canvas.save(target, optimize=True)


def build_decor(atlas_path: Path, names: tuple[str, ...], columns: int, rows: int, out_dir: Path):
    atlas = Image.open(atlas_path).convert("RGBA")
    cells = tuple(split_grid(atlas, columns, rows))
    if len(cells) != len(names):
        raise ValueError(f"atlas/name mismatch: {len(cells)} cells, {len(names)} names")
    for name, cell in zip(names, cells):
        save_fit(cell, out_dir / f"overlay_decor_{name}_v001.png", (32, 32))


def build_doors(atlas_path: Path, out_dir: Path):
    atlas = Image.open(atlas_path).convert("RGBA")
    for name, cell in zip(DOORS, split_grid(atlas, 3, 1)):
        # Doors intentionally occupy the complete blocking tile.
        save_fit(cell, out_dir / f"door_key_{name}_v003.png", (32, 32), crop_alpha=True)


def proportional_crop(image: Image.Image, box: tuple[float, float, float, float]) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("carpet source has no opaque pixels")
    left, top, right, bottom = bbox
    width, height = right - left, bottom - top
    x1, y1, x2, y2 = box
    return image.crop((
        round(left + width * x1),
        round(top + height * y1),
        round(left + width * x2),
        round(top + height * y2),
    ))


def build_carpet(source_path: Path, out_dir: Path):
    image = Image.open(source_path).convert("RGBA")
    pieces = {
        "fill": ((0.055, 0.055, 0.945, 0.945), (32, 32)),
        "edge_n": ((0.055, 0.000, 0.945, 0.055), (32, 4)),
        "edge_s": ((0.055, 0.945, 0.945, 1.000), (32, 4)),
        "edge_w": ((0.000, 0.055, 0.055, 0.945), (4, 32)),
        "edge_e": ((0.945, 0.055, 1.000, 0.945), (4, 32)),
        "corner_nw": ((0.000, 0.000, 0.075, 0.075), (4, 4)),
        "corner_ne": ((0.925, 0.000, 1.000, 0.075), (4, 4)),
        "corner_sw": ((0.000, 0.925, 0.075, 1.000), (4, 4)),
        "corner_se": ((0.925, 0.925, 1.000, 1.000), (4, 4)),
    }
    for name, (box, size) in pieces.items():
        crop = proportional_crop(image, box)
        crop.resize(size, Image.Resampling.LANCZOS).save(
            out_dir / f"overlay_castle_carpet_{name}_v001.png", optimize=True
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--decor-a", type=Path, required=True)
    parser.add_argument("--decor-b", type=Path, required=True)
    parser.add_argument("--decor-c", type=Path, required=True)
    parser.add_argument("--doors", type=Path, required=True)
    parser.add_argument("--carpet", type=Path, required=True)
    parser.add_argument("--overlays-out", type=Path, required=True)
    parser.add_argument("--objects-out", type=Path, required=True)
    args = parser.parse_args()
    args.overlays_out.mkdir(parents=True, exist_ok=True)
    args.objects_out.mkdir(parents=True, exist_ok=True)

    build_decor(args.decor_a, DECOR_A, 3, 3, args.overlays_out)
    build_decor(args.decor_b, DECOR_B, 3, 3, args.overlays_out)
    build_decor(args.decor_c, DECOR_C, 2, 1, args.overlays_out)
    build_doors(args.doors, args.objects_out)
    build_carpet(args.carpet, args.overlays_out)


if __name__ == "__main__":
    main()
