"""Build Abyss Outer Rim v003 with a floor-layer 3x3 chasm."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "abyss-outer" / "v003"
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"


def pixel_tile(master: Image.Image, box: tuple[int, int, int, int], colors: int = 28) -> Image.Image:
    image = master.crop(box).resize((32, 32), Image.Resampling.BOX).convert("RGB")
    return image.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def build_family(master_name: str, stem: str, boxes: list[tuple[int, int, int, int]], colors: int) -> list[Image.Image]:
    master = Image.open(SOURCE / master_name).convert("RGBA")
    tiles = []
    for index, box in enumerate(boxes):
        tile = pixel_tile(master, box, colors)
        output = TERRAIN / f"{stem}_v003_{chr(ord('a') + index)}.png"
        tile.save(output, optimize=True)
        tiles.append(tile)
        print(output.relative_to(ROOT).as_posix())
    return tiles


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


def save_overlay(source_name: str, stem: str, size: tuple[int, int]) -> Image.Image:
    image = fit_alpha(source_name, size)
    output = OVERLAYS / f"{stem}_v003.png"
    image.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())
    return image


def build_chasm_tiles() -> tuple[Image.Image, dict[str, Image.Image]]:
    full = fit_alpha("abyss-outer-chasm-alpha.png", (96, 96))
    pieces = {}
    names = (("nw", 0, 0), ("n", 1, 0), ("ne", 2, 0), ("w", 0, 1), ("c", 1, 1),
             ("e", 2, 1), ("sw", 0, 2), ("s", 1, 2), ("se", 2, 2))
    for name, col, row in names:
        piece = full.crop((col * 32, row * 32, (col + 1) * 32, (row + 1) * 32))
        output = OVERLAYS / f"overlay_abyss_outer_chasm_{name}_v003.png"
        piece.save(output, optimize=True)
        pieces[name] = piece
        print(output.relative_to(ROOT).as_posix())
    return full, pieces


def place(canvas: Image.Image, image: Image.Image, x: int, y: int, width: int, height: int) -> None:
    scaled = image.resize((width, height), Image.Resampling.NEAREST)
    canvas.alpha_composite(scaled, (x * 32 + (32 - width) // 2, (y + 1) * 32 - height))


def main() -> None:
    broad = [(20, 40, 570, 590), (350, 100, 900, 650), (650, 360, 1200, 910), (80, 650, 630, 1200)]
    paving = [(0, 0, 512, 512), (370, 0, 882, 512), (0, 520, 512, 1032), (650, 650, 1162, 1162)]
    wall_tiles = build_family("abyss-outer-wall-master.png", "tile_abyss_outer_wall", broad, 30)
    gray_tiles = build_family("abyss-outer-dark-gray-floor-master.png", "tile_abyss_outer_dark_floor", broad, 26)
    paving_tiles = build_family("abyss-outer-prism-paving-master.png", "tile_abyss_outer_prism_paving", paving, 30)

    altar = save_overlay("abyss-outer-altar-alpha.png", "overlay_abyss_outer_ruined_altar", (96, 64))
    # Preserve the long diagonal silhouette. The authored map treats this as a
    # two-cell obstacle (north-west head + south-east base), not a tiny prop.
    fallen = save_overlay("abyss-outer-fallen-pillar-alpha.png", "overlay_abyss_outer_fallen_pillar", (64, 64))
    intact = save_overlay("abyss-outer-intact-column-alpha.png", "overlay_abyss_outer_intact_column", (40, 64))
    stump = save_overlay("abyss-outer-broken-column-stump-alpha.png", "overlay_abyss_outer_broken_column_stump", (44, 40))
    pedestal_a = save_overlay("abyss-outer-prism-pedestal-intact-alpha.png", "overlay_abyss_outer_prism_pedestal_intact", (34, 30))
    pedestal_b = save_overlay("abyss-outer-prism-pedestal-collapsed-alpha.png", "overlay_abyss_outer_prism_pedestal_collapsed", (38, 30))
    chasm, _ = build_chasm_tiles()

    rows = [
        "WWWWWWWWWWWWWWWWW", "WGGGGGGGWWGGGGGGW", "WGWWGGGGGGGGGWWGW",
        "WWWGGTTTTTTTGGWWW", "WGGGTTTTTTTTTGGWW", "WGGGTTTGGGTTTGGGW",
        "WGGGTTGTTTGTTGGWW", "WWGGTTGTTTGTTGWWW", "WGGGTTGTTTGTTGWGW",
        "WGGWTTTGTGTTTGWGW", "WGGWTTTTTTTTTGGGW", "WWGGGTTTTTTTGGGWW",
        "WWWGGGGGGGGGGGWWW", "WWWWWGGGGGGGWWWWW", "WWWWWWWWSWWWWWWWW",
    ]
    preview = Image.new("RGBA", (17 * 32, 15 * 32), (10, 8, 14, 255))
    groups = {"W": wall_tiles, "T": gray_tiles, "G": paving_tiles, "S": paving_tiles}
    for y, row in enumerate(rows):
        for x, sign in enumerate(row):
            choices = groups[sign]
            preview.alpha_composite(choices[(x * 17 + y * 31) % 4], (x * 32, y * 32))

    # The chasm is floor art, not an actor-depth overlay.  It can never cover
    # the hero, irrespective of which side the player approaches from.
    preview.alpha_composite(chasm, (7 * 32, 6 * 32))
    place(preview, altar, 8, 4, 96, 64)
    place(preview, intact, 4, 4, 40, 64)
    place(preview, intact, 12, 4, 40, 64)
    for x, y, image in (
        (5, 5, pedestal_a), (11, 5, pedestal_b),
        (5, 7, pedestal_b), (11, 7, pedestal_a),
        (6, 9, pedestal_a), (10, 9, pedestal_b),
    ):
        place(preview, image, x, y, image.width, image.height)
    place(preview, stump, 4, 10, 44, 40)
    place(preview, fallen, 12, 10, 64, 64)
    preview.save(SOURCE / "abyss-outer-v003-map-preview.png", optimize=True)


if __name__ == "__main__":
    main()
