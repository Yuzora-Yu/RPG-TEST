#!/usr/bin/env python3
"""Normalize adopted generated monsters into runtime-compatible RGBA PNGs."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "assets" / "managed" / "source" / "monster-library" / "v001"
OUTPUT_ROOT = ROOT / "assets" / "monsters" / "library"
CATALOG_ROOT = ROOT / "docs" / "generated" / "monster-library"


MONSTERS = [
    ("midboss", "fire", "ashhorn_minotaur", "灰角のミノタウロス"),
    ("midboss", "water", "abyssal_shell_knight", "深淵殻の騎士"),
    ("midboss", "wind", "zephyr_manticore", "疾風のマンティコア"),
    ("midboss", "thunder", "thunder_coil_golem", "雷環のゴーレム"),
    ("midboss", "light", "cathedral_chimera", "聖堂のキマイラ"),
    ("midboss", "dark", "grave_regent", "墓所の王"),
    ("midboss", "earth", "root_titan", "根脈の巨人"),
    ("midboss", "ice", "frostfang_wyrm", "氷牙のワーム"),
    ("normal", "fire", "cinder_imp", "灰火のインプ"),
    ("normal", "fire", "magma_salamander", "マグマサラマンダー"),
    ("normal", "water", "tide_jelly", "潮騒ジェリー"),
    ("normal", "water", "shellback_crab", "シェルバッククラブ"),
    ("normal", "wind", "razorwing_hawk", "レイザーウイング"),
    ("normal", "wind", "breeze_moth", "ブリーズモス"),
    ("normal", "thunder", "spark_hound", "スパークハウンド"),
    ("normal", "thunder", "volt_beetle", "ボルトビートル"),
    ("normal", "light", "prism_wisp", "プリズムウィスプ"),
    ("normal", "light", "shrine_sentinel", "聖域のセンチネル"),
    ("normal", "dark", "gloom_bat", "グルームバット"),
    ("normal", "dark", "shade_crawler", "シェイドクローラー"),
    ("normal", "earth", "stone_mole", "ストーンモール"),
    ("normal", "earth", "thorn_boar", "ソーンボア"),
    ("normal", "ice", "frost_jelly", "フロストジェリー"),
    ("normal", "ice", "shard_hare", "シャードヘア"),
]

# Runtime adoption is curated by hand. Keeping it beside the source roster
# prevents a later art rebuild from silently returning the manifest to an
# unassigned state.
ADOPTIONS = {
    "ashhorn_minotaur": (302201, "karin_volcano_depths:boss"),
    "abyssal_shell_knight": (302202, "sophia_alan_seabed_depths:boss"),
    "zephyr_manticore": (302203, "arisa_haine_forest_depths:boss"),
    "thunder_coil_golem": (302204, "frieda_baron_thunder_depths:boss"),
    "cathedral_chimera": (302205, "zelied_big_tower:boss"),
    "grave_regent": (302206, "claude_leon_dark_shrine:boss"),
    "root_titan": (302207, "arisa_haine_forest_depths:boss"),
    "frostfang_wyrm": (302208, "sophia_alan_seabed_depths:boss"),
    "cinder_imp": (110201, "abyss-band-81-85"),
    "magma_salamander": (110202, "abyss-band-86-90"),
    "tide_jelly": (110203, "abyss-band-91-95"),
    "shellback_crab": (110204, "abyss-band-96-100"),
    "razorwing_hawk": (110205, "abyss-band-101-105"),
    "breeze_moth": (110206, "abyss-band-106-110"),
    "spark_hound": (110207, "abyss-band-111-115"),
    "volt_beetle": (110208, "abyss-band-116-120"),
    "prism_wisp": (110209, "abyss-band-121-125"),
    "shrine_sentinel": (110210, "abyss-band-126-130"),
    "gloom_bat": (110211, "abyss-band-131-135"),
    "shade_crawler": (110212, "abyss-band-136-140"),
    "stone_mole": (110213, "abyss-band-141-145"),
    "thorn_boar": (110214, "abyss-band-146-150"),
    "frost_jelly": (110215, "abyss-band-151-155"),
    "shard_hare": (110216, "abyss-band-156-160"),
}


def catalog_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/meiryo.ttc"),
        Path("C:/Windows/Fonts/YuGothM.ttc"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def normalize(source: Image.Image, role: str) -> Image.Image:
    alpha = source.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 24 else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise ValueError("monster source contains no visible subject")
    subject = source.crop(bbox)
    # Keep the existing 768x768 runtime contract, but author on a 192x192
    # logical canvas and upscale with nearest-neighbor. This removes generated
    # micro-detail and forces late-SFC-sized pixel clusters.
    logical_size = 192
    runtime_scale = 4
    max_width = 176 if role == "midboss" else 152
    max_height = 176 if role == "midboss" else 152
    scale = min(max_width / subject.width, max_height / subject.height, 1.0)
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    subject = subject.resize((width, height), Image.Resampling.LANCZOS)

    alpha = subject.getchannel("A").point(lambda value: 255 if value >= 26 else 0)
    colors = 40 if role == "midboss" else 28
    rgb = subject.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGB")
    subject = rgb.convert("RGBA")
    subject.putalpha(alpha)

    canvas = Image.new("RGBA", (logical_size, logical_size), (0, 0, 0, 0))
    x = (logical_size - width) // 2
    y = 186 - height
    canvas.alpha_composite(subject, (x, y))
    return canvas.resize(
        (logical_size * runtime_scale, logical_size * runtime_scale),
        Image.Resampling.NEAREST,
    )


def build_catalog(entries: list[dict]) -> None:
    card_width, card_height = 260, 250
    columns = 4
    rows = (len(entries) + columns - 1) // columns
    catalog = Image.new("RGB", (card_width * columns, card_height * rows), (16, 18, 25))
    draw = ImageDraw.Draw(catalog)
    font = catalog_font(13)
    for index, entry in enumerate(entries):
        sprite = Image.open(ROOT / entry["path"]).convert("RGBA")
        bbox = sprite.getbbox()
        sprite = sprite.crop(bbox) if bbox else sprite
        logical_width = max(1, sprite.width // 4)
        logical_height = max(1, sprite.height // 4)
        sprite = sprite.resize((logical_width, logical_height), Image.Resampling.NEAREST)
        sprite.thumbnail((220, 205), Image.Resampling.NEAREST)
        col, row = index % columns, index // columns
        x = col * card_width + (card_width - sprite.width) // 2
        y = row * card_height + 4 + (205 - sprite.height)
        catalog.paste(sprite, (x, y), sprite)
        draw.text((col * card_width + 8, row * card_height + 214), entry["candidateName"], fill=(239, 218, 165), font=font)
        draw.text((col * card_width + 8, row * card_height + 230), f"{entry['role']} / {entry['element']}", fill=(145, 184, 212), font=font)
    CATALOG_ROOT.mkdir(parents=True, exist_ok=True)
    catalog.save(CATALOG_ROOT / "monster-library-v001.png", optimize=True)


def main() -> None:
    for stale in OUTPUT_ROOT.rglob("monsterlib_*_v*.png"):
        stale.unlink()
    manifest = {
        "schemaVersion": 1,
        "sourceVersion": "v001",
        "status": "adopted-runtime-v001",
        "runtimeFormat": {
            "canvas": [768, 768],
            "logicalCanvas": [192, 192],
            "nearestScale": 4,
            "mode": "RGBA",
            "background": "transparent",
        },
        "assets": [],
    }
    for role, element, slug, candidate_name in MONSTERS:
        monster_id, story_assignment = ADOPTIONS[slug]
        source_path = SOURCE_ROOT / role / element / f"{slug}_alpha.png"
        source = Image.open(source_path).convert("RGBA")
        sprite = normalize(source, role)
        output_dir = OUTPUT_ROOT / role / element
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"monsterlib_{role}_{element}_{slug}_v001.png"
        sprite.save(output_path, optimize=True)
        manifest["assets"].append({
            "key": f"monsterlib_{role}_{element}_{slug}",
            "candidateName": candidate_name,
            "slug": slug,
            "role": role,
            "element": element,
            "monsterId": monster_id,
            "storyAssignment": story_assignment,
            "path": output_path.relative_to(ROOT).as_posix(),
            "source": source_path.relative_to(ROOT).as_posix(),
        })

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    build_catalog(manifest["assets"])
    print(f"Built {len(manifest['assets'])} adopted monster assets.")


if __name__ == "__main__":
    main()
