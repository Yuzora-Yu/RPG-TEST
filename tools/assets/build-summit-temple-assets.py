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


def build_sky_base() -> None:
    """Build a quiet seamless base; cloud detail is authored as a separate overlay."""
    source = Image.open(SKY_SOURCE / "summit-sky-master.png").convert("RGB")
    left = source.width * 3 // 8
    top = source.height * 3 // 8
    right = source.width * 5 // 8
    bottom = source.height * 5 // 8
    sample = source.crop((left, top, right, bottom)).resize((1, 1), Image.Resampling.BOX)
    color = sample.getpixel((0, 0))
    tile = Image.new("RGB", (32, 32), color)
    output = TERRAIN / "tile_summit_temple_sky_v001_a.png"
    tile.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def repair_cloud_bank_seam(cloud: Image.Image) -> Image.Image:
    """Fill the accidental transparent hairline inside the original cloud bank.

    The source art has one narrow, enclosed cut through its center.  At map
    scale that cut reads as a sky-coloured horizontal seam.  Repair only pixels
    that are bounded by visible cloud pixels above and below; the authored outer
    silhouette and its translucent antialiasing remain untouched.
    """
    repaired = cloud.copy().convert("RGBA")
    source = cloud.convert("RGBA")
    pixels = repaired.load()
    source_pixels = source.load()
    min_x = round(cloud.width * 0.40)
    max_x = round(cloud.width * 0.57)
    min_y = round(cloud.height * 0.42)
    max_y = round(cloud.height * 0.82)

    for y in range(min_y, max_y):
        for x in range(min_x, max_x):
            if source_pixels[x, y][3] >= 24:
                continue
            above = None
            below = None
            for distance in range(1, 8):
                if above is None and y - distance >= 0 and source_pixels[x, y - distance][3] >= 64:
                    above = source_pixels[x, y - distance]
                if below is None and y + distance < cloud.height and source_pixels[x, y + distance][3] >= 64:
                    below = source_pixels[x, y + distance]
                if above is not None and below is not None:
                    break
            if above is None or below is None:
                continue
            pixels[x, y] = tuple(round((above[channel] + below[channel]) / 2) for channel in range(4))

    # The lower-left end of the same cut opens into the silhouette, so it is
    # not covered by the bounded-pixel pass above.  Feather this short wedge
    # by hand from the cloud colour immediately above it.  Restricting the
    # patch to this authored coordinate band avoids changing either cloud bank.
    bridge_top = round(cloud.height * 0.56)
    bridge_bottom = round(cloud.height * 0.84)
    for y in range(bridge_top, bridge_bottom):
        progress = (y - bridge_top) / max(1, bridge_bottom - bridge_top - 1)
        left = round(cloud.width * (0.39 - 0.035 * progress))
        right = round(cloud.width * 0.455)
        target_alpha = round(220 - 145 * progress)
        for x in range(left, right + 1):
            if pixels[x, y][3] >= target_alpha:
                continue
            sample = None
            for distance in range(1, 10):
                sample_y = y - distance
                if sample_y >= 0 and source_pixels[x, sample_y][3] >= 48:
                    sample = source_pixels[x, sample_y]
                    break
            if sample is None:
                continue
            pixels[x, y] = (sample[0], sample[1], sample[2], target_alpha)
    return repaired


def build_cloud_asset(
    source_name: str,
    output_name: str,
    size: tuple[int, int],
    colors: int = 28,
    repair_center_seam: bool = False,
) -> None:
    source = Image.open(SKY_SOURCE / source_name).convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"Summit cloud source has no visible pixels: {source_name}")
    cloud = source.crop(bounds)
    cloud.thumbnail((size[0], size[1] - 6), Image.Resampling.LANCZOS)
    if repair_center_seam:
        cloud = repair_cloud_bank_seam(cloud)
    cloud = quantize_rgba(cloud, colors)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(cloud, ((size[0] - cloud.width) // 2, (size[1] - cloud.height) // 2))
    output = OVERLAYS / output_name
    canvas.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


def build_cloud_overlays() -> None:
    # Keep every bank as one texture.  Splitting a translucent cloud over two
    # tile rows exposed a hairline at the texture boundary in Phaser.
    build_cloud_asset(
        "summit-clouds-alpha.png",
        "overlay_summit_temple_cloud_bank_v002.png",
        (224, 64),
        28,
        repair_center_seam=True,
    )
    build_cloud_asset("summit-cloud-wispy-alpha.png", "overlay_summit_temple_cloud_wispy_v001.png", (160, 48), 26)
    build_cloud_asset("summit-cloud-compact-alpha.png", "overlay_summit_temple_cloud_compact_v001.png", (128, 64), 30)


def build_cliff_edges() -> None:
    """Build directional ledges used where the raised temple floor meets open sky."""
    source = Image.open(SKY_SOURCE / "summit-cliff-edge-alpha.png").convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("Summit cliff-edge source has no visible pixels")
    strip = source.crop(bounds)

    # The generated master contains five repeating architectural bays.  Use the
    # center bay as the seamless 32px module so the in-game edge stays readable
    # instead of crushing the whole master into one tile.
    # Only the bright handrail/lip is needed around the walkable protrusion.
    # The lower fence panels made the platform look boxed in.
    rail_height = max(1, round(strip.height * 0.29))
    rail = strip.crop((0, 0, strip.width, rail_height))
    bay_width = rail.width // 5
    left = (rail.width - bay_width) // 2
    south = ImageOps.fit(
        rail.crop((left, 0, left + bay_width, rail.height)),
        (32, 6),
        Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    south = quantize_rgba(south, 44)
    edges = {
        "s": south,
        "n": south.rotate(180, expand=True),
        "w": south.rotate(-90, expand=True),
        "e": south.rotate(90, expand=True),
    }
    for direction, image in edges.items():
        output = OVERLAYS / f"overlay_summit_temple_cliff_edge_{direction}_v001.png"
        image.save(output, optimize=True)
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
    build_sky_base()
    build_cloud_overlays()
    build_cliff_edges()
    build_wall_face()
    stage = build_exact_overlay("summit-stage-alpha.png", "overlay_summit_temple_stage_v001.png", (160, 96), 56)
    split_stage(stage)
    build_statue("summit-angel-alpha.png", "overlay_summit_temple_statue_angel_v001.png")
    build_statue("summit-divine-dragon-alpha.png", "overlay_summit_temple_statue_divine_dragon_v001.png")
    build_battle_background()


if __name__ == "__main__":
    main()
