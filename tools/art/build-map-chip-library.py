#!/usr/bin/env python3
"""Build reusable 32x32 runtime map chips from approved 3x3 source atlases."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "assets" / "managed" / "source" / "map-chip-library" / "v001"
OUTPUT_ROOT = ROOT / "assets" / "map" / "library"
CATALOG_ROOT = ROOT / "docs" / "generated" / "map-chip-library"


THEMES = {
    "village": [
        ("wildflowers", "Wildflower tuft", "decoration", False),
        ("medicinal_herbs", "Medicinal herb tuft", "decoration", False),
        ("mushroom_patch", "Mushroom patch", "decoration", False),
        ("hay_bundle", "Hay bundle", "blocking", True),
        ("fence_post", "Low wooden fence post", "blocking", True),
        ("roadside_sign", "Roadside sign", "blocking", True),
        ("clay_jar", "Clay water jar", "blocking", True),
        ("mossy_stone", "Mossy stone", "decoration", False),
        ("firewood_stack", "Cut firewood stack", "blocking", True),
    ],
    "forest": [
        ("ancient_stump", "Ancient stump", "blocking", True),
        ("exposed_roots", "Exposed root cluster", "decoration", False),
        ("fern_patch", "Fern patch", "decoration", False),
        ("red_mushrooms", "Red-capped mushrooms", "decoration", False),
        ("fallen_log", "Fallen mossy log", "blocking", True),
        ("lichen_boulder", "Lichen boulder", "blocking", True),
        ("twisted_sapling", "Twisted sapling", "blocking", True),
        ("vine_stone", "Hanging-vine stone", "blocking", True),
        ("glowing_fungus", "Glowing forest fungus", "decoration", False),
    ],
    "cave": [
        ("stalagmite", "Stalagmite", "blocking", True),
        ("rock_pile", "Loose rock pile", "decoration", False),
        ("purple_crystals", "Purple crystal cluster", "blocking", True),
        ("mineral_puddle", "Shallow mineral puddle", "decoration", False),
        ("pale_mushrooms", "Pale cave mushrooms", "decoration", False),
        ("bone_pile", "Old bone pile", "decoration", False),
        ("mine_support", "Broken mine support", "blocking", True),
        ("miner_cart", "Rusted miner cart", "blocking", True),
        ("spring_vent", "Underground spring vent", "decoration", False),
    ],
    "volcanic": [
        ("lava_vent", "Cracked lava vent", "decoration", False),
        ("obsidian_shards", "Obsidian shard cluster", "blocking", True),
        ("ember_fissure", "Glowing ember fissure", "decoration", False),
        ("ritual_brazier", "Iron ritual brazier", "blocking", True),
        ("scorched_bones", "Scorched bone fragments", "decoration", False),
        ("sulfur_crystals", "Sulfur crystals", "blocking", True),
        ("molten_boulder", "Half-molten boulder", "blocking", True),
        ("ash_heap", "Ash heap", "decoration", False),
        ("fire_rune_stone", "Fire-rune stone", "blocking", True),
    ],
    "water": [
        ("puddle_ripple", "Shallow puddle ripple", "decoration", False),
        ("branching_coral", "Branching coral", "blocking", True),
        ("shell_cluster", "Spiral shell cluster", "decoration", False),
        ("seaweed_clump", "Seaweed clump", "decoration", False),
        ("broken_column", "Broken turquoise column", "blocking", True),
        ("sea_anemone", "Sea anemone", "decoration", False),
        ("sunken_urn", "Barnacled sunken urn", "blocking", True),
        ("bubble_vent", "Bubble vent stone", "decoration", False),
        ("starfish_debris", "Starfish and pearl debris", "decoration", False),
    ],
    "thunder": [
        ("control_terminal", "Magitek control terminal", "blocking", True),
        ("cable_coil", "Insulated cable coil", "decoration", False),
        ("broken_conduit", "Broken conduit", "decoration", False),
        ("lightning_capacitor", "Lightning capacitor", "blocking", True),
        ("battery_cell", "Copper battery cell", "blocking", True),
        ("floor_grate", "Iron floor grate", "decoration", False),
        ("gear_assembly", "Exposed gear assembly", "blocking", True),
        ("warning_beacon", "Blue warning beacon", "blocking", True),
        ("transformer_coil", "Transformer coil", "blocking", True),
    ],
    "light": [
        ("crystal_pedestal", "Crystal pedestal", "blocking", True),
        ("prism_cluster", "Prism cluster", "blocking", True),
        ("gold_inlay", "Gold floor-inlay medallion", "decoration", False),
        ("luminous_flower", "Luminous white flower", "decoration", False),
        ("marble_urn", "Ceremonial marble urn", "blocking", True),
        ("mirror_stand", "Cracked mirror stand", "blocking", True),
        ("sun_altar", "Miniature sun altar", "blocking", True),
        ("star_mosaic", "Star mosaic fragment", "decoration", False),
        ("marble_rubble", "Clean marble rubble", "decoration", False),
    ],
    "dark": [
        ("iron_candelabrum", "Iron candelabrum", "blocking", True),
        ("chain_pile", "Coiled chain pile", "decoration", False),
        ("horned_skull", "Horned skull fragments", "decoration", False),
        ("gargoyle_statue", "Gargoyle statue", "blocking", True),
        ("black_crystals", "Black crystal cluster", "blocking", True),
        ("sealed_obelisk", "Sealed stone obelisk", "blocking", True),
        ("broken_armor", "Broken dark knight armor", "decoration", False),
        ("blue_brazier", "Cold blue-flame brazier", "blocking", True),
        ("ritual_rune", "Cracked ritual rune stone", "decoration", False),
    ],
    "tower": [
        ("gear_assembly", "Tower gear assembly", "blocking", True),
        ("rope_coil", "Coiled rope", "decoration", False),
        ("hand_winch", "Hand winch", "blocking", True),
        ("oil_lamp", "Hooded oil lamp", "blocking", True),
        ("reinforced_crate", "Reinforced crate", "blocking", True),
        ("weathered_barrel", "Weathered barrel", "blocking", True),
        ("brass_pipe", "Bent brass pipe", "decoration", False),
        ("lens_fragment", "Cracked giant lens", "blocking", True),
        ("iron_anchor", "Small iron anchor", "decoration", False),
    ],
    "ruins": [
        ("broken_column", "Broken stone column", "blocking", True),
        ("ancient_tablet", "Unreadable ancient tablet", "blocking", True),
        ("void_crystals", "Void crystal cluster", "blocking", True),
        ("black_roots", "Black root tendrils", "blocking", True),
        ("ritual_brazier", "Extinguished ritual brazier", "blocking", True),
        ("masonry_pile", "Collapsed masonry pile", "blocking", True),
        ("weathered_rune", "Weathered rune stone", "blocking", True),
        ("bone_lantern", "Bone-frame lantern", "blocking", True),
        ("prism_shard", "Fractured prism shard", "blocking", True),
    ],
}


def crop_cell(atlas: Image.Image, index: int) -> Image.Image:
    col, row = index % 3, index // 3
    x0 = round(col * atlas.width / 3)
    x1 = round((col + 1) * atlas.width / 3)
    y0 = round(row * atlas.height / 3)
    y1 = round((row + 1) * atlas.height / 3)
    return atlas.crop((x0, y0, x1, y1))


def tight_crop(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 24 else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise ValueError("source cell contains no visible subject")
    return image.crop(bbox)


def fit_to_canvas(image: Image.Image, size: int) -> Image.Image:
    padding = max(1, round(size * 0.06))
    max_width = size - padding * 2
    max_height = size - padding * 2
    scale = min(max_width / image.width, max_height / image.height)
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    resized = image.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - width) // 2
    y = size - padding - height
    canvas.alpha_composite(resized, (x, y))
    return canvas


def make_runtime(master: Image.Image) -> Image.Image:
    runtime = master.resize((32, 32), Image.Resampling.LANCZOS)
    alpha = runtime.getchannel("A").point(lambda value: 255 if value >= 30 else 0)
    rgb = runtime.convert("RGB").quantize(colors=48, method=Image.Quantize.MEDIANCUT).convert("RGB")
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def draw_catalog(theme: str, entries: list[dict]) -> None:
    scale = 4
    cell_width, cell_height = 180, 170
    catalog = Image.new("RGB", (cell_width * 3, cell_height * 3), (18, 20, 27))
    draw = ImageDraw.Draw(catalog)
    font = ImageFont.load_default()
    for index, entry in enumerate(entries):
        chip = Image.open(ROOT / entry["path"]).convert("RGBA").resize((32 * scale, 32 * scale), Image.Resampling.NEAREST)
        col, row = index % 3, index // 3
        x = col * cell_width + (cell_width - chip.width) // 2
        y = row * cell_height + 4
        catalog.paste(chip, (x, y), chip)
        draw.text((col * cell_width + 8, row * cell_height + 138), entry["name"], fill=(238, 219, 165), font=font)
        draw.text((col * cell_width + 8, row * cell_height + 152), entry["role"], fill=(153, 183, 207), font=font)
    CATALOG_ROOT.mkdir(parents=True, exist_ok=True)
    catalog.save(CATALOG_ROOT / f"{theme}.png")


def draw_combined_catalog() -> None:
    themes = list(THEMES)
    columns = 2
    card_width, card_height, header_height = 540, 510, 28
    rows = (len(themes) + columns - 1) // columns
    combined = Image.new("RGB", (card_width * columns, (card_height + header_height) * rows), (10, 12, 18))
    draw = ImageDraw.Draw(combined)
    font = ImageFont.load_default()
    for index, theme in enumerate(themes):
        col, row = index % columns, index // columns
        x = col * card_width
        y = row * (card_height + header_height)
        draw.rectangle((x, y, x + card_width - 1, y + header_height - 1), fill=(8, 10, 15))
        draw.text((x + 8, y + 8), theme.upper(), fill=(238, 219, 165), font=font)
        catalog = Image.open(CATALOG_ROOT / f"{theme}.png").convert("RGB")
        combined.paste(catalog, (x, y + header_height))
    combined.save(CATALOG_ROOT / "map-chip-library-v001.png", optimize=True)


def main() -> None:
    for stale in OUTPUT_ROOT.rglob("maplib_*_v*.png"):
        stale.unlink()
    manifest = {
        "schemaVersion": 1,
        "runtimeSize": [32, 32],
        "sourceVersion": "v001",
        "assets": [],
    }
    for theme, items in THEMES.items():
        atlas_path = SOURCE_ROOT / f"atlas_{theme}_alpha.png"
        atlas = Image.open(atlas_path).convert("RGBA")
        theme_entries = []
        for index, (slug, name, role, collision) in enumerate(items):
            cell = tight_crop(crop_cell(atlas, index))
            master = fit_to_canvas(cell, 256)
            master_dir = SOURCE_ROOT / "masters" / theme
            master_dir.mkdir(parents=True, exist_ok=True)
            master_path = master_dir / f"{slug}.png"
            master.save(master_path, optimize=True)

            output_dir = OUTPUT_ROOT / theme / role
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"maplib_{theme}_{slug}_v001.png"
            make_runtime(master).save(output_path, optimize=True)

            entry = {
                "key": f"maplib_{theme}_{slug}",
                "name": name,
                "theme": theme,
                "role": role,
                "defaultCollision": collision,
                "anchor": "bottom-center",
                "path": output_path.relative_to(ROOT).as_posix(),
                "master": master_path.relative_to(ROOT).as_posix(),
            }
            manifest["assets"].append(entry)
            theme_entries.append(entry)
        draw_catalog(theme, theme_entries)

    draw_combined_catalog()

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(manifest['assets'])} map chips across {len(THEMES)} themes.")


if __name__ == "__main__":
    main()
