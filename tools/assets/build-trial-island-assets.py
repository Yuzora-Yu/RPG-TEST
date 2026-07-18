"""Build the authored Trial Island shrine terrain, stage, and A-Un statues."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "trial-island" / "v001"
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"
GENERATED = ROOT / "assets" / "generated"


def quantize_rgba(image: Image.Image, colors: int) -> Image.Image:
    return image.convert("RGBA").quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    ).convert("RGBA")


def build_tile(source_name: str, output_name: str, anchor: str, colors: int = 32) -> None:
    source = Image.open(SOURCE / source_name).convert("RGB")
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
    tile = tile.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    output = TERRAIN / output_name
    tile.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def build_wall_face() -> None:
    source = Image.open(SOURCE / "trial-wall-face-master.png").convert("RGB")
    # The generated master intentionally has a plain margin above the masonry.
    # Crop only the authored wall and keep a 2:3 ratio for the 32x48 wall face.
    top = next(
        y for y in range(source.height)
        if sum(sum(source.getpixel((x, y))) for x in range(0, source.width, 32)) / max(1, source.width // 32) < 650
    )
    usable_h = source.height - top
    crop_w = min(source.width, usable_h * 2 // 3)
    left = (source.width - crop_w) // 2
    face = source.crop((left, top, left + crop_w, source.height)).resize((32, 48), Image.Resampling.BOX)
    face = face.quantize(colors=38, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    output = TERRAIN / "tile_trial_shrine_wall_face_v001.png"
    face.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def remove_magenta(source_name: str) -> Image.Image:
    image = Image.open(SOURCE / source_name).convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = pixels[x, y]
            keyed = r > 150 and b > 120 and r > g * 1.65 and b > g * 1.65
            pixels[x, y] = (r, g, b, 0 if keyed else 255)
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No foreground remained after chroma removal: {source_name}")
    return image.crop(bounds)


def build_overlay(source_name: str, output_name: str, size: tuple[int, int], colors: int) -> Image.Image:
    image = remove_magenta(source_name)
    image.thumbnail(size, Image.Resampling.LANCZOS)
    image = quantize_rgba(image, colors)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, size[1] - image.height))
    output = OVERLAYS / output_name
    canvas.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())
    return canvas


def split_stage(stage: Image.Image) -> None:
    for y in range(3):
        for x in range(5):
            cell = stage.crop((x * 32, y * 32, (x + 1) * 32, (y + 1) * 32))
            suffix = chr(ord("a") + y * 5 + x)
            output = OVERLAYS / f"overlay_trial_shrine_stage_v001_{suffix}.png"
            cell.save(output, optimize=True)
            print(output.relative_to(ROOT).as_posix())


def build_battle_background() -> None:
    source = Image.open(SOURCE / "trial-battle-bg-master.png").convert("RGB")
    image = ImageOps.fit(source, (960, 540), Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    image = image.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    output = GENERATED / "battle-trial-shrine-v001.png"
    image.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def main() -> None:
    build_tile("trial-floor-a-master.png", "tile_trial_shrine_floor_v001_a.png", "top-left", 34)
    build_tile("trial-floor-b-master.png", "tile_trial_shrine_floor_v001_b.png", "center", 34)
    build_tile("trial-wall-master.png", "tile_trial_shrine_wall_v001.png", "center", 32)
    build_wall_face()
    stage = build_overlay("trial-stage-chroma.png", "overlay_trial_shrine_stage_v001.png", (160, 96), 46)
    split_stage(stage)
    build_overlay("trial-statue-a-chroma.png", "overlay_trial_shrine_statue_a_v001.png", (40, 64), 44)
    build_overlay("trial-statue-un-chroma.png", "overlay_trial_shrine_statue_un_v001.png", (40, 64), 44)
    build_battle_background()


if __name__ == "__main__":
    main()
