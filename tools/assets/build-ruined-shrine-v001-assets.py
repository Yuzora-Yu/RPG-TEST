"""Build the authored Ruined Shrine v001 tile family and pillar overlay."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "ruined-shrine" / "v001"
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"


def pixel_crop(master: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int], colors: int) -> Image.Image:
    image = master.crop(box).resize(size, Image.Resampling.BOX).convert("RGB")
    return image.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def build_tile_family(master_name: str, stem: str, boxes: list[tuple[int, int, int, int]], colors: int) -> list[Image.Image]:
    master = Image.open(SOURCE / master_name).convert("RGBA")
    result = []
    for index, box in enumerate(boxes):
        tile = pixel_crop(master, box, (32, 32), colors)
        output = TERRAIN / f"{stem}_v001_{chr(ord('a') + index)}.png"
        tile.save(output, optimize=True)
        result.append(tile)
        print(output.relative_to(ROOT).as_posix())
    return result


def build_wall_faces() -> list[Image.Image]:
    master = Image.open(SOURCE / "ruined-shrine-wall-face-master.png").convert("RGBA")
    w, h = master.size
    boxes = [
        (0, 0, w // 2, h),
        (w // 2, 0, w, h),
    ]
    result = []
    for index, box in enumerate(boxes):
        face = pixel_crop(master, box, (32, 48), 34)
        output = TERRAIN / f"tile_ruined_shrine_wall_face_v001_{chr(ord('a') + index)}.png"
        face.save(output, optimize=True)
        result.append(face)
        print(output.relative_to(ROOT).as_posix())
    return result


def build_pillar() -> Image.Image:
    image = Image.open(SOURCE / "ruined-shrine-pillar-chroma.png").convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = pixels[x, y]
            # Image generation may soften the exact chroma key. Green dominance
            # keeps the stone intact while removing both flat and near-key pixels.
            alpha = 0 if g > 120 and g > r * 1.45 and g > b * 1.45 else 255
            pixels[x, y] = (r, g, b, alpha)
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("Ruined shrine pillar has no visible pixels")
    image = image.crop(bounds)
    image.thumbnail((48, 72), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (48, 72), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((48 - image.width) // 2, 72 - image.height))
    output = OVERLAYS / "overlay_ruined_shrine_pillar_v001.png"
    canvas.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())
    return canvas


def place(canvas: Image.Image, image: Image.Image, x: int, y: int, width: int, height: int) -> None:
    scaled = image.resize((width, height), Image.Resampling.NEAREST)
    canvas.alpha_composite(scaled, (x * 32 + (32 - width) // 2, (y + 1) * 32 - height))


def main() -> None:
    broad = [(0, 0, 512, 512), (370, 40, 882, 552), (0, 560, 512, 1072), (650, 650, 1162, 1162)]
    floor_tiles = build_tile_family("ruined-shrine-floor-master.png", "tile_ruined_shrine_floor", broad, 30)
    wall_tiles = build_tile_family("ruined-shrine-wall-master.png", "tile_ruined_shrine_wall", broad, 30)
    wall_faces = build_wall_faces()
    pillar = build_pillar()

    rows = [
        "WWWWWWWWWWWWWWWWW", "WWWWWWWWWWWWWWWWW", "WWWWWWWWWWWWWWWWW",
        "WWGGGTTTPTTTGGGWW", "WWGGTTTTTTTTTGGWW", "WWGGTTTTTTTTTGGWW",
        "WWGGTTWTTTWTTGGWW", "WWGGTTTTTTTTTGGWW", "WWGGTTWTTTWTTGGWW",
        "WWGGTTTTTTTTTGGWW", "WWGGTTTTTTTTTGGWW", "WWGGGTTTTTTTGGGWW",
        "WWGGGGGGGGGGGGGWW", "WWWWWWWWGWWWWWWWW", "WWWWWWWWSWWWWWWWW",
    ]
    preview = Image.new("RGBA", (17 * 32, 15 * 32), (8, 10, 9, 255))
    for y, row in enumerate(rows):
        for x, sign in enumerate(row):
            family = wall_tiles if sign == "W" else floor_tiles
            preview.alpha_composite(family[(x * 17 + y * 31) % 4], (x * 32, y * 32))
    for x in range(3, 14):
        if rows[3][x] != "W" and rows[2][x] == "W":
            preview.alpha_composite(wall_faces[x % 2], (x * 32, 3 * 32 - 16))
    for x, y in ((5, 5), (11, 5), (5, 9), (11, 9)):
        place(preview, pillar, x, y, 48, 72)
    tablet = Image.open(ROOT / "assets" / "map" / "library" / "ruins" / "blocking" / "maplib_ruins_ancient_tablet_v001.png").convert("RGBA")
    place(preview, tablet, 8, 3, 32, 40)
    preview.save(SOURCE / "ruined-shrine-v001-map-preview.png", optimize=True)


if __name__ == "__main__":
    main()
