"""Visual-data invariants for Abyss Outer Rim v003."""

from pathlib import Path

from PIL import Image, ImageStat


ROOT = Path(__file__).resolve().parents[2]
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"


def mean_rgb(path: Path) -> tuple[float, float, float]:
    return tuple(ImageStat.Stat(Image.open(path).convert("RGB")).mean)


def luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def main() -> None:
    dark_paths = sorted(TERRAIN.glob("tile_abyss_outer_dark_floor_v003_*.png"))
    paving_paths = sorted(TERRAIN.glob("tile_abyss_outer_prism_paving_v003_*.png"))
    assert len(dark_paths) == 4 and len(paving_paths) == 4, "Both ruin-floor families need four variants"
    dark_means = [mean_rgb(path) for path in dark_paths]
    paving_means = [mean_rgb(path) for path in paving_paths]
    assert all(g <= max(r, b) for r, g, b in dark_means), f"Green cast returned: {dark_means}"
    dark_luma = sum(map(luminance, dark_means)) / len(dark_means)
    paving_luma = sum(map(luminance, paving_means)) / len(paving_means)
    assert 3 <= paving_luma - dark_luma <= 15, f"Inner floor must be only slightly darker: {dark_luma:.1f}/{paving_luma:.1f}"

    names = ("nw", "n", "ne", "w", "c", "e", "sw", "s", "se")
    visible = 0
    for name in names:
        path = OVERLAYS / f"overlay_abyss_outer_chasm_{name}_v003.png"
        image = Image.open(path).convert("RGBA")
        assert image.size == (32, 32), f"Invalid chasm floor-piece size: {path.name} {image.size}"
        visible += sum(image.getchannel("A").histogram()[1:])
    assert visible >= 3000, f"Nine-cell chasm has insufficient visible coverage: {visible}"

    assets_source = (ROOT / "assets.js").read_text(encoding="utf-8")
    map_source = (ROOT / "map.js").read_text(encoding="utf-8")
    assert "overlay_abyss_outer_ruined_arch:" not in assets_source, "Unused arch remains in runtime cache registry"
    assert 'imageKey: "overlay_abyss_outer_ruined_arch"' not in map_source, "Unwanted arch is still placed"
    print(f"Abyss Outer v003 visual assets passed: dark floor luma {dark_luma:.1f}, paving {paving_luma:.1f}, chasm coverage {visible}px.")


if __name__ == "__main__":
    main()
