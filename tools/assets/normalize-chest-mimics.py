"""Normalize generated chest-mimic cutouts to the game's 768px battle-asset canvas."""
from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "assets" / "monsters" / "chest-mimics"
CANVAS = 768
PADDING = 28


def normalize(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    alpha_box = image.getchannel("A").getbbox()
    if not alpha_box:
        raise ValueError(f"No opaque subject found: {path}")
    subject = image.crop(alpha_box)
    max_edge = CANVAS - PADDING * 2
    scale = min(max_edge / subject.width, max_edge / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - subject.width) // 2
    y = CANVAS - PADDING - subject.height
    canvas.alpha_composite(subject, (x, y))
    canvas.save(path, optimize=True)


for asset_id in (120301, 120302, 120303):
    normalize(ASSET_DIR / f"monster_{asset_id}.png")
