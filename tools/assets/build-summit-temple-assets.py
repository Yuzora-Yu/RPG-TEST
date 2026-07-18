"""Build the authored Summit Temple terrain, stage, statues, and battle background."""

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "summit-temple" / "v001"
SKY_SOURCE = ROOT / "assets" / "managed" / "source" / "summit-temple" / "v002"
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"
GENERATED = ROOT / "assets" / "generated"


def quantize_rgba(image: Image.Image, colors: int) -> Image.Image:
    return image.convert("RGBA").quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    ).convert("RGBA")


def build_tile(
    source_name: str,
    output_name: str,
    anchor: str,
    colors: int = 36,
    brightness: float = 1.0,
    source_dir: Path = SOURCE,
) -> None:
    source = Image.open(source_dir / source_name).convert("RGB")
    side = min(source.size) * 13 // 32
    if anchor == "center":
        left = (source.width - side) // 2
        top = (source.height - side) // 2
    elif anchor == "top-left":
        left = 0
        top = 0
    else:
        raise ValueError(f"Unknown crop anchor: {anchor}")
    tile = source.crop((left, top, left + side, top + side)).resize((32, 32), Image.Resampling.BOX)
    if brightness != 1.0:
        tile = ImageEnhance.Brightness(tile).enhance(brightness)
    tile = tile.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    output = TERRAIN / output_name
    tile.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def build_wall_face() -> None:
    source = Image.open(SOURCE / "summit-wall-face-master.png").convert("RGB")
    crop_width = min(source.width, source.height * 2 // 3)
    left = (source.width - crop_width) // 2
    face = source.crop((left, 0, left + crop_width, source.height)).resize((32, 48), Image.Resampling.BOX)
    face = ImageEnhance.Contrast(face).enhance(1.08)
    face = face.quantize(colors=44, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    output = TERRAIN / "tile_summit_temple_wall_face_v001.png"
    face.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def build_exact_overlay(source_name: str, output_name: str, size: tuple[int, int], colors: int) -> Image.Image:
    source = Image.open(SOURCE / source_name).convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"Transparent source has no visible subject: {source_name}")
    image = source.crop(bounds).resize(size, Image.Resampling.LANCZOS)
    image = quantize_rgba(image, colors)
    output = OVERLAYS / output_name
    image.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())
    return image


def build_statue(source_name: str, output_name: str) -> None:
    source = Image.open(SOURCE / source_name).convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"Transparent source has no visible subject: {source_name}")
    image = source.crop(bounds)
    image.thumbnail((40, 64), Image.Resampling.LANCZOS)
    image = quantize_rgba(image, 52)
    canvas = Image.new("RGBA", (40, 64), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((40 - image.width) // 2, 64 - image.height))
    output = OVERLAYS / output_name
    canvas.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def split_stage(stage: Image.Image) -> None:
    for y in range(3):
        for x in range(5):
            suffix = chr(ord("a") + y * 5 + x)
            output = OVERLAYS / f"overlay_summit_temple_stage_v001_{suffix}.png"
            stage.crop((x * 32, y * 32, (x + 1) * 32, (y + 1) * 32)).save(output, optimize=True)
            print(output.relative_to(ROOT).as_posix())


def build_battle_background() -> None:
    source = Image.open(SOURCE / "summit-battle-bg-master.png").convert("RGB")
    image = ImageOps.fit(source, (960, 540), Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    image = image.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    output = GENERATED / "battle-summit-temple-v001.png"
    image.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def main() -> None:
    build_tile("summit-mountain-trail-master.png", "tile_summit_temple_mountain_trail_v001_a.png", "top-left", 44)
    build_tile("summit-mountain-trail-master.png", "tile_summit_temple_mountain_trail_v001_b.png", "center", 44, brightness=0.96)
    build_tile("summit-floor-master.png", "tile_summit_temple_floor_v001_a.png", "top-left", 40)
    build_tile("summit-floor-master.png", "tile_summit_temple_floor_v001_b.png", "center", 40)
    build_tile("summit-wall-master.png", "tile_summit_temple_wall_v001.png", "center", 38, brightness=0.84)
    build_tile(
        "summit-sky-master.png",
        "tile_summit_temple_sky_v001_a.png",
        "top-left",
        40,
        brightness=0.92,
        source_dir=SKY_SOURCE,
    )
    build_tile(
        "summit-sky-master.png",
        "tile_summit_temple_sky_v001_b.png",
        "center",
        40,
        brightness=0.86,
        source_dir=SKY_SOURCE,
    )
    build_wall_face()
    stage = build_exact_overlay("summit-stage-alpha.png", "overlay_summit_temple_stage_v001.png", (160, 96), 56)
    split_stage(stage)
    build_statue("summit-angel-alpha.png", "overlay_summit_temple_statue_angel_v001.png")
    build_statue("summit-divine-dragon-alpha.png", "overlay_summit_temple_statue_divine_dragon_v001.png")
    build_battle_background()


if __name__ == "__main__":
    main()
