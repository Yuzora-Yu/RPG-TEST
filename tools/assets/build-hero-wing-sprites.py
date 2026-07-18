"""Build direction-aware Light Wing player sprites without altering the hero art.

The generated wing masters are kept separately from the canonical walking frames.
This script reduces each direction-specific wing layer to the game scale, places it
behind the unchanged hero frame, and emits the two walking frames used by Phaser.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / "assets" / "generated"
VERSION = "v003"
SOURCE = ROOT / "assets" / "managed" / "source" / "hero-wings" / VERSION

# Target bounds are tuned against the canonical 144 x 144 hero frames.  Wings stay
# compact enough for field-map readability and never change the actor foot baseline.
DIRECTION_LAYOUT = {
    "down": {"size": (116, 40), "positions": ((14, 37), (14, 38))},
    # Rear wings must rise from the shoulder blades.  The v002 layer was too
    # flat and read as an upside-down white cape at field scale.
    "up": {"size": (126, 78), "positions": ((9, 14), (9, 15))},
    # Side views deliberately retain a broad silhouette.  The actor is drawn
    # over the roots, so the two wings remain visible without replacing any
    # canonical hero pixels.
    "left": {"size": (82, 96), "positions": ((60, 8), (60, 9))},
    "right": {"size": (82, 96), "positions": ((2, 8), (2, 9))},
}


def load_trimmed_wing(direction: str) -> Image.Image:
    path = SOURCE / f"hero-wing-layer-{direction}-alpha.png"
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"Wing master has no visible pixels: {path}")
    return image.crop(bounds)


def build_frame(direction: str, step: int, wing: Image.Image) -> Image.Image:
    hero_path = GENERATED / f"hero-{direction}-{step}.gif"
    hero = Image.open(hero_path).convert("RGBA")
    if hero.size != (144, 144):
        raise RuntimeError(f"Unexpected hero frame size {hero.size}: {hero_path}")

    layout = DIRECTION_LAYOUT[direction]
    reduced = wing.resize(layout["size"], Image.Resampling.NEAREST)
    x, y = layout["positions"][step - 1]

    canvas = Image.new("RGBA", hero.size, (0, 0, 0, 0))
    canvas.alpha_composite(reduced, (x, y))
    canvas.alpha_composite(hero, (0, 0))
    return canvas


def build_preview(frames: list[tuple[str, int, Image.Image]]) -> None:
    scale = 3
    cell = 144 * scale
    preview = Image.new("RGBA", (cell * 2, cell * 4), (28, 31, 35, 255))
    for row, (direction, step, frame) in enumerate(frames):
        direction_row = ("down", "up", "left", "right").index(direction)
        enlarged = frame.resize((cell, cell), Image.Resampling.NEAREST)
        preview.alpha_composite(enlarged, ((step - 1) * cell, direction_row * cell))
    preview.save(SOURCE / f"hero-wing-{VERSION}-preview.png", optimize=True)


def main() -> None:
    frames: list[tuple[str, int, Image.Image]] = []
    for direction in ("down", "up", "left", "right"):
        wing = load_trimmed_wing(direction)
        for step in (1, 2):
            frame = build_frame(direction, step, wing)
            output = GENERATED / f"hero-wing-{direction}-{step}-{VERSION}.png"
            frame.save(output, optimize=True)
            frames.append((direction, step, frame))
            print(output.relative_to(ROOT).as_posix())
    build_preview(frames)


if __name__ == "__main__":
    main()
