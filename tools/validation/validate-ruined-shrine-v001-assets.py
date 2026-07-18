"""Visual invariants for generated Ruined Shrine v001 assets."""

from pathlib import Path

from PIL import Image, ImageStat


ROOT = Path(__file__).resolve().parents[2]
TERRAIN = ROOT / "assets" / "map" / "terrain"
OVERLAYS = ROOT / "assets" / "map" / "overlays"
SOURCE = ROOT / "assets" / "managed" / "source" / "ruined-shrine" / "v001"


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


floor_paths = [TERRAIN / f"tile_ruined_shrine_floor_v001_{letter}.png" for letter in "abcd"]
wall_paths = [TERRAIN / f"tile_ruined_shrine_wall_v001_{letter}.png" for letter in "abcd"]
face_paths = [TERRAIN / f"tile_ruined_shrine_wall_face_v001_{letter}.png" for letter in "ab"]
pillar_path = OVERLAYS / "overlay_ruined_shrine_pillar_v001.png"

for path in floor_paths + wall_paths:
    image = Image.open(path).convert("RGBA")
    assert_true(image.size == (32, 32), f"{path.name} must be 32x32")
for path in face_paths:
    image = Image.open(path).convert("RGBA")
    assert_true(image.size == (32, 48), f"{path.name} must be 32x48")

pillar = Image.open(pillar_path).convert("RGBA")
assert_true(pillar.size == (48, 72), "Ruined Shrine pillar must be 48x72")
alpha = pillar.getchannel("A")
assert_true(alpha.getbbox() is not None, "Ruined Shrine pillar is empty")
assert_true(alpha.getextrema() == (0, 255), "Ruined Shrine pillar must retain transparent background")
opaque_green = sum(1 for r, g, b, a in pillar.get_flattened_data() if a > 0 and g > 120 and g > r * 1.45 and g > b * 1.45)
assert_true(opaque_green == 0, f"Ruined Shrine pillar retains {opaque_green} chroma-key pixels")

floor_luma = sum(ImageStat.Stat(Image.open(path).convert("L")).mean[0] for path in floor_paths) / len(floor_paths)
wall_luma = sum(ImageStat.Stat(Image.open(path).convert("L")).mean[0] for path in wall_paths) / len(wall_paths)
assert_true(floor_luma > wall_luma + 4, f"Floor/wall contrast is too low: {floor_luma:.1f}/{wall_luma:.1f}")
assert_true(len({path.read_bytes() for path in floor_paths}) == 4, "Ruined Shrine floor variants are duplicates")
assert_true(len({path.read_bytes() for path in wall_paths}) == 4, "Ruined Shrine wall variants are duplicates")

preview = Image.open(SOURCE / "ruined-shrine-v001-map-preview.png")
assert_true(preview.size == (17 * 32, 15 * 32), "Ruined Shrine preview dimensions are wrong")
for source_name in (
    "ruined-shrine-floor-master.png",
    "ruined-shrine-wall-master.png",
    "ruined-shrine-wall-face-master.png",
    "ruined-shrine-pillar-chroma.png",
):
    assert_true((SOURCE / source_name).is_file(), f"Missing managed source: {source_name}")

print(f"Ruined Shrine v001 assets passed: floor luma {floor_luma:.1f}, wall {wall_luma:.1f}, pillar alpha clean.")
