#!/usr/bin/env python3
"""Crop, pad, resize, and validate generated transparent game overlays."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--size", type=int)
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--padding", type=float, default=0.08)
    parser.add_argument("--smooth", action="store_true")
    parser.add_argument(
        "--alpha-floor",
        type=int,
        default=0,
        help="Discard generated matte noise at or below this alpha value (0-254).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    target_width = args.width or args.size
    target_height = args.height or args.size
    if not target_width or not target_height:
        raise SystemExit("provide --size or both --width and --height")
    image = Image.open(args.input).convert("RGBA")
    if args.alpha_floor < 0 or args.alpha_floor > 254:
        raise SystemExit("--alpha-floor must be between 0 and 254")
    if args.alpha_floor:
        red, green, blue, alpha = image.split()
        alpha = alpha.point(lambda value: 0 if value <= args.alpha_floor else value)
        image.putalpha(alpha)
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise SystemExit("generated overlay is fully transparent")

    cropped = image.crop(bbox)
    margin = max(2, round(max(cropped.size) * max(0.0, args.padding)))
    canvas_width = cropped.width + margin * 2
    canvas_height = cropped.height + margin * 2
    target_ratio = target_width / target_height
    if canvas_width / canvas_height < target_ratio:
        canvas_width = round(canvas_height * target_ratio)
    else:
        canvas_height = round(canvas_width / target_ratio)
    canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    canvas.alpha_composite(cropped, ((canvas_width - cropped.width) // 2, (canvas_height - cropped.height) // 2))
    resample = Image.Resampling.LANCZOS if args.smooth else Image.Resampling.NEAREST
    final = canvas.resize((target_width, target_height), resample)

    final_alpha = final.getchannel("A")
    if final_alpha.getbbox() is None:
        raise SystemExit("final overlay lost all visible pixels")
    if final.getpixel((0, 0))[3] != 0:
        raise SystemExit("final overlay corner is not transparent")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    final.save(args.output, optimize=True)
    visible = sum(final_alpha.histogram()[1:])
    print(f"Wrote {args.output} ({target_width}x{target_height}, visible={visible})")


if __name__ == "__main__":
    main()
