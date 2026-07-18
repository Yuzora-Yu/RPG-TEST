"""Build the authored Ruined Shrine v002 terrain, wall inserts and props."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "ruined-shrine" / "v002"
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"


def quantize_rgba(image: Image.Image, colors: int = 40) -> Image.Image:
    return image.convert("RGBA").quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    ).convert("RGBA")


def remove_green(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = pixels[x, y]
            green_key = g > 105 and g > r * 1.34 and g > b * 1.34
            pixels[x, y] = (r, g, b, 0 if green_key else 255)
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("Chroma-key source contains no visible pixels")
    return image.crop(bounds)


def build_tile_family(master_name: str, stem: str, colors: int = 32) -> list[Image.Image]:
    master = Image.open(SOURCE / master_name).convert("RGB")
    w, h = master.size
    side = min(w, h) * 13 // 32
    boxes = [
        (0, 0, side, side),
        (w - side, 0, w, side),
        (0, h - side, side, h),
        (w - side, h - side, w, h),
    ]
    result = []
    for index, box in enumerate(boxes):
        tile = master.crop(box).resize((32, 32), Image.Resampling.BOX)
        tile = tile.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
        output = TERRAIN / f"{stem}_v002_{chr(ord('a') + index)}.png"
        tile.save(output, optimize=True)
        result.append(tile)
        print(output.relative_to(ROOT).as_posix())
    return result


def build_wall_faces() -> list[Image.Image]:
    master = Image.open(SOURCE / "ruined-shrine-wall-face-master.png").convert("RGB")
    w, h = master.size
    boxes = [(0, 0, w // 2, h), (w // 2, 0, w, h)]
    result = []
    for index, box in enumerate(boxes):
        face = master.crop(box).resize((32, 48), Image.Resampling.BOX)
        face = face.quantize(colors=36, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
        output = TERRAIN / f"tile_ruined_shrine_wall_face_v002_{chr(ord('a') + index)}.png"
        face.save(output, optimize=True)
        result.append(face)
        print(output.relative_to(ROOT).as_posix())
    return result


def build_chroma_asset(source_name: str, output_name: str, size: tuple[int, int], colors: int = 40) -> Image.Image:
    image = remove_green(Image.open(SOURCE / source_name))
    image.thumbnail(size, Image.Resampling.LANCZOS)
    image = quantize_rgba(image, colors)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, size[1] - image.height))
    output = OVERLAYS / output_name
    canvas.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())
    return canvas


def split_asset(image: Image.Image, stem: str, columns: int, rows: int) -> list[Image.Image]:
    cell_w = image.width // columns
    cell_h = image.height // rows
    result = []
    for y in range(rows):
        for x in range(columns):
            cell = image.crop((x * cell_w, y * cell_h, (x + 1) * cell_w, (y + 1) * cell_h))
            suffix = chr(ord('a') + y * columns + x)
            output = OVERLAYS / f"{stem}_{suffix}.png"
            cell.save(output, optimize=True)
            result.append(cell)
            print(output.relative_to(ROOT).as_posix())
    return result


def main() -> None:
    build_tile_family("ruined-shrine-floor-master.png", "tile_ruined_shrine_floor")
    build_tile_family("ruined-shrine-wall-master.png", "tile_ruined_shrine_wall")
    build_tile_family("ruined-shrine-withered-grass-master.png", "tile_ruined_shrine_withered_grass", 30)
    build_wall_faces()

    build_chroma_asset(
        "ruined-shrine-pillar-chroma.png",
        "overlay_ruined_shrine_pillar_v002.png",
        (48, 72),
    )
    stage = build_chroma_asset(
        "ruined-shrine-raised-stage-chroma.png",
        "overlay_ruined_shrine_raised_stage_v002.png",
        (96, 64),
        44,
    )
    split_asset(stage, "overlay_ruined_shrine_raised_stage_v002", 3, 2)

    build_chroma_asset(
        "ruined-shrine-ritual-astrolabe-chroma.png",
        "overlay_ruined_shrine_ritual_astrolabe_v002.png",
        (40, 40),
        42,
    )
    build_chroma_asset(
        "ruined-shrine-rusted-sword-chroma.png",
        "overlay_ruined_shrine_rusted_sword_v002.png",
        (18, 28),
        34,
    )
    build_chroma_asset(
        "ruined-shrine-rusted-spear-chroma.png",
        "overlay_ruined_shrine_rusted_spear_v002.png",
        (14, 30),
        34,
    )
    build_chroma_asset(
        "ruined-shrine-rusted-axe-chroma.png",
        "overlay_ruined_shrine_rusted_axe_v002.png",
        (22, 26),
        34,
    )


if __name__ == "__main__":
    main()
