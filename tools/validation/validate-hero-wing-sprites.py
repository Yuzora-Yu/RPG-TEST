"""Validate the Light Wing field sprites and their centralized cache entries."""

from pathlib import Path
import re

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[2]
ASSETS_SOURCE = (ROOT / "assets.js").read_text(encoding="utf-8")


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> None:
    checked = 0
    for direction in ("down", "up", "left", "right"):
        for step in (1, 2):
            key = f"hero_wing_{direction}_{step}"
            relative = f"assets/generated/hero-wing-{direction}-{step}-v003.png"
            pattern = rf'{re.escape(key)}:\s*"{re.escape(relative)}"'
            assert_true(bool(re.search(pattern, ASSETS_SOURCE)), f"Missing cache mapping: {key}")

            hero = Image.open(ROOT / "assets" / "generated" / f"hero-{direction}-{step}.gif").convert("RGBA")
            winged = Image.open(ROOT / relative).convert("RGBA")
            assert_true(winged.size == (144, 144), f"Invalid size: {relative} {winged.size}")
            assert_true(winged.getpixel((0, 0))[3] == 0, f"Top-left corner is not transparent: {relative}")

            hero_alpha = hero.getchannel("A")
            preserved_hero = Image.composite(winged, Image.new("RGBA", hero.size), hero_alpha)
            expected_hero = Image.composite(hero, Image.new("RGBA", hero.size), hero_alpha)
            assert_true(
                ImageChops.difference(preserved_hero, expected_hero).getbbox() is None,
                f"Canonical hero pixels were modified: {relative}",
            )

            added_alpha = ImageChops.subtract(winged.getchannel("A"), hero_alpha)
            added_bounds = added_alpha.getbbox()
            assert_true(added_bounds is not None, f"No wing pixels were added: {relative}")
            assert_true(added_bounds[3] < 100, f"Wing layer reaches the actor foot area: {relative} {added_bounds}")
            if direction in ("left", "right"):
                visible_wing_pixels = sum(added_alpha.histogram()[1:])
                assert_true(
                    visible_wing_pixels >= 650,
                    f"Side-view wings are too small to read at field scale: {relative} ({visible_wing_pixels}px)",
                )
            if direction == "up":
                assert_true(
                    added_bounds[1] < 30 and added_bounds[3] < 94,
                    f"Rear-view wings must point upward from the shoulders: {relative} {added_bounds}",
                )
            checked += 1

    print(f"Hero wing validation passed: {checked} direction/step frames are cached and preserve the hero pixels.")


if __name__ == "__main__":
    main()
