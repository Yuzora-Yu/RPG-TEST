from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


TILE_SIZE = 32


def subject_bbox(image: Image.Image, key: str) -> tuple[int, int, int, int]:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    mask = Image.new("1", rgb.size, 0)
    out = mask.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = pixels[x, y]
            if key == "green":
                background = g > 150 and g > r * 2 and g > b * 2
            else:
                background = r > 145 and b > 145 and g < min(r, b) * 0.62
            out[x, y] = 0 if background else 1
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError(f"Could not isolate subject from {key} chroma background")
    return bbox


def pixel_asset(image: Image.Image, size: tuple[int, int], colors: int) -> Image.Image:
    resized = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    return resized.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def crop_connected_parts(source: Path, key: str, edge: int) -> dict[str, Image.Image]:
    image = Image.open(source).convert("RGBA")
    left, top, right, bottom = subject_bbox(image, key)
    carpet = image.crop((left, top, right, bottom))
    width, height = carpet.size

    border_x = max(8, round(width * 0.085))
    border_y = max(8, round(height * 0.045))
    inner = carpet.crop((border_x, border_y, width - border_x, height - border_y))
    sample_side = min(inner.width, inner.height, max(64, round(width * 0.52)))
    sample_left = max(0, (inner.width - sample_side) // 2)
    sample_top = max(0, (inner.height - sample_side) // 2)
    fill_sample = inner.crop((sample_left, sample_top, sample_left + sample_side, sample_top + sample_side))

    middle_x0 = round(width * 0.22)
    middle_x1 = round(width * 0.78)
    middle_y0 = round(height * 0.22)
    middle_y1 = round(height * 0.78)
    corner_x = max(border_x, round(width * 0.14))
    corner_y = max(border_y, round(height * 0.07))

    return {
        "fill": pixel_asset(fill_sample, (TILE_SIZE, TILE_SIZE), 24),
        "edge_n": pixel_asset(carpet.crop((middle_x0, 0, middle_x1, border_y)), (TILE_SIZE, edge), 12),
        "edge_s": pixel_asset(carpet.crop((middle_x0, height - border_y, middle_x1, height)), (TILE_SIZE, edge), 12),
        "edge_w": pixel_asset(carpet.crop((0, middle_y0, border_x, middle_y1)), (edge, TILE_SIZE), 12),
        "edge_e": pixel_asset(carpet.crop((width - border_x, middle_y0, width, middle_y1)), (edge, TILE_SIZE), 12),
        "corner_nw": pixel_asset(carpet.crop((0, 0, corner_x, corner_y)), (edge, edge), 10),
        "corner_ne": pixel_asset(carpet.crop((width - corner_x, 0, width, corner_y)), (edge, edge), 10),
        "corner_sw": pixel_asset(carpet.crop((0, height - corner_y, corner_x, height)), (edge, edge), 10),
        "corner_se": pixel_asset(carpet.crop((width - corner_x, height - corner_y, width, height)), (edge, edge), 10),
    }


def save_set(parts: dict[str, Image.Image], output_dir: Path, prefix: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for suffix, image in parts.items():
        image.save(output_dir / f"{prefix}_{suffix}_v001.png", optimize=True)


def load_set(output_dir: Path, prefix: str) -> dict[str, Image.Image]:
    return {
        suffix: Image.open(output_dir / f"{prefix}_{suffix}_v001.png").convert("RGBA")
        for suffix in [
            "fill", "edge_n", "edge_s", "edge_w", "edge_e",
            "corner_nw", "corner_ne", "corner_sw", "corner_se",
        ]
    }


def render_preview(parts: dict[str, Image.Image], width_tiles: int, height_tiles: int) -> Image.Image:
    width = width_tiles * TILE_SIZE
    height = height_tiles * TILE_SIZE
    preview = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    fill = parts["fill"].resize((TILE_SIZE + 2, TILE_SIZE + 2), Image.Resampling.NEAREST)
    edge_w = parts["edge_w"].resize((parts["edge_w"].width, TILE_SIZE + 2), Image.Resampling.NEAREST)
    edge_e = parts["edge_e"].resize((parts["edge_e"].width, TILE_SIZE + 2), Image.Resampling.NEAREST)
    for tile_y in range(height_tiles):
        for tile_x in range(width_tiles):
            preview.alpha_composite(fill, (tile_x * TILE_SIZE - 1, tile_y * TILE_SIZE - 2))
        # Runtime depth advances by 100 per row, so each row's side trim must redraw the
        # two-pixel upward overlap after that row's fill.
        preview.alpha_composite(edge_w, (0, tile_y * TILE_SIZE - 2))
        preview.alpha_composite(edge_e, (width - edge_e.width, tile_y * TILE_SIZE - 2))
        if tile_y == 0:
            for tile_x in range(width_tiles):
                preview.alpha_composite(parts["edge_n"], (tile_x * TILE_SIZE, 0))
        if tile_y == height_tiles - 1:
            for tile_x in range(width_tiles):
                preview.alpha_composite(parts["edge_s"], (tile_x * TILE_SIZE, height - parts["edge_s"].height))
    preview.alpha_composite(parts["corner_nw"], (0, 0))
    preview.alpha_composite(parts["corner_ne"], (width - parts["corner_ne"].width, 0))
    preview.alpha_composite(parts["corner_sw"], (0, height - parts["corner_sw"].height))
    preview.alpha_composite(parts["corner_se"], (width - parts["corner_se"].width, height - parts["corner_se"].height))
    return preview


def main() -> None:
    parser = argparse.ArgumentParser(description="Build connected JRPG carpet/goza overlay tile sets from generated source art.")
    parser.add_argument("--blue-source", required=True, type=Path)
    parser.add_argument("--goza-source", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--preview", required=True, type=Path)
    args = parser.parse_args()

    blue = crop_connected_parts(args.blue_source, "green", edge=4)
    goza = crop_connected_parts(args.goza_source, "magenta", edge=3)
    save_set(blue, args.output_dir, "overlay_castle_carpet_blue_silver")
    save_set(goza, args.output_dir, "overlay_village_goza")

    red = load_set(args.output_dir, "overlay_castle_carpet")
    canvas = Image.new("RGBA", (480, 288), (17, 21, 29, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((16, 10), "RED / GOLD", fill=(225, 232, 240, 255))
    canvas.alpha_composite(render_preview(red, 3, 7), (16, 32))
    draw.text((144, 10), "BLUE / SILVER", fill=(225, 232, 240, 255))
    canvas.alpha_composite(render_preview(blue, 3, 7), (144, 32))
    draw.text((272, 10), "GOZA", fill=(225, 232, 240, 255))
    canvas.alpha_composite(render_preview(goza, 6, 4), (272, 32))
    args.preview.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.preview, optimize=True)


if __name__ == "__main__":
    main()
