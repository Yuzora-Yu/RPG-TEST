from pathlib import Path
from PIL import Image, ImageDraw
import random

ROOT = Path(__file__).resolve().parents[1]
TERRAIN = ROOT / "assets" / "map" / "terrain"
OBJECTS = ROOT / "assets" / "map" / "objects"
OVERLAYS = ROOT / "assets" / "map" / "overlays"
for folder in (TERRAIN, OBJECTS, OVERLAYS):
    folder.mkdir(parents=True, exist_ok=True)


def clamp(v):
    return max(0, min(255, int(v)))


def shade(color, delta):
    return tuple(clamp(c + delta) for c in color)


def save(img, path):
    img.save(path)
    print(path.relative_to(ROOT))


def tile_stone(path, base, mortar, accent=None, seed=0, cracks=False, metal=False):
    random.seed(seed)
    img = Image.new("RGB", (32, 32), base)
    d = ImageDraw.Draw(img)
    if metal:
        d.rectangle([0, 0, 31, 31], fill=base)
        for y in range(0, 32, 8):
            d.line([0, y, 31, y], fill=shade(base, -32))
            d.line([0, y + 1, 31, y + 1], fill=shade(base, 24))
        for x in range(0, 32, 8):
            d.line([x, 0, x, 31], fill=shade(base, -24))
        for x in (5, 14, 23):
            for y in (4, 13, 22):
                d.rectangle([x, y, x + 1, y + 1], fill=shade(base, 44))
                d.point((x + 2, y + 2), fill=shade(base, -54))
        if accent:
            d.line([0, 26, 31, 22], fill=accent)
            d.line([0, 27, 31, 23], fill=shade(accent, -28))
    else:
        d.rectangle([0, 0, 31, 31], fill=base)
        rows = [(0, 9), (9, 18), (18, 32)]
        for i, (y1, y2) in enumerate(rows):
            offset = 0 if i % 2 == 0 else -8
            x = offset
            while x < 32:
                w = random.choice([8, 10, 12, 14])
                d.rectangle([x, y1, x + w, y2], fill=shade(base, random.randint(-12, 12)))
                d.line([x, y1, x + w, y1], fill=shade(base, 28))
                d.line([x, y2, x + w, y2], fill=shade(base, -38))
                d.line([x, y1, x, y2], fill=shade(base, -30))
                x += w
        for y in (9, 18):
            d.line([0, y, 31, y], fill=mortar)
        for _ in range(42):
            x, y = random.randrange(32), random.randrange(32)
            img.putpixel((x, y), shade(base, random.choice([-36, -24, 28, 36])))
    if cracks:
        for _ in range(6):
            x, y = random.randrange(3, 29), random.randrange(3, 29)
            pts = [(x, y)]
            for _ in range(random.randrange(2, 5)):
                x += random.choice([-2, -1, 1, 2])
                y += random.choice([1, 2])
                pts.append((x, y))
            d.line(pts, fill=accent or shade(base, -80), width=1)
            if accent:
                for px, py in pts:
                    if 0 <= px < 32 and 0 <= py < 32:
                        d.point((px, py), fill=accent)
    save(img, TERRAIN / path)


def tile_floor(path, base, seed=0, motif=None):
    random.seed(seed)
    img = Image.new("RGB", (32, 32), base)
    d = ImageDraw.Draw(img)
    for y in range(0, 32, 8):
        for x in range(0, 32, 8):
            c = shade(base, random.randint(-10, 12))
            d.rectangle([x, y, x + 7, y + 7], fill=c)
            d.line([x, y, x + 7, y], fill=shade(c, 18))
            d.line([x, y + 7, x + 7, y + 7], fill=shade(c, -22))
    for _ in range(54):
        x, y = random.randrange(32), random.randrange(32)
        img.putpixel((x, y), shade(base, random.choice([-22, 20, 26])))
    if motif == "grass":
        for _ in range(18):
            x, y = random.randrange(32), random.randrange(32)
            d.line([x, y, x + random.choice([-1, 1]), max(0, y - 2)], fill=shade(base, 38))
    if motif == "marble":
        for x in range(-6, 32, 11):
            d.line([x, 31, x + 20, 0], fill=shade(base, -18))
            d.line([x + 1, 31, x + 21, 0], fill=shade(base, 16))
    if motif == "rune":
        d.rectangle([12, 12, 19, 19], outline=shade(base, 44))
        d.line([16, 7, 24, 16, 16, 25, 8, 16, 16, 7], fill=shade(base, 36))
    save(img, TERRAIN / path)


def tile_magma(path):
    random.seed(42)
    img = Image.new("RGB", (32, 32), (118, 30, 13))
    d = ImageDraw.Draw(img)
    for y in range(32):
        for x in range(32):
            heat = int(50 + 40 * random.random())
            img.putpixel((x, y), (clamp(150 + heat), clamp(48 + heat // 2), 8))
    cracks = [
        [(0, 8), (8, 12), (15, 7), (24, 10), (31, 5)],
        [(3, 31), (10, 23), (17, 25), (24, 16), (31, 18)],
        [(12, 0), (11, 8), (17, 16), (15, 31)],
    ]
    for pts in cracks:
        d.line(pts, fill=(255, 226, 62), width=2)
        d.line(pts, fill=(255, 96, 18), width=1)
    for _ in range(20):
        x, y = random.randrange(32), random.randrange(32)
        d.point((x, y), fill=(255, 236, 82))
    save(img, TERRAIN / path)


def tile_water(path):
    random.seed(7)
    img = Image.new("RGB", (32, 32), (20, 78, 104))
    d = ImageDraw.Draw(img)
    for y in range(32):
        c = (18, 68 + (y % 8) * 4, 98 + (y % 7) * 3)
        d.line([0, y, 31, y], fill=c)
    for _ in range(14):
        y = random.randrange(4, 29)
        x = random.randrange(0, 18)
        d.arc([x, y - 3, x + 16, y + 5], 10, 170, fill=(90, 184, 213), width=1)
    save(img, TERRAIN / path)


def tile_bridge(path):
    img = Image.new("RGB", (32, 32), (111, 76, 42))
    d = ImageDraw.Draw(img)
    for y in range(0, 32, 6):
        d.rectangle([0, y, 31, y + 4], fill=(136, 91, 47))
        d.line([0, y, 31, y], fill=(174, 121, 67))
        d.line([0, y + 4, 31, y + 4], fill=(66, 43, 24))
    d.rectangle([0, 0, 3, 31], fill=(82, 55, 32))
    d.rectangle([28, 0, 31, 31], fill=(82, 55, 32))
    for x in (5, 15, 25):
        d.rectangle([x, 3, x + 1, 5], fill=(48, 31, 19))
        d.rectangle([x, 21, x + 1, 23], fill=(48, 31, 19))
    save(img, TERRAIN / path)


def overlay_base():
    return Image.new("RGBA", (96, 96), (0, 0, 0, 0))


def shadow(d, x, y, w=44):
    d.ellipse([x - w // 2, y - 6, x + w // 2, y + 6], fill=(0, 0, 0, 70))


def npc(path, robe, hair, skin=(232, 178, 126), staff=False, armor=False, child=False):
    img = overlay_base()
    d = ImageDraw.Draw(img)
    shadow(d, 48, 78, 46 if not child else 34)
    scale = 0.82 if child else 1
    top = int(18 + (1 - scale) * 22)
    # legs
    d.rectangle([38, 58, 44, 76], fill=shade(robe, -36))
    d.rectangle([52, 58, 58, 76], fill=shade(robe, -42))
    # body
    if armor:
        d.polygon([(34, 34), (62, 34), (67, 61), (58, 70), (38, 70), (29, 61)], fill=robe)
        d.line([34, 39, 62, 39], fill=shade(robe, 45), width=2)
        d.rectangle([40, 46, 56, 58], outline=shade(robe, -55), fill=shade(robe, 18))
    else:
        d.polygon([(33, top + 20), (63, top + 20), (68, 64), (57, 73), (39, 73), (28, 64)], fill=robe)
        d.line([34, top + 24, 62, top + 24], fill=shade(robe, 34), width=2)
        d.line([48, top + 22, 48, 70], fill=shade(robe, -48), width=2)
    # arms
    d.rectangle([26, 44, 35, 62], fill=shade(robe, -24))
    d.rectangle([61, 44, 70, 62], fill=shade(robe, -28))
    # head
    if armor:
        d.ellipse([34, 17, 62, 45], fill=hair)
        d.rectangle([36, 28, 60, 40], fill=shade(hair, 18))
        d.rectangle([39, 34, 57, 38], fill=(30, 24, 20))
    else:
        d.ellipse([35, 16, 61, 42], fill=skin)
        d.rectangle([34, 14, 62, 24], fill=hair)
        d.rectangle([30, 20, 38, 36], fill=hair)
        d.rectangle([58, 20, 66, 36], fill=hair)
        d.point((42, 30), fill=(38, 28, 24))
        d.point((54, 30), fill=(38, 28, 24))
        if staff:
            d.line([25, 24, 25, 76], fill=(84, 50, 25), width=4)
            d.ellipse([19, 15, 31, 27], fill=(209, 164, 73), outline=(73, 42, 20))
    # highlights
    d.line([36, top + 23, 47, top + 19], fill=(255, 255, 255, 54), width=2)
    save(img, OVERLAYS / path)


def monster(path):
    img = overlay_base()
    d = ImageDraw.Draw(img)
    shadow(d, 48, 78, 54)
    d.ellipse([27, 30, 69, 73], fill=(68, 82, 76), outline=(30, 38, 36), width=3)
    d.polygon([(33, 34), (22, 18), (42, 27)], fill=(47, 61, 56), outline=(25, 30, 28))
    d.polygon([(63, 34), (74, 18), (54, 27)], fill=(47, 61, 56), outline=(25, 30, 28))
    d.rectangle([37, 47, 44, 53], fill=(155, 88, 214))
    d.rectangle([52, 47, 59, 53], fill=(155, 88, 214))
    d.line([36, 63, 60, 63], fill=(28, 24, 24), width=2)
    for x in (31, 65):
        d.line([x, 62, x - 7 if x < 48 else x + 7, 76], fill=(42, 54, 50), width=5)
    save(img, OVERLAYS / path)


def door(path, color):
    img = overlay_base()
    d = ImageDraw.Draw(img)
    shadow(d, 48, 80, 58)
    d.rectangle([25, 18, 71, 78], fill=(42, 31, 28), outline=(14, 12, 12), width=3)
    d.rectangle([30, 22, 66, 74], fill=color)
    d.line([33, 24, 33, 72], fill=shade(color, 48), width=2)
    d.line([63, 24, 63, 72], fill=shade(color, -70), width=2)
    d.rectangle([41, 45, 55, 59], fill=(44, 32, 22), outline=(222, 173, 84))
    d.rectangle([46, 56, 50, 66], fill=(24, 18, 14))
    save(img, OBJECTS / path)


def key(path, color):
    img = overlay_base()
    d = ImageDraw.Draw(img)
    shadow(d, 48, 72, 38)
    d.ellipse([22, 26, 46, 50], outline=shade(color, 48), width=6)
    d.line([44, 38, 72, 66], fill=color, width=7)
    d.line([61, 55, 73, 52], fill=color, width=5)
    d.line([65, 59, 76, 56], fill=color, width=5)
    d.line([28, 31, 41, 44], fill=(255, 255, 255, 80), width=2)
    save(img, OBJECTS / path)


def tablet(path):
    img = overlay_base()
    d = ImageDraw.Draw(img)
    shadow(d, 48, 80, 52)
    d.rectangle([25, 24, 71, 78], fill=(93, 93, 82), outline=(37, 38, 35), width=3)
    d.rectangle([30, 29, 66, 73], fill=(117, 118, 102), outline=(68, 68, 60))
    d.line([48, 35, 38, 52, 48, 68, 58, 52, 48, 35], fill=(212, 194, 118), width=2)
    for y in (41, 48, 58):
        d.line([36, y, 60, y], fill=(61, 61, 55), width=1)
    save(img, OVERLAYS / path)


def building(path, palette, roof="tile", sign=None):
    wall, roof_dark, roof_light, trim = palette
    img = overlay_base()
    d = ImageDraw.Draw(img)
    shadow(d, 48, 82, 68)
    if roof == "thatch":
        d.polygon([(17, 43), (48, 17), (79, 43)], fill=roof_dark, outline=shade(roof_dark, -35))
        for x in range(22, 75, 8):
            d.line([48, 19, x, 43], fill=roof_light, width=2)
        d.line([20, 43, 76, 43], fill=shade(roof_dark, -45), width=3)
    elif roof == "forge":
        d.polygon([(18, 43), (48, 18), (78, 43)], fill=roof_dark, outline=shade(roof_dark, -35))
        d.rectangle([61, 19, 70, 43], fill=(45, 36, 34), outline=(20, 17, 16))
        d.rectangle([62, 12, 69, 20], fill=(70, 55, 48), outline=(26, 22, 20))
        d.line([25, 37, 72, 37], fill=roof_light, width=3)
    else:
        d.polygon([(16, 42), (48, 18), (80, 42)], fill=roof_dark, outline=shade(roof_dark, -34))
        for y in (29, 36):
            d.line([23, y, 73, y], fill=roof_light, width=2)
    d.rectangle([24, 43, 72, 78], fill=wall, outline=shade(wall, -52), width=3)
    d.line([27, 46, 69, 46], fill=shade(wall, 32), width=2)
    d.rectangle([42, 58, 54, 78], fill=shade(wall, -58), outline=trim)
    d.rectangle([29, 52, 38, 62], fill=(39, 47, 58), outline=trim)
    d.rectangle([58, 52, 67, 62], fill=(39, 47, 58), outline=trim)
    if sign == "forge":
        d.rectangle([35, 48, 61, 55], fill=(69, 43, 26), outline=(30, 20, 15))
        d.line([40, 53, 47, 49], fill=(231, 155, 62), width=2)
        d.line([49, 49, 56, 53], fill=(231, 155, 62), width=2)
    if sign == "water":
        d.arc([36, 47, 60, 61], 0, 180, fill=(111, 210, 232), width=2)
    save(img, OVERLAYS / path)


tile_stone("tile_fire_wall_v003.png", (64, 48, 43), (30, 23, 23), (242, 80, 24), seed=11, cracks=True)
tile_floor("tile_fire_floor_v003.png", (91, 76, 64), seed=12)
tile_magma("tile_magma_v003.png")
tile_floor("tile_wind_floor_v003.png", (70, 116, 65), seed=20, motif="grass")
tile_stone("tile_wind_wall_v003.png", (77, 83, 71), (43, 48, 42), seed=21)
tile_bridge("tile_wind_bridge_v003.png")
tile_water("tile_water_canal_v003.png")
tile_floor("tile_water_pave_v003.png", (72, 86, 101), seed=30)
tile_bridge("tile_water_bridge_v003.png")
tile_stone("tile_tower_wall_v003.png", (94, 58, 74), (49, 31, 43), seed=40)
tile_floor("tile_tower_floor_v003.png", (103, 54, 78), seed=41, motif="rune")
tile_stone("tile_thunder_wall_v003.png", (83, 96, 105), (40, 49, 55), (214, 173, 54), seed=50, metal=True)
tile_stone("tile_thunder_floor_v003.png", (75, 78, 82), (35, 35, 38), (214, 173, 54), seed=51, metal=True)
tile_stone("tile_light_wall_v003.png", (208, 207, 190), (145, 141, 126), seed=60)
tile_floor("tile_light_floor_v003.png", (220, 218, 200), seed=61, motif="marble")
tile_stone("tile_dark_wall_v003.png", (43, 37, 49), (18, 17, 22), seed=70)
tile_floor("tile_dark_floor_v003.png", (47, 43, 55), seed=71)
tile_floor("tile_abyss_grass_v003.png", (38, 70, 45), seed=80, motif="grass")
tile_floor("tile_abyss_path_v003.png", (62, 74, 55), seed=81)
tile_stone("tile_shrine_wall_v003.png", (73, 88, 71), (40, 48, 42), seed=90)
tile_floor("tile_shrine_floor_v003.png", (58, 80, 68), seed=91)

building("overlay_building_fire_forge_v001.png", ((90, 60, 45), (103, 36, 28), (203, 87, 42), (223, 164, 83)), roof="forge", sign="forge")
building("overlay_building_wind_hut_v001.png", ((92, 102, 67), (119, 91, 47), (175, 142, 76), (220, 195, 124)), roof="thatch")
building("overlay_building_water_shop_v001.png", ((87, 97, 112), (45, 75, 103), (92, 150, 177), (189, 202, 207)), roof="tile", sign="water")
npc("overlay_npc_elder_v001.png", (70, 86, 42), (232, 224, 194), staff=True)
npc("overlay_npc_villager_v001.png", (80, 105, 61), (51, 38, 28))
npc("overlay_npc_child_v001.png", (104, 130, 72), (95, 70, 41), child=True)
npc("overlay_npc_dark_soldier_v001.png", (34, 36, 43), (32, 34, 38), armor=True)
npc("overlay_npc_bronze_knight_v001.png", (157, 92, 43), (111, 74, 46), armor=True)
monster("overlay_monster_guardian_v001.png")
tablet("overlay_stone_tablet_sfc_v001.png")
door("door_key_red_v002.png", (134, 38, 34))
door("door_key_blue_v002.png", (37, 82, 138))
door("door_key_gold_v002.png", (164, 113, 36))
key("item_key_red_v002.png", (215, 60, 54))
key("item_key_blue_v002.png", (70, 153, 225))
key("item_key_gold_v002.png", (226, 178, 72))
