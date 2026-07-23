"""Fit a transparent generated asset into a deterministic pixel-art canvas."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--width", required=True, type=int)
    parser.add_argument("--height", required=True, type=int)
    parser.add_argument("--padding", type=int, default=1)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        raise SystemExit("input has no visible pixels")
    subject = source.crop(bbox)

    inner_width = max(1, args.width - args.padding * 2)
    inner_height = max(1, args.height - args.padding * 2)
    scale = min(inner_width / subject.width, inner_height / subject.height)
    target_width = max(1, round(subject.width * scale))
    target_height = max(1, round(subject.height * scale))
    subject = subject.resize((target_width, target_height), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    x = (args.width - target_width) // 2
    y = (args.height - target_height) // 2
    canvas.alpha_composite(subject, (x, y))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)


if __name__ == "__main__":
    main()
