"""Build shared authored objects used by the two trial shrines."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "managed" / "source" / "shrine-common" / "v002"
OVERLAYS = ROOT / "assets" / "map" / "overlays"


def main() -> None:
    source = Image.open(SOURCE / "healing-spring-alpha.png").convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("Healing spring source has no visible pixels")
    image = source.crop(bounds)
    image.thumbnail((48, 48), Image.Resampling.LANCZOS)
    image = image.quantize(
        colors=56,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    ).convert("RGBA")
    canvas = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((48 - image.width) // 2, 48 - image.height))
    output = OVERLAYS / "overlay_shrine_healing_spring_v002.png"
    canvas.save(output, optimize=True)
    print(output.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
