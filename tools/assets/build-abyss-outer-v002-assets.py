"""Build the second authored Abyss Outer Rim visual set.

v002 keeps the accepted wall, ritual floor, chasm and altar while adding a
second prism-channel paving family and genuinely different ruin silhouettes.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "abyss-outer" / "v002"
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"


def pixel_tile(image: Image.Image, box: tuple[int, int, int, int], colors: int) -> Image.Image:
    crop = image.crop(box).resize((32, 32), Image.Resampling.BOX).convert("RGB")
    return crop.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def build_tiles(master_name: str, output_stem: str, boxes: list[tuple[int, int, int, int]], colors: int) -> list[Image.Image]:
    master = Image.open(SOURCE / master_name).convert("RGBA")
    outputs = []
    for index, box in enumerate(boxes):
        tile = pixel_tile(master, box, colors)
        path = TERRAIN / f"{output_stem}_v002_{chr(ord('a') + index)}.png"
        tile.save(path, optimize=True)
        outputs.append(tile)
        print(path.relative_to(ROOT).as_posix())
    return outputs


def fit_alpha(source_name: str, size: tuple[int, int]) -> Image.Image:
    image = Image.open(SOURCE / source_name).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No visible pixels: {source_name}")
    image = image.crop(bounds)
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, size[1] - image.height))
    return canvas


def save_overlay(source_name: str, output_name: str, size: tuple[int, int]) -> Image.Image:
    image = fit_alpha(source_name, size)
    path = OVERLAYS / output_name
    image.save(path, optimize=True)
    print(path.relative_to(ROOT).as_posix())
    return image


def place(canvas: Image.Image, image: Image.Image, x: int, y: int, width: int, height: int) -> None:
    scaled = image.resize((width, height), Image.Resampling.NEAREST)
    canvas.alpha_composite(scaled, (x * 32 + (32 - width) // 2, (y + 1) * 32 - height))


def main() -> None:
    broad_boxes = [(20, 40, 570, 590), (350, 100, 900, 650), (650, 360, 1200, 910), (80, 650, 630, 1200)]
    paving_boxes = [(0, 0, 512, 512), (370, 0, 882, 512), (0, 520, 512, 1032), (650, 650, 1162, 1162)]
    wall_tiles = build_tiles("abyss-outer-wall-master.png", "tile_abyss_outer_wall", broad_boxes, 30)
    ritual_tiles = build_tiles("abyss-outer-ritual-floor-master.png", "tile_abyss_outer_ritual_floor", broad_boxes, 28)
    paving_tiles = build_tiles("abyss-outer-prism-paving-master.png", "tile_abyss_outer_prism_paving", paving_boxes, 30)

    chasm = save_overlay("abyss-outer-chasm-alpha.png", "overlay_abyss_outer_chasm_v002.png", (32, 32))
    altar = save_overlay("abyss-outer-altar-alpha.png", "overlay_abyss_outer_ruined_altar_v002.png", (96, 64))
    fallen = save_overlay("abyss-outer-fallen-pillar-alpha.png", "overlay_abyss_outer_fallen_pillar_v002.png", (40, 40))
    intact = save_overlay("abyss-outer-intact-column-alpha.png", "overlay_abyss_outer_intact_column_v002.png", (40, 64))
    stump = save_overlay("abyss-outer-broken-column-stump-alpha.png", "overlay_abyss_outer_broken_column_stump_v002.png", (44, 40))
    arch = save_overlay("abyss-outer-ruined-arch-alpha.png", "overlay_abyss_outer_ruined_arch_v002.png", (72, 56))
    pedestal_a = save_overlay("abyss-outer-prism-pedestal-intact-alpha.png", "overlay_abyss_outer_prism_pedestal_intact_v002.png", (34, 30))
    pedestal_b = save_overlay("abyss-outer-prism-pedestal-collapsed-alpha.png", "overlay_abyss_outer_prism_pedestal_collapsed_v002.png", (38, 30))

    rows = [
        "WWWWWWWWWWWWWWWWW", "WGGGGGGGWWGGGGGGW", "WGWWGGGGGGGGGWWGW",
        "WWWGGTTTTTTTGGWWW", "WGGGTTTTTTTTTGGWW", "WGGGTTTGGGTTTGGGW",
        "WGGGTTGTTTGTTGGWW", "WWGGTTGTTTGTTGWWW", "WGGGTTGTTTGTTGWGW",
        "WGGWTTTGTGTTTGWGW", "WGGWTTTTTTTTTGGGW", "WWGGGTTTTTTTGGGWW",
        "WWWGGGGGGGGGGGWWW", "WWWWWGGGGGGGWWWWW", "WWWWWWWWSWWWWWWWW",
    ]
    map_preview = Image.new("RGBA", (17 * 32, 15 * 32), (10, 8, 14, 255))
    groups = {"W": wall_tiles, "T": ritual_tiles, "G": paving_tiles, "S": paving_tiles}
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            choices = groups[symbol]
            tile = choices[(x * 17 + y * 31) % len(choices)]
            map_preview.alpha_composite(tile, (x * 32, y * 32))

    # Back-to-front order follows the actual row-depth renderer.
    place(map_preview, arch, 8, 3, 72, 56)
    place(map_preview, altar, 8, 4, 96, 64)
    place(map_preview, intact, 4, 4, 40, 64)
    place(map_preview, intact, 12, 4, 40, 64)
    for x, y, image in (
        (6, 5, pedestal_a), (10, 5, pedestal_b),
        (5, 7, pedestal_b), (11, 7, pedestal_a),
        (6, 9, pedestal_a), (10, 9, pedestal_b),
    ):
        place(map_preview, image, x, y, image.width, image.height)
    place(map_preview, chasm, 8, 7, 48, 48)
    place(map_preview, stump, 4, 10, 44, 40)
    place(map_preview, fallen, 12, 10, 40, 40)
    map_preview.save(SOURCE / "abyss-outer-v002-map-preview.png", optimize=True)

    contact = Image.new("RGBA", (640, 384), (15, 12, 20, 255))
    for row, tiles in enumerate((wall_tiles, ritual_tiles, paving_tiles)):
        for col, tile in enumerate(tiles):
            contact.alpha_composite(tile.resize((128, 128), Image.Resampling.NEAREST), (col * 128, row * 128))
    contact.alpha_composite(intact, (520, 12))
    contact.alpha_composite(stump, (570, 35))
    contact.alpha_composite(arch, (520, 95))
    contact.alpha_composite(pedestal_a, (525, 170))
    contact.alpha_composite(pedestal_b, (570, 170))
    contact.alpha_composite(altar.resize((144, 96), Image.Resampling.NEAREST), (490, 275))
    contact.save(SOURCE / "abyss-outer-v002-contact-sheet.png", optimize=True)


if __name__ == "__main__":
    main()
