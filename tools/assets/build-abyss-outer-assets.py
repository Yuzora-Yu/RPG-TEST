"""Build the authored Abyss Outer Rim tiles and props from managed masters."""

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "abyss-outer" / "v001"
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"


def pixel_tile(image: Image.Image, box: tuple[int, int, int, int], colors: int = 32) -> Image.Image:
    crop = image.crop(box).resize((32, 32), Image.Resampling.BOX).convert("RGB")
    return crop.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def fit_alpha(source: Path, size: tuple[int, int], *, mirror: bool = False) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No visible pixels in {source}")
    image = image.crop(bounds)
    if mirror:
        image = ImageOps.mirror(image)
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, size[1] - image.height))
    return canvas


def save_variants(master: Image.Image, stem: str, boxes: list[tuple[int, int, int, int]], colors: int) -> list[Image.Image]:
    outputs = []
    for index, box in enumerate(boxes, 1):
        tile = pixel_tile(master, box, colors)
        suffix = "v001" if index == 1 else f"alt_v00{index}"
        path = TERRAIN / f"{stem}_{suffix}.png"
        tile.save(path, optimize=True)
        outputs.append(tile)
        print(path.relative_to(ROOT).as_posix())
    return outputs


def main() -> None:
    wall = Image.open(SOURCE / "abyss-outer-wall-master.png").convert("RGBA")
    floor = Image.open(SOURCE / "abyss-outer-floor-master.png").convert("RGBA")
    boxes = [(20, 40, 570, 590), (350, 100, 900, 650), (650, 360, 1200, 910), (80, 650, 630, 1200)]

    wall_tiles = save_variants(wall, "tile_abyss_outer_wall", boxes, 30)
    floor_tiles = save_variants(floor, "tile_abyss_outer_floor", boxes, 28)

    ground_master = ImageEnhance.Color(floor).enhance(0.50)
    ground_master = ImageEnhance.Brightness(ground_master).enhance(0.72)
    ground_tiles = save_variants(ground_master, "tile_abyss_outer_ground", boxes, 24)

    chasm = fit_alpha(SOURCE / "abyss-outer-chasm-alpha.png", (32, 32))
    pillar_a = fit_alpha(SOURCE / "abyss-outer-pillar-alpha.png", (40, 40))
    pillar_b = fit_alpha(SOURCE / "abyss-outer-pillar-alpha.png", (40, 40), mirror=True)
    altar = fit_alpha(SOURCE / "abyss-outer-altar-alpha.png", (96, 64))
    overlay_outputs = {
        "overlay_abyss_outer_chasm_v001.png": chasm,
        "overlay_abyss_outer_collapsed_pillar_a_v001.png": pillar_a,
        "overlay_abyss_outer_collapsed_pillar_b_v001.png": pillar_b,
        "overlay_abyss_outer_ruined_altar_v001.png": altar,
    }
    for name, image in overlay_outputs.items():
        path = OVERLAYS / name
        image.save(path, optimize=True)
        print(path.relative_to(ROOT).as_posix())

    preview = Image.new("RGBA", (640, 384), (15, 12, 20, 255))
    for row, tiles in enumerate((wall_tiles, floor_tiles, ground_tiles)):
        for col, tile in enumerate(tiles):
            enlarged = tile.resize((128, 128), Image.Resampling.NEAREST)
            preview.alpha_composite(enlarged, (col * 128, row * 128))
    preview.alpha_composite(chasm.resize((96, 96), Image.Resampling.NEAREST), (520, 16))
    preview.alpha_composite(pillar_a.resize((80, 80), Image.Resampling.NEAREST), (520, 135))
    preview.alpha_composite(pillar_b.resize((80, 80), Image.Resampling.NEAREST), (560, 135))
    preview.alpha_composite(altar.resize((144, 96), Image.Resampling.NEAREST), (490, 270))
    preview.save(SOURCE / "abyss-outer-v001-preview.png", optimize=True)

    # Deterministic authored-map preview used for visual QA.  This mirrors the
    # fixed map without introducing runtime-only random placement.
    rows = [
        "WWWWWWWWWWWWWWWWW", "WGGGGGGGWWGGGGGGW", "WGWWGGGGGGGGGWWGW",
        "WWWGGTTTTTTTGGWWW", "WGGGTTTTTTTTTGGWW", "WGGGTTTGGGTTTGGGW",
        "WGGGTTGTTTGTTGGWW", "WWGGTTGTTTGTTGWWW", "WGGGTTGTTTGTTGWGW",
        "WGGWTTTGTGTTTGWGW", "WGGWTTTTTTTTTGGGW", "WWGGGTTTTTTTGGGWW",
        "WWWGGGGGGGGGGGWWW", "WWWWWGGGGGGGWWWWW", "WWWWWWWWSWWWWWWWW",
    ]
    map_preview = Image.new("RGBA", (17 * 32, 15 * 32), (10, 8, 14, 255))
    groups = {"W": wall_tiles, "T": floor_tiles, "D": floor_tiles, "G": ground_tiles, "S": ground_tiles}
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            choices = groups[symbol]
            tile = choices[(x * 17 + y * 31) % len(choices)]
            map_preview.alpha_composite(tile, (x * 32, y * 32))

    def place(image: Image.Image, x: int, y: int, width: int, height: int) -> None:
        scaled = image.resize((width, height), Image.Resampling.NEAREST)
        map_preview.alpha_composite(scaled, (x * 32 + (32 - width) // 2, (y + 1) * 32 - height))

    place(altar, 8, 4, 96, 64)
    for x, y, image in ((5, 6, pillar_a), (11, 6, pillar_b), (5, 10, pillar_b), (11, 10, pillar_a)):
        place(image, x, y, 40, 40)
    place(chasm, 8, 7, 48, 48)
    map_preview.save(SOURCE / "abyss-outer-v001-map-preview.png", optimize=True)


if __name__ == "__main__":
    main()
