(() => {
  "use strict";

  const garbledRe = /[�繧縺蜿謌荳鬲豺螟譁]/;
  const byId = (id) => document.getElementById(id);
  const setText = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };

  const canvasData = (w, h, draw) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    draw(ctx, w, h);
    return canvas.toDataURL("image/png");
  };

  const blockNoise = (ctx, w, h, colors, seed, size = 4, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const i = Math.abs((x * 37 + y * 71 + seed * 997) % colors.length);
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.restore();
  };

  const drawBrickLines = (ctx, color, stepY = 12, offset = 12) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let y = stepY; y < 64; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
    for (let y = 0; y < 64; y += stepY) {
      const shift = (y / stepY) % 2 ? offset / 2 : 0;
      for (let x = shift; x < 64; x += offset) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(64, y + stepY));
        ctx.stroke();
      }
    }
  };

  const drawRoofHouse = (ctx, roof, wall, trim = "#f1d48a") => {
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(12, 49, 42, 7);
    ctx.fillStyle = wall;
    ctx.fillRect(16, 28, 32, 24);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.lineTo(32, 10);
    ctx.lineTo(54, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(28, 39, 8, 13);
    ctx.fillStyle = "#2c1b20";
    ctx.fillRect(20, 33, 7, 7);
    ctx.fillRect(39, 33, 7, 7);
  };

  const tile = (kind) => canvasData(64, 64, (ctx) => {
    ctx.fillStyle = "#182125";
    ctx.fillRect(0, 0, 64, 64);

    switch (kind) {
      case "floor":
        blockNoise(ctx, 64, 64, ["#245f42", "#2c7a4e", "#3c8f52", "#1c4939"], 2, 4);
        ctx.strokeStyle = "rgba(226,214,151,.22)";
        ctx.lineWidth = 2;
        for (let y = 10; y < 64; y += 18) {
          ctx.beginPath();
          ctx.moveTo(-5, y);
          ctx.quadraticCurveTo(18, y - 7, 36, y + 2);
          ctx.quadraticCurveTo(51, y + 9, 69, y - 2);
          ctx.stroke();
        }
        break;
      case "forest":
        blockNoise(ctx, 64, 64, ["#153527", "#1f4d32", "#2d653a", "#123022"], 3, 4);
        for (let i = 0; i < 7; i += 1) {
          const x = 8 + ((i * 17) % 44);
          const y = 12 + ((i * 13) % 36);
          ctx.fillStyle = "#2a1f16";
          ctx.fillRect(x + 7, y + 16, 5, 16);
          ctx.fillStyle = i % 2 ? "#1f6a3f" : "#2f8750";
          ctx.beginPath();
          ctx.arc(x + 9, y + 14, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,236,156,.15)";
          ctx.fillRect(x + 4, y + 8, 5, 5);
        }
        break;
      case "sea":
      case "canal":
        blockNoise(ctx, 64, 64, ["#123f5d", "#155d7a", "#1b7790", "#0e344f"], 4, 4);
        ctx.strokeStyle = kind === "canal" ? "#91dcda" : "#76c9e1";
        ctx.lineWidth = 3;
        for (let y = 10; y < 64; y += 14) {
          ctx.beginPath();
          for (let x = -6; x <= 70; x += 10) {
            const yy = y + Math.sin((x + y) * 0.25) * 3;
            if (x === -6) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
        break;
      case "mountain":
      case "Low_mountain":
      case "cliff":
        blockNoise(ctx, 64, 64, ["#4c514e", "#5d655c", "#343b3f", "#74786b"], 7, 4);
        ctx.fillStyle = kind === "Low_mountain" ? "#6c6847" : "#64636a";
        ctx.beginPath();
        ctx.moveTo(0, 56);
        ctx.lineTo(18, 14);
        ctx.lineTo(33, 43);
        ctx.lineTo(45, 7);
        ctx.lineTo(64, 56);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#d9e1d1";
        ctx.beginPath();
        ctx.moveTo(45, 7);
        ctx.lineTo(39, 24);
        ctx.lineTo(50, 22);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.28)";
        ctx.stroke();
        break;
      case "wall":
      case "brick-wall":
      case "ancient-brick":
        blockNoise(ctx, 64, 64, kind === "brick-wall" ? ["#4d3340", "#6a3e4a", "#7b4f47"] : ["#242a32", "#303541", "#3e3f46"], 8, 4);
        drawBrickLines(ctx, kind === "ancient-brick" ? "rgba(150,171,126,.45)" : "rgba(13,17,24,.48)");
        if (kind === "ancient-brick") {
          ctx.fillStyle = "rgba(88,132,82,.35)";
          ctx.fillRect(5, 6, 9, 21);
          ctx.fillRect(49, 28, 6, 25);
        }
        break;
      case "dungeon_floor":
      case "stone-pave":
      case "moss-stone":
        blockNoise(ctx, 64, 64, ["#303541", "#3c4151", "#4b4d56", "#252b36"], 9, 4);
        drawBrickLines(ctx, "rgba(13,17,24,.5)", 16, 16);
        if (kind === "moss-stone") {
          ctx.fillStyle = "rgba(55,119,68,.42)";
          ctx.fillRect(4, 45, 27, 8);
          ctx.fillRect(36, 7, 20, 6);
        }
        break;
      case "stairs":
        blockNoise(ctx, 64, 64, ["#303541", "#3b3e48", "#222936"], 11, 4);
        ctx.fillStyle = "#d7b45a";
        for (let i = 0; i < 5; i += 1) ctx.fillRect(16 + i * 3, 18 + i * 7, 32 - i * 6, 5);
        ctx.strokeStyle = "#6c5031";
        ctx.strokeRect(15, 17, 34, 37);
        break;
      case "cave":
      case "hall":
        blockNoise(ctx, 64, 64, ["#252632", "#373341", "#1a1b23"], 12, 4);
        ctx.fillStyle = "#0b0d12";
        ctx.beginPath();
        ctx.arc(32, 38, 22, Math.PI, Math.PI * 2);
        ctx.lineTo(54, 56);
        ctx.lineTo(10, 56);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = kind === "hall" ? "#d7b45a" : "#5d6070";
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      case "house-1":
        blockNoise(ctx, 64, 64, ["#245f42", "#2c7a4e"], 13, 4);
        drawRoofHouse(ctx, "#a94142", "#d9bd84");
        break;
      case "house-2":
      case "inn":
        blockNoise(ctx, 64, 64, ["#245f42", "#2c7a4e"], 14, 4);
        drawRoofHouse(ctx, kind === "inn" ? "#356ab8" : "#7e3fa1", "#e1c691", "#ffe08a");
        if (kind === "inn") {
          ctx.fillStyle = "#fff0b5";
          ctx.fillRect(22, 22, 20, 5);
        }
        break;
      case "casino":
        blockNoise(ctx, 64, 64, ["#24314c", "#34234e", "#4a294f"], 15, 4);
        ctx.fillStyle = "#ffe07a";
        ctx.fillRect(14, 18, 36, 30);
        ctx.fillStyle = "#171a25";
        ctx.fillRect(18, 23, 28, 20);
        ctx.fillStyle = "#e44858";
        ctx.beginPath();
        ctx.arc(32, 33, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(31, 25, 2, 16);
        ctx.fillRect(24, 32, 16, 2);
        break;
      case "medal":
        blockNoise(ctx, 64, 64, ["#234458", "#2b5d69", "#1d3648"], 16, 4);
        ctx.fillStyle = "#f6ca62";
        ctx.beginPath();
        ctx.arc(32, 31, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7d5520";
        ctx.beginPath();
        ctx.arc(32, 31, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff1aa";
        ctx.fillRect(29, 19, 6, 25);
        break;
      case "boss":
        blockNoise(ctx, 64, 64, ["#24162b", "#381b39", "#4b1f3f", "#17121f"], 17, 4);
        ctx.fillStyle = "#db3b4d";
        ctx.beginPath();
        ctx.arc(32, 30, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#11131a";
        ctx.fillRect(23, 25, 7, 5);
        ctx.fillRect(36, 25, 7, 5);
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath();
        ctx.moveTo(19, 18);
        ctx.lineTo(8, 5);
        ctx.lineTo(26, 13);
        ctx.moveTo(45, 18);
        ctx.lineTo(56, 5);
        ctx.lineTo(38, 13);
        ctx.fill();
        break;
      case "chest":
      case "chest_rare":
        blockNoise(ctx, 64, 64, ["#303541", "#3b3e48"], 18, 4);
        ctx.fillStyle = kind === "chest_rare" ? "#b6324b" : "#9c6332";
        ctx.fillRect(14, 27, 36, 20);
        ctx.fillStyle = kind === "chest_rare" ? "#f0c65a" : "#d7b45a";
        ctx.fillRect(14, 27, 36, 5);
        ctx.fillRect(30, 27, 5, 20);
        ctx.strokeStyle = "#20161a";
        ctx.lineWidth = 3;
        ctx.strokeRect(14, 27, 36, 20);
        break;
      case "magma-rock":
        blockNoise(ctx, 64, 64, ["#2b1a1b", "#4b2524", "#6a2c26", "#21151a"], 19, 4);
        ctx.fillStyle = "#f47b3d";
        ctx.fillRect(7, 42, 50, 5);
        ctx.fillRect(25, 20, 6, 37);
        ctx.fillStyle = "#ffd36a";
        ctx.fillRect(9, 44, 23, 2);
        break;
      case "ash-floor":
        blockNoise(ctx, 64, 64, ["#494b4f", "#5b514d", "#383c42", "#6a584a"], 20, 4);
        ctx.strokeStyle = "rgba(255,166,92,.25)";
        ctx.strokeRect(8, 8, 48, 48);
        break;
      case "highland":
        blockNoise(ctx, 64, 64, ["#466b4c", "#5b7b51", "#778c5e", "#2f5141"], 21, 4);
        ctx.strokeStyle = "rgba(232,238,197,.25)";
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(64, 8);
        ctx.moveTo(0, 42);
        ctx.lineTo(64, 35);
        ctx.stroke();
        break;
      case "carpet":
        blockNoise(ctx, 64, 64, ["#512743", "#65314c", "#3b2135"], 22, 4);
        ctx.strokeStyle = "#d7b45a";
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, 48, 48);
        ctx.strokeRect(18, 18, 28, 28);
        break;
      case "metal-wall":
      case "iron-plate":
        blockNoise(ctx, 64, 64, ["#354450", "#52616c", "#25313b", "#6e7880"], 23, 4);
        ctx.strokeStyle = "rgba(9,12,16,.5)";
        for (let i = 0; i < 64; i += 16) {
          ctx.strokeRect(i + 2, 2, 13, 60);
          ctx.fillStyle = "#b8c7c7";
          ctx.fillRect(i + 5, 8, 3, 3);
          ctx.fillRect(i + 10, 52, 3, 3);
        }
        break;
      case "marble-wall":
      case "white-tile":
        blockNoise(ctx, 64, 64, ["#bfc8c0", "#d9ded4", "#aab8b2", "#eef0e8"], 24, 4);
        ctx.strokeStyle = "rgba(50,70,80,.22)";
        drawBrickLines(ctx, "rgba(50,70,80,.22)", 16, 16);
        break;
      default:
        blockNoise(ctx, 64, 64, ["#303541", "#3c4151", "#252b36"], 42, 4);
    }

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.strokeRect(1, 1, 62, 62);
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.strokeRect(0, 0, 64, 64);
  });

  const battleBg = (kind) => canvasData(960, 540, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const palettes = {
      field: ["#122b35", "#2f694a", "#182029"],
      forest: ["#102a27", "#1d5134", "#0d171d"],
      mountain: ["#171d2a", "#505561", "#151821"],
      dungeon: ["#141720", "#303446", "#0d0f16"],
      boss: ["#1a1022", "#4d1f37", "#0d0812"],
      maze: ["#101522", "#27344b", "#090d16"],
      lastboss: ["#170b1b", "#641b42", "#05050a"]
    };
    const p = palettes[kind] || palettes.field;
    sky.addColorStop(0, p[0]);
    sky.addColorStop(0.64, p[1]);
    sky.addColorStop(1, p[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 9; i += 1) {
      ctx.fillStyle = i % 2 ? "#d7b45a" : "#67d7c4";
      ctx.beginPath();
      ctx.arc(110 + i * 105, 90 + ((i * 53) % 120), 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (kind === "forest" || kind === "field") {
      ctx.fillStyle = "rgba(11,31,25,.78)";
      for (let i = 0; i < 15; i += 1) {
        const x = i * 72 - 30;
        const y = 280 + ((i * 31) % 70);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 42, y - 130);
        ctx.lineTo(x + 84, y);
        ctx.fill();
      }
    }
    if (kind === "mountain") {
      ctx.fillStyle = "rgba(30,34,45,.72)";
      ctx.beginPath();
      ctx.moveTo(0, 335);
      ctx.lineTo(210, 120);
      ctx.lineTo(330, 318);
      ctx.lineTo(520, 105);
      ctx.lineTo(780, 335);
      ctx.lineTo(960, 160);
      ctx.lineTo(960, 540);
      ctx.lineTo(0, 540);
      ctx.closePath();
      ctx.fill();
    }
    if (kind === "dungeon" || kind === "maze") {
      ctx.fillStyle = "rgba(7,9,15,.55)";
      for (let i = 0; i < 10; i += 1) ctx.fillRect(i * 108, 0, 46, 330);
      ctx.strokeStyle = "rgba(215,180,90,.24)";
      ctx.lineWidth = 3;
      for (let y = 80; y < 340; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + (kind === "maze" ? 24 : 0));
        ctx.stroke();
      }
    }
    if (kind === "boss" || kind === "lastboss") {
      ctx.fillStyle = "rgba(219,59,77,.22)";
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath();
        ctx.arc(130 + i * 135, 225 + ((i * 41) % 80), 58 + (i % 3) * 17, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,215,126,.18)";
      ctx.fillRect(0, 350, w, 8);
    }

    const ground = ctx.createLinearGradient(0, 350, 0, h);
    ground.addColorStop(0, "rgba(245,221,150,.12)");
    ground.addColorStop(1, "rgba(5,8,12,.88)");
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, 366);
    ctx.quadraticCurveTo(240, 330, 480, 360);
    ctx.quadraticCurveTo(720, 392, 960, 342);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.closePath();
    ctx.fill();
  });

  const hero = (dir, step) => canvasData(64, 64, (ctx) => {
    const bob = step === 2 ? 1 : 0;
    const side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(32, 54, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#222733";
    ctx.fillRect(23 - side * 2, 43 - bob, 8, 9);
    ctx.fillRect(35 + side * 2, 43 + bob, 8, 9);
    ctx.fillStyle = "#5a2b2e";
    ctx.fillRect(21 - side * 2, 50 - bob, 11, 4);
    ctx.fillRect(35 + side * 2, 50 + bob, 11, 4);

    ctx.fillStyle = "#226e89";
    ctx.fillRect(22, 30, 20, 15);
    ctx.fillStyle = "#d7b45a";
    ctx.fillRect(29, 31, 6, 15);
    ctx.fillStyle = "#8b2f45";
    ctx.fillRect(18 - side * 2, 31, 7, 17);
    ctx.fillRect(39 + side * 2, 31, 7, 17);

    ctx.fillStyle = "#f1bb86";
    ctx.beginPath();
    ctx.arc(32 + side * 2, 23, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#233041";
    ctx.fillRect(20 + side, 11, 25, 8);
    ctx.fillRect(17 + side, 17, 31, 5);
    ctx.fillStyle = "#d7b45a";
    ctx.fillRect(30 + side, 8, 6, 7);

    ctx.fillStyle = "#18202a";
    if (dir === "up") {
      ctx.fillRect(23, 21, 18, 6);
      ctx.fillStyle = "#4d2f25";
      ctx.fillRect(24, 28, 17, 5);
    } else {
      ctx.fillRect(26 + side * 2, 23, 4, 4);
      ctx.fillRect(37 + side * 2, 23, 4, 4);
      ctx.fillStyle = "#8a3f35";
      ctx.fillRect(30 + side * 2, 31, 9, 2);
    }

    ctx.fillStyle = "#d9e2e0";
    if (dir === "left") {
      ctx.fillRect(12, 28, 4, 20);
      ctx.fillRect(8, 44, 12, 4);
    } else if (dir === "right") {
      ctx.fillRect(48, 28, 4, 20);
      ctx.fillRect(44, 44, 12, 4);
    } else {
      ctx.fillRect(48, 28, 4, 21);
      ctx.fillRect(45, 47, 10, 4);
    }
  });

  const installGraphics = () => {
    if (typeof GRAPHICS === "undefined" || !GRAPHICS.data) return;

    const generated = {
      floor: tile("floor"),
      forest: tile("forest"),
      sea: tile("sea"),
      mountain: tile("mountain"),
      Low_mountain: tile("Low_mountain"),
      wall: tile("wall"),
      dungeon_floor: tile("dungeon_floor"),
      stairs: tile("stairs"),
      cave: tile("cave"),
      hall: tile("hall"),
      "house-1": tile("house-1"),
      "house-2": tile("house-2"),
      inn: tile("inn"),
      casino: tile("casino"),
      medal: tile("medal"),
      boss: tile("boss"),
      chest: tile("chest"),
      chest_rare: tile("chest_rare"),
      "magma-rock": tile("magma-rock"),
      "ash-floor": tile("ash-floor"),
      cliff: tile("cliff"),
      highland: tile("highland"),
      canal: tile("canal"),
      "stone-pave": tile("stone-pave"),
      "brick-wall": tile("brick-wall"),
      carpet: tile("carpet"),
      "metal-wall": tile("metal-wall"),
      "iron-plate": tile("iron-plate"),
      "marble-wall": tile("marble-wall"),
      "white-tile": tile("white-tile"),
      "ancient-brick": tile("ancient-brick"),
      "moss-stone": tile("moss-stone"),
      battle_bg_field: battleBg("field"),
      battle_bg_forest: battleBg("forest"),
      battle_bg_mountain: battleBg("mountain"),
      battle_bg_dungeon: battleBg("dungeon"),
      battle_bg_boss: battleBg("boss"),
      battle_bg_maze: battleBg("maze"),
      battle_bg_lastboss: battleBg("lastboss"),
      hero_down_1: hero("down", 1),
      hero_down_2: hero("down", 2),
      hero_up_1: hero("up", 1),
      hero_up_2: hero("up", 2),
      hero_left_1: hero("left", 1),
      hero_left_2: hero("left", 2),
      hero_right_1: hero("right", 1),
      hero_right_2: hero("right", 2)
    };

    const aiAssets = {
      floor: "assets/managed/current/map/terrain/terrain_grass_field_v001.png",
      sea: "assets/managed/current/map/terrain/terrain_sea_v001.png",
      forest: "assets/managed/current/map/objects/object_field_forest_v003.png",
      mountain: "assets/managed/current/map/objects/object_field_mountain_v002.png",
      Low_mountain: "assets/managed/current/map/objects/object_field_low_mountain_v002.png",
      wall: "assets/managed/current/map/terrain/terrain_dungeon_wall_v001.png",
      wall_face: "assets/managed/current/map/terrain/terrain_dungeon_wall_face_v002.png",
      wall_face_torch: "assets/managed/current/map/terrain/terrain_dungeon_wall_face_torch_v002.png",
      dungeon_floor: "assets/managed/current/map/terrain/terrain_dungeon_floor_v001.png",
      stairs: "assets/managed/current/map/objects/object_field_stairs_v002.png",
      stairs_dungeon: "assets/managed/current/map/objects/object_dungeon_stairs_v002.png",
      cave: "assets/managed/current/map/objects/object_field_cave_v002.png",
      cave_dungeon: "assets/managed/current/map/terrain/terrain_dungeon_floor_v001.png",
      hall: "assets/managed/current/map/objects/object_field_hall_v002.png",
      "house-1": "assets/managed/current/map/objects/object_field_house_1_v002.png",
      "house-2": "assets/managed/current/map/objects/object_field_house_2_v002.png",
      village: "assets/managed/current/map/objects/object_field_village_v002.png",
      inn: "assets/managed/current/map/objects/object_field_inn_v002.png",
      casino: "assets/managed/current/map/objects/object_field_casino_v002.png",
      weapon: "assets/managed/current/map/objects/object_field_weapon_v002.png",
      shop: "assets/managed/current/map/objects/object_field_shop_v002.png",
      medal: "assets/managed/current/map/objects/object_field_medal_v002.png",
      town: "assets/managed/current/map/objects/object_field_town_v002.png",
      settlement: "assets/managed/current/map/objects/object_field_settlement_v002.png",
      castle: "assets/managed/current/map/objects/object_field_castle_v002.png",
      temple: "assets/managed/current/map/objects/object_field_temple_v002.png",
      fortress: "assets/managed/current/map/objects/object_field_fortress_v002.png",
      ruins: "assets/managed/current/map/objects/object_field_ruins_v002.png",
      lost: "assets/managed/current/map/objects/object_field_lost_v002.png",
      darkcastle: "assets/managed/current/map/objects/object_field_darkcastle_v002.png",
      lighthouse: "assets/managed/current/map/objects/object_field_lighthouse_v002.png",
      tower: "assets/managed/current/map/objects/object_field_tower_v002.png",
      farm: "assets/managed/current/map/objects/object_field_farm_v002.png",
      pot_grass: "assets/managed/current/map/objects/object_field_pot_v002.png",
      barrel_grass: "assets/managed/current/map/objects/object_field_barrel_v002.png",
      chest: "assets/managed/current/map/objects/object_field_chest_v002.png",
      chest_rare: "assets/managed/current/map/objects/object_field_chest_rare_v002.png",
      chest_dungeon: "assets/managed/current/map/objects/object_dungeon_chest_v002.png",
      chest_rare_dungeon: "assets/managed/current/map/objects/object_dungeon_chest_rare_v002.png",
      smith: "assets/managed/current/map/objects/object_field_smith_v002.png",
      fire_village: "assets/managed/current/map/objects/object_field_fire_village_v002.png",
      dummy_grass: "assets/managed/current/map/objects/object_field_grass_v002.png",
      boss: "assets/managed/current/map/objects/object_field_boss_v002.png",
      boss_dungeon: "assets/managed/current/map/objects/object_dungeon_boss_v002.png",
      event_field: "assets/managed/current/map/objects/object_field_event_v002.png",
      event_dungeon: "assets/managed/current/map/objects/object_dungeon_event_v002.png",
      portal_dungeon: "assets/managed/current/map/objects/object_dungeon_portal_v002.png",
      battle_bg_field: "assets/generated/battle-field-ai.png",
      battle_bg_forest: "assets/generated/battle-forest-ai.png",
      battle_bg_mountain: "assets/generated/battle-mountain-ai.png",
      battle_bg_dungeon: "assets/generated/battle-dungeon-ai.png",
      battle_bg_boss: "assets/generated/battle-boss-ai.png",
      battle_bg_maze: "assets/generated/battle-maze-ai.png",
      battle_bg_lastboss: "assets/generated/battle-abyss-ai.png",
      hero_down_1: "assets/generated/hero-down-1.gif",
      hero_down_2: "assets/generated/hero-down-2.gif",
      hero_up_1: "assets/generated/hero-up-1.gif",
      hero_up_2: "assets/generated/hero-up-2.gif",
      hero_left_1: "assets/generated/hero-left-1.gif",
      hero_left_2: "assets/generated/hero-left-2.gif",
      hero_right_1: "assets/generated/hero-right-1.gif",
      hero_right_2: "assets/generated/hero-right-2.gif",
      "monster_スライム": "assets/generated/monster-jelly-ai.png",
      "monster_ジェリー": "assets/generated/monster-jelly-ai.png",
      "monster_ヒールジェリー": "assets/generated/monster-heal-jelly-ai.png",
      "monster_リペアジェリー": "assets/generated/monster-heal-jelly-ai.png",
      "monster_ポイズンジェリー": "assets/generated/monster-heal-jelly-ai.png",
      "monster_メタルジェリー": "assets/generated/monster-metal-jelly-ai.png",
      "monster_シルバージェリー": "assets/generated/monster-metal-jelly-ai.png",
      "monster_ゴールドジェリー": "assets/generated/monster-metal-jelly-ai.png",
      "monster_ゴースト": "assets/generated/monster-ghost-ai.png",
      "monster_エビルゴースト": "assets/generated/monster-ghost-ai.png",
      "monster_やみこうもり": "assets/generated/monster-bat-ai.png",
      "monster_カースバット": "assets/generated/monster-bat-ai.png",
      "monster_キラーバット": "assets/generated/monster-bat-ai.png",
      "monster_ホーンラビット": "assets/generated/monster-horn-rabbit-ai.png",
      "monster_キラーラビット": "assets/generated/monster-horn-rabbit-ai.png",
      "monster_アーマーナイト": "assets/generated/monster-armor-knight-ai.png",
      "monster_カオスアーマー": "assets/generated/monster-armor-knight-ai.png",
      "monster_アーミーウルフ": "assets/generated/monster-army-wolf-ai.png",
      "monster_ダークウルフ": "assets/generated/monster-army-wolf-ai.png",
      "monster_アルリザード": "assets/generated/monster-lizard-warrior-ai.png",
      "monster_バトルリザード": "assets/generated/monster-lizard-warrior-ai.png",
      "monster_カオスリザード": "assets/generated/monster-lizard-warrior-ai.png",
      "monster_ベビーデビル": "assets/generated/monster-baby-devil-ai.png",
      "monster_小悪魔デビル": "assets/generated/monster-baby-devil-ai.png",
      "monster_ファイアウィスプ": "assets/generated/monster-fire-wisp-ai.png",
      "monster_サンダーウィスプ": "assets/generated/monster-thunder-wisp-ai.png",
      "monster_バンパイア": "assets/generated/monster-vampire-ai.png",
      "monster_機械兵士": "assets/generated/monster-machine-soldier-ai.png",
      "monster_デスマシーン": "assets/generated/monster-machine-soldier-ai.png",
      "monster_アビスドラゴン": "assets/generated/monster-abyss-dragon-ai.png",
      "monster_混沌竜アビス": "assets/generated/monster-abyss-dragon-ai.png"
    };

    Object.keys(aiAssets).forEach((key) => {
      if (key.startsWith("monster_")) delete aiAssets[key];
    });

    Object.assign(GRAPHICS.data, generated, aiAssets);
    if (GRAPHICS.spriteDefs) {
      Object.keys({ ...generated, ...aiAssets }).forEach((key) => delete GRAPHICS.spriteDefs[key]);
    }
  };

  const entry = (img, color) => ({ img, color });
  const installThemes = () => {
    if (typeof TILE_THEMES === "undefined") return;
    const themes = {
      WORLD: {
        W: entry("sea", "#155d7a"),
        M: entry("mountain", "#64636a"),
        F: entry("forest", "#1f6a3f"),
        L: entry("Low_mountain", "#6c6847"),
        G: entry("floor", "#2c7a4e"),
        T: entry("floor", "#2c7a4e"),
        I: entry("inn", "#d7b45a"),
        B: entry("boss", "#db3b4d"),
        E: entry("event_field", "#8f7dff"),
        D: entry("hall", "#303541")
      },
      DEFAULT: {
        W: entry("wall", "#303541"),
        T: entry("dungeon_floor", "#3c4151"),
        G: entry("dungeon_floor", "#3c4151"),
        S: entry("stairs_dungeon", "#d7b45a"),
        C: entry("chest_dungeon", "#9c6332"),
        R: entry("chest_rare_dungeon", "#b6324b"),
        B: entry("boss_dungeon", "#db3b4d"),
        I: entry("inn", "#356ab8"),
        K: entry("casino", "#7e3fa1"),
        E: entry("medal", "#f6ca62"),
        H: entry("dungeon_floor", "#8f7dff"),
        V: entry("dungeon_floor", "#4ab9d8")
      },
      START_VILLAGE: {
        W: entry("forest", "#1f6a3f"),
        T: entry("floor", "#2c7a4e"),
        G: entry("floor", "#2c7a4e"),
        H: entry("house-1", "#d9bd84"),
        V: entry("house-2", "#7e3fa1"),
        D: entry("cave", "#303541"),
        S: entry("floor", "#d7b45a"),
        C: entry("chest", "#9c6332"),
        R: entry("chest_rare", "#b6324b"),
        B: entry("boss", "#db3b4d")
      },
      START_CAVE: {
        W: entry("wall", "#303541"),
        T: entry("dungeon_floor", "#3c4151"),
        G: entry("dungeon_floor", "#3c4151"),
        S: entry("dungeon_floor", "#d7b45a"),
        V: entry("dungeon_floor", "#4ab9d8"),
        C: entry("chest_dungeon", "#9c6332"),
        R: entry("chest_rare_dungeon", "#b6324b"),
        B: entry("boss_dungeon", "#db3b4d")
      },
      FIRE_VILLAGE: { W: entry("magma-rock", "#4b2524"), T: entry("ash-floor", "#5b514d"), G: entry("ash-floor", "#5b514d") },
      WIND_VILLAGE: { W: entry("cliff", "#64636a"), T: entry("highland", "#5b7b51"), G: entry("highland", "#5b7b51") },
      WATER_CITY: { W: entry("canal", "#155d7a"), T: entry("stone-pave", "#3c4151"), G: entry("stone-pave", "#3c4151") },
      BIG_TOWER: { W: entry("brick-wall", "#6a3e4a"), T: entry("carpet", "#65314c"), G: entry("carpet", "#65314c") },
      THUNDER_FORT: { W: entry("metal-wall", "#52616c"), T: entry("iron-plate", "#52616c"), G: entry("iron-plate", "#52616c") },
      LIGHT_PALACE: { W: entry("marble-wall", "#d9ded4"), T: entry("white-tile", "#eef0e8"), G: entry("white-tile", "#eef0e8") },
      DARK_CASTLE: { W: entry("wall", "#242a32"), T: entry("dungeon_floor", "#252b36"), G: entry("dungeon_floor", "#252b36"), S: entry("stairs_dungeon", "#d7b45a"), B: entry("boss_dungeon", "#db3b4d") },
      ABYSS: { W: entry("wall", "#141720"), T: entry("dungeon_floor", "#252b36"), G: entry("dungeon_floor", "#252b36"), S: entry("stairs_dungeon", "#d7b45a"), B: entry("boss_dungeon", "#db3b4d") },
      RUINED_SHRINE: { W: entry("ancient-brick", "#4b5b48"), T: entry("moss-stone", "#3c5145"), G: entry("moss-stone", "#3c5145") }
    };

    Object.entries(themes).forEach(([key, value]) => {
      TILE_THEMES[key] = { ...(TILE_THEMES[key] || {}), ...value };
    });
  };

  const installNames = () => {
    const names = {
      START_VILLAGE: "はじまりの村",
      START_CAVE: "試練の洞窟",
      FIRE_VILLAGE: "火の里",
      WIND_VILLAGE: "風の集落",
      WATER_CITY: "水上都市",
      BIG_TOWER: "大灯台",
      THUNDER_FORT: "雷の要塞",
      LIGHT_PALACE: "光の神殿",
      DARK_CASTLE: "常闇城",
      ABYSS: "深淵の魔窟",
      RUINED_SHRINE: "朽ちた神殿",
      MEDAL: "メダル王の館",
      CASINO: "カジノ"
    };
    if (typeof STORY_DATA !== "undefined" && STORY_DATA.areas) {
      Object.entries(names).forEach(([key, name]) => {
        if (STORY_DATA.areas[key]) STORY_DATA.areas[key].name = name;
      });
    }
    if (typeof FIXED_MAPS !== "undefined") {
      Object.entries(names).forEach(([key, name]) => {
        if (FIXED_MAPS[key]) FIXED_MAPS[key].name = name;
      });
    }
    if (typeof FIXED_DUNGEON_MAPS !== "undefined") {
      Object.entries(names).forEach(([key, name]) => {
        if (FIXED_DUNGEON_MAPS[key]) FIXED_DUNGEON_MAPS[key].name = name;
      });
    }
  };

  const shouldReplace = (text) => !text || garbledRe.test(text);
  const fixTitleText = () => {
    document.title = document.body && byId("player-name") ? "PRISMA ABYSS" : document.title;
    const name = byId("player-name");
    if (name) {
      name.placeholder = "名前を入力";
      if (shouldReplace(name.value)) name.value = "アルス";
    }
    const iconLabel = document.querySelector(".file-input-wrapper label");
    if (iconLabel) iconLabel.textContent = "主人公アイコン（任意）";
    const newBtn = document.querySelector(".btn-new");
    if (newBtn) newBtn.textContent = "はじめから";
    const loadBtn = byId("btn-continue");
    if (loadBtn && !/Lv\./.test(loadBtn.textContent)) loadBtn.textContent = "つづきから";
    const manageBtn = document.querySelector(".btn-container > button:not(.btn-new):not(.btn-load)");
    if (manageBtn) manageBtn.textContent = "データ管理";
    const modalTitle = document.querySelector(".modal-title");
    if (modalTitle) modalTitle.textContent = "データ管理";
    const installBtn = byId("installBtn");
    if (installBtn) installBtn.textContent = "アプリをインストール";
    const updateBtn = byId("updateBtn");
    if (updateBtn) updateBtn.textContent = "アプリを更新";
    const deleteBtn = byId("deleteBtn");
    if (deleteBtn) deleteBtn.textContent = "セーブデータを削除";
    const closeBtn = document.querySelector(".btn-close");
    if (closeBtn) closeBtn.textContent = "戻る";
    const importBtn = document.querySelector("#modal-content .btn-modal:not(#installBtn):not(#updateBtn):not(#deleteBtn)");
    if (importBtn) importBtn.textContent = "バックアップから復元";
  };

  const fixGameText = () => {
    const loc = byId("loc-name");
    if (loc && shouldReplace(loc.textContent)) loc.textContent = "フィールド";
    const msg = byId("msg-text");
    if (msg && garbledRe.test(msg.textContent || "")) msg.textContent = "";
    const action = byId("action-indicator");
    if (action && shouldReplace(action.textContent)) action.textContent = "決定";
    setText("btn-up", "▲");
    setText("btn-left", "◀");
    setText("btn-right", "▶");
    setText("btn-down", "▼");
    setText("btn-menu", "MENU");
    setText("btn-ok", "OK");
    setText("btn-attack", "こうげき");
    setText("btn-skill", "スキル");
    setText("btn-item", "どうぐ");
    setText("btn-defend", "ぼうぎょ");
    setText("btn-run", "にげる");
    const targetTitle = document.querySelector("#battle-target-window > div");
    if (targetTitle && shouldReplace(targetTitle.textContent)) targetTitle.textContent = "対象を選択";
    const listTitle = byId("battle-list-title");
    if (listTitle && shouldReplace(listTitle.textContent)) listTitle.textContent = "選択";
    document.querySelectorAll('button[onclick*="Battle.cancelSubMenu"]').forEach((button) => {
      if (shouldReplace(button.textContent)) button.textContent = "戻る";
    });
    const menuClose = document.querySelector('#menu-overlay button[onclick*="Menu.closeMainMenu"]');
    if (menuClose && shouldReplace(menuClose.textContent)) menuClose.textContent = "閉じる";
    const skip = byId("btn-gacha-skip");
    if (skip && shouldReplace(skip.textContent)) skip.textContent = "スキップ";
    const rates = byId("modal-rates");
    if (rates) {
      const title = rates.querySelector(".header-bar span");
      const close = rates.querySelector(".header-bar button");
      if (title && shouldReplace(title.textContent)) title.textContent = "提供割合";
      if (close && shouldReplace(close.textContent)) close.textContent = "閉じる";
    }
  };

  const fixStaticText = () => {
    fixTitleText();
    fixGameText();
  };

  const enhanceControls = () => {
    if (document.documentElement.dataset.polishControls === "1") return;
    document.documentElement.dataset.polishControls = "1";

    [
      ["btn-up", "上へ移動"],
      ["btn-left", "左へ移動"],
      ["btn-right", "右へ移動"],
      ["btn-down", "下へ移動"],
      ["btn-menu", "メニュー"],
      ["btn-ok", "決定"]
    ].forEach(([id, label]) => {
      const el = byId(id);
      if (el) el.setAttribute("aria-label", label);
    });

    const target = byId("canvas-wrapper") || byId("field-canvas");
    if (target && typeof Field !== "undefined") {
      let startX = 0;
      let startY = 0;
      let active = false;
      target.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") return;
        if (typeof Menu !== "undefined" && Menu.isMenuOpen && Menu.isMenuOpen()) return;
        startX = event.clientX;
        startY = event.clientY;
        active = true;
      }, { passive: true });
      target.addEventListener("pointerup", (event) => {
        if (!active) return;
        active = false;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
        if (Math.abs(dx) > Math.abs(dy)) Field.move(dx > 0 ? 1 : -1, 0);
        else Field.move(0, dy > 0 ? 1 : -1);
      }, { passive: true });
    }

    window.addEventListener("keydown", (event) => {
      const key = event.key;
      const moveKeys = { W: [0, -1], A: [-1, 0], S: [0, 1], D: [1, 0] };
      const upper = key.toUpperCase();
      if (moveKeys[upper] && typeof Field !== "undefined") {
        const scene = byId("field-scene");
        if (scene && scene.style.display !== "none" && !(typeof Menu !== "undefined" && Menu.isMenuOpen && Menu.isMenuOpen())) {
          event.preventDefault();
          Field.move(moveKeys[upper][0], moveKeys[upper][1]);
        }
      }
      if (key === "Escape" && typeof Menu !== "undefined" && Menu.closeMainMenu) {
        const overlay = byId("menu-overlay");
        if (overlay && overlay.style.display !== "none") {
          event.preventDefault();
          Menu.closeMainMenu();
        }
      }
    });
  };

  const BattleFX = {
    lastAt: 0,
    current: null,
    totalHitEvents: 0,
    pendingNeutralPhysicalKind: null,
    pendingNeutralPhysicalTimer: 0,
    pendingCriticalKind: null,
    pendingCriticalTimer: 0,
    assets: {
      slash: "assets/generated/fx-slash-ai.png",
      claw: "assets/generated/fx-claw-ai.png",
      fire: "assets/generated/fx-fire-ai.png",
      ice: "assets/generated/fx-ice-ai.png",
      thunder: "assets/generated/fx-thunder-ai.png",
      wind: "assets/generated/fx-wind-ai.png",
      light: "assets/generated/fx-light-ai.png",
      dark: "assets/generated/fx-dark-ai.png",
      chaos: "assets/generated/fx-chaos-ai.png",
      heal: "assets/generated/fx-heal-ai.png",
      buff: "assets/managed/current/battle/fx/fx_support_buff_v001.png",
      debuff: "assets/managed/current/battle/fx/fx_support_debuff_v001.png",
      combo: "assets/generated/fx-combo-ai.png",
      "all-slash": "assets/generated/fx-all-slash-ai.png",
      "enemy-claw": "assets/generated/fx-enemy-claw-ai.png",
      "party-hit": "assets/generated/fx-party-hit-ai.png",
      meteor: "assets/generated/fx-meteor-ai.png",
      "ice-spear": "assets/generated/fx-ice-spear-ai.png",
      "thunder-pillar": "assets/generated/fx-thunder-pillar-ai.png",
      "abyss-vortex": "assets/generated/fx-abyss-vortex-ai.png",
      "holy-burst": "assets/generated/fx-holy-burst-ai.png",
      poison: "assets/generated/fx-poison-ai.png",
      "ultimate-chaos": "assets/generated/fx-ultimate-chaos-ai.png",
      "heal-blossom": "assets/managed/current/battle/fx/fx_support_heal_v001.png",
      "neutral-slash": "assets/managed/current/battle/fx/fx_phys_neutral_slash_v001.png",
      "neutral-smash": "assets/managed/current/battle/fx/fx_phys_neutral_smash_v001.png",
      "neutral-pierce": "assets/managed/current/battle/fx/fx_phys_neutral_pierce_v001.png",
      "neutral-combo": "assets/managed/current/battle/fx/fx_phys_neutral_combo_v001.png",
      "neutral-chain": "assets/managed/current/battle/fx/fx_phys_neutral_chain_v001.png",
      "neutral-heavy": "assets/managed/current/battle/fx/fx_phys_neutral_heavy_v001.png",
      "phys-sword": "assets/managed/current/battle/fx/fx_phys_neutral_slash_v001.png",
      "phys-spear": "assets/managed/current/battle/fx/fx_phys_neutral_pierce_v001.png",
      "phys-axe": "assets/managed/current/battle/fx/fx_phys_neutral_smash_v001.png",
      "phys-combo": "assets/managed/current/battle/fx/fx_phys_neutral_combo_v001.png",
      "spell-fire": "assets/managed/current/battle/fx/fx_spell_fire_v001.png",
      "spell-ice": "assets/managed/current/battle/fx/fx_spell_ice_v001.png",
      "spell-thunder": "assets/managed/current/battle/fx/fx_spell_thunder_v001.png",
      "spell-wind": "assets/managed/current/battle/fx/fx_spell_wind_v001.png",
      "spell-light": "assets/managed/current/battle/fx/fx_spell_light_v001.png",
      "spell-dark": "assets/managed/current/battle/fx/fx_spell_dark_v001.png",
      "spell-chaos": "assets/managed/current/battle/fx/fx_spell_chaos_v001.png",
      breath: "assets/managed/current/battle/fx/fx_breath_dragon_v001.png",
      "special-rupture": "assets/managed/current/battle/fx/fx_special_rupture_v001.png",
      "critical-spark": "assets/managed/current/battle/fx/fx_critical_spark_v001.png"
    },
    stripHtml(value) {
      const div = document.createElement("div");
      div.innerHTML = String(value || "");
      return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
    },
    assetFor(kind) {
      const key = String(kind || "").replace(/^battle-fx-/, "");
      if (this.assets[key]) return this.assets[key];
      if (/^breath-/.test(key)) return this.assets.breath;
      if (/^phys-(fire|ice|thunder|wind|light|dark|chaos)$/.test(key)) return this.assets["neutral-slash"];
      return null;
    },
    isArea(cmd) {
      const scope = [cmd?.targetScope, cmd?.target, cmd?.data?.target].filter(Boolean).join(" ");
      return /全体|全敵|all|蜈ｨ菴|陷茨ｽｨ/i.test(scope);
    },
    hitCount(cmd) {
      return Math.max(1, Number(cmd?.data?.count || cmd?.hitCount || 1) || 1);
    },
    specialKind(data, cmd) {
      const raw = [data?.elm, data?.type, data?.name, data?.desc].filter(Boolean).join(" ");
      if (/火|炎|メラ|ギラ|燃|轣ｫ|轤|辟/.test(raw)) return "fire";
      if (/水|氷|ヒャ|凍|豌ｴ|豌ｷ/.test(raw)) return "ice";
      if (/雷|電|ライ|稲妻|髮ｷ|髮ｻ/.test(raw)) return "thunder";
      if (/風|バギ|嵐|鬚ｨ/.test(raw)) return "wind";
      if (/光|聖|閃|蜈/.test(raw)) return "light";
      if (/闇|ドル|影|暗黒|髣/.test(raw)) return "dark";
      if (/混沌|深淵|カオス|豺ｷ|雎ｺ/.test(raw)) return "chaos";
      if (/回復|蘇生|治|癒|ヒール|蝗槫ｾｩ|豐ｻ/.test(raw)) return "heal";
      if (/強化|防御|耐性|アップ|蠑ｷ蛹|陟托ｽｷ/.test(raw)) return "buff";
      if (/弱体|毒|封印|眠|恐怖|ダウン|蠑ｱ菴|陟托ｽｱ/.test(raw)) return "debuff";
      if (/カラミティ|深淵|混沌|災厄|終焉|奈落|豺ｷ|雎ｺ/.test(raw)) return "ultimate-chaos";
      if (/メテオ|隕石|流星|彗星/.test(raw)) return "meteor";
      if (/氷|吹雪|ブリザード|凍|豌ｷ/.test(raw)) return "ice-spear";
      if (/雷|稲妻|サンダー|ライトニング|髮ｷ|髮ｻ/.test(raw)) return "thunder-pillar";
      if (/毒|ポイズン|猛毒|蠍|蝮/.test(raw)) return "poison";
      if (/聖|光|ホーリー|天罰|蜈榎/.test(raw)) return "holy-burst";
      if (/闇|暗黒|影|アビス|髣/.test(raw)) return "abyss-vortex";
      return null;
    },
    specialKind(data, cmd) {
      const raw = [data?.elm, data?.type, data?.name, data?.desc].filter(Boolean).join(" ");
      if (/カラミティ|深淵|混沌|災厄|終焉|奈落|豺ｷ|雎ｺ/.test(raw)) return "ultimate-chaos";
      if (/メテオ|隕石|流星|彗星/.test(raw)) return "meteor";
      if (/氷|吹雪|ブリザード|凍|豌ｷ/.test(raw)) return "ice-spear";
      if (/雷|稲妻|サンダー|ライトニング|髮ｷ|髮ｻ/.test(raw)) return "thunder-pillar";
      if (/毒|ポイズン|猛毒|蠍|蝮/.test(raw)) return "poison";
      if (/聖|光|ホーリー|天罰|蜈榎/.test(raw)) return "holy-burst";
      if (/闇|暗黒|影|アビス|髣/.test(raw)) return "abyss-vortex";
      return null;
    },
    visualKind(cmd, perHit = false) {
      const support = this.isSupport(cmd?.data);
      if (support) return this.specialKind(cmd?.data, cmd) || "heal-blossom";
      const special = this.specialKind(cmd?.data, cmd);
      if (special) return special;
      const base = this.elementKind(cmd?.data, cmd);
      if (cmd?.isEnemy || cmd?.type === "enemy_attack") return perHit ? "party-hit" : "enemy-claw";
      if (this.isArea(cmd) && (base === "slash" || base === "claw")) return "all-slash";
      if (perHit && this.hitCount(cmd) > 1 && (base === "slash" || base === "claw")) return "combo";
      return base;
    },
    ensureLayer() {
      const scene = byId("battle-scene");
      if (!scene) return null;
      let layer = byId("battle-fx-layer");
      if (!layer) {
        layer = document.createElement("div");
        layer.id = "battle-fx-layer";
        scene.appendChild(layer);
      }
      return layer;
    },
    isEnemy(unit) {
      return typeof Battle !== "undefined" && Battle.enemies && Battle.enemies.includes(unit);
    },
    isParty(unit) {
      return typeof Battle !== "undefined" && Battle.party && Battle.party.includes(unit);
    },
    nodeForUnit(containerId, unit, units) {
      const container = byId(containerId);
      if (!container || !unit || !units) return null;
      const index = units.indexOf(unit);
      const nodes = Array.from(container.children || []);
      const uid = unit.uid !== undefined && unit.uid !== null ? String(unit.uid) : null;
      if (uid) {
        const foundByUid = nodes.find((node) => node.dataset?.battleUid === uid);
        if (foundByUid) return foundByUid;
      }
      const foundByIndex = nodes.find((node) => node.dataset?.battleIndex === String(index));
      return foundByIndex || nodes[index] || null;
    },
    isBossTarget(unit) {
      return !!(
        this.isEnemy(unit) &&
        (unit?.isBoss || unit?.id >= 1000 || unit?.baseId >= 1000 || byId("battle-scene")?.dataset?.bossBattle === "true" ||
          (typeof App !== "undefined" && App.data?.battle?.isBossBattle))
      );
    },
    elementKind(data, cmd) {
      const raw = [data?.elm, data?.type, data?.name, data?.desc].filter(Boolean).join(" ");
      if (/火|炎|メラ|ギラ|轣|焔/.test(raw)) return "fire";
      if (/水|氷|ヒャ|豌/.test(raw)) return "ice";
      if (/雷|電|ライ|髮/.test(raw)) return "thunder";
      if (/風|バギ|鬚/.test(raw)) return "wind";
      if (/光|聖|蜈/.test(raw)) return "light";
      if (/闇|ドル|影|髣/.test(raw)) return "dark";
      if (/混沌|深淵|豺/.test(raw)) return "chaos";
      if (/回復|蘇生|治|蝗|陂/.test(raw)) return "heal";
      if (/強化|防御|耐性|蠑ｷ/.test(raw)) return "buff";
      if (/弱体|毒|封|恐|感電|蠑ｱ|豈|諢|蟆|諤/.test(raw)) return "debuff";
      if (/ブレス|息|繝悶Ξ/.test(raw)) return cmd?.isEnemy ? "dark" : "wind";
      if (cmd?.type === "enemy_attack") return "claw";
      return "slash";
    },
    elementKind(data, cmd) {
      const raw = [data?.elm, data?.type, data?.name, data?.desc].filter(Boolean).join(" ");
      if (/火|炎|メラ|ギラ|燃|轣ｫ|轤|辟/.test(raw)) return "fire";
      if (/水|氷|ヒャ|凍|豌ｴ|豌ｷ/.test(raw)) return "ice";
      if (/雷|電|ライ|稲妻|髮ｷ|髮ｻ/.test(raw)) return "thunder";
      if (/風|バギ|嵐|鬚ｨ/.test(raw)) return "wind";
      if (/光|聖|閃|蜈/.test(raw)) return "light";
      if (/闇|ドル|影|暗黒|髣/.test(raw)) return "dark";
      if (/混沌|深淵|カオス|豺ｷ|雎ｺ/.test(raw)) return "chaos";
      if (/回復|蘇生|治|癒|ヒール|蝗槫ｾｩ|豐ｻ/.test(raw)) return "heal";
      if (/強化|防御|耐性|アップ|蠑ｷ蛹|陟托ｽｷ/.test(raw)) return "buff";
      if (/弱体|毒|封印|眠|恐怖|ダウン|蠑ｱ菴|陟托ｽｱ/.test(raw)) return "debuff";
      if (cmd?.type === "enemy_attack") return "claw";
      return "slash";
    },
    isSupport(data) {
      if (!data) return false;
      if (typeof Battle !== "undefined" && typeof Battle.isSupportSkill === "function" && Battle.isSupportSkill(data)) return true;
      const raw = [data.type, data.name, data.desc].filter(Boolean).join(" ");
      return /回復|蘇生|強化|治|蝗|陂|蠑ｷ/.test(raw);
    },
    isSupport(data) {
      if (!data) return false;
      if (typeof Battle !== "undefined" && typeof Battle.isSupportSkill === "function" && Battle.isSupportSkill(data)) return true;
      const raw = [data.type, data.name, data.desc].filter(Boolean).join(" ");
      return /回復|蘇生|治療|癒|ヒール|強化|防御|耐性|アップ|蝗槫ｾｩ|陂・函|蠑ｷ蛹|豐ｻ|陟托ｽｷ/.test(raw);
    },
    rawData(data) {
      return [data?.elm, data?.type, data?.name, data?.desc].filter(Boolean).join(" ");
    },
    hasAny(raw, words) {
      return words.some((word) => word && String(raw || "").includes(word));
    },
    elementKind(data, cmd) {
      const raw = this.rawData(data);
      if (this.hasAny(raw, ["火", "メラ", "ギラ", "fire", "轣ｫ", "轤", "繝｡繝ｩ", "繧ｮ繝ｩ", "辯", "霓"])) return "fire";
      if (this.hasAny(raw, ["水", "氷", "ヒャ", "ice", "豌ｴ", "豌ｷ", "繝偵Ε", "雎", "蜃"])) return "ice";
      if (this.hasAny(raw, ["雷", "電", "ライ", "サンダ", "thunder", "髮ｷ", "髮ｻ", "繝ｩ繧､", "繧ｵ繝ｳ繝", "鬮ｮ"])) return "thunder";
      if (this.hasAny(raw, ["風", "バギ", "wind", "鬚ｨ", "繝舌ぐ", "鬯"])) return "wind";
      if (this.hasAny(raw, ["光", "聖", "ホーリ", "light", "蜈", "閨", "陷"])) return "light";
      if (this.hasAny(raw, ["闇", "影", "ドル", "dark", "髣", "繝峨Ν", "蠖ｱ", "證"])) return "dark";
      if (this.hasAny(raw, ["混沌", "カオス", "chaos", "豺ｷ豐", "繧ｫ繧ｪ繧ｹ", "雎ｺ", "髮趣"])) return "chaos";
      if (this.hasAny(raw, ["回復", "治療", "heal", "蝗槫ｾｩ", "豐ｻ", "陂"])) return "heal";
      if (this.hasAny(raw, ["強化", "防御", "buff", "蠑ｷ蛹", "髦ｲ", "閠"])) return "buff";
      if (this.hasAny(raw, ["弱体", "眠", "毒", "debuff", "蠑ｱ菴", "逵", "豈"])) return "debuff";
      if (cmd?.type === "enemy_attack") return "claw";
      return "neutral";
    },
    specialKind(data, cmd) {
      const raw = this.rawData(data);
      if (this.hasAny(raw, ["カラミティ", "終焉", "混沌災厄", "繧ｫ繝ｩ繝溘ユ繧｣", "邨らч", "螂郁誠"])) return "ultimate-chaos";
      if (this.hasAny(raw, ["メテオ", "隕石", "流星", "繝｡繝・が", "髫慕浹", "豬∵弌"])) return "meteor";
      if (this.hasAny(raw, ["ブリザード", "吹雪", "氷槍", "繝悶Μ繧ｶ", "蜷ｹ髮ｪ"])) return "ice-spear";
      if (this.isSpellData(data, cmd) && this.hasAny(raw, ["サンダー", "ライトニング", "雷柱", "繧ｵ繝ｳ繝", "繝ｩ繧､繝医ル"])) return "thunder-pillar";
      if (this.hasAny(raw, ["ポイズン", "毒", "豈", "迪帶ｯ"])) return "poison";
      if (this.hasAny(raw, ["ホーリー", "天罰", "聖光", "繝帙・繝ｪ", "螟ｩ鄂ｰ"])) return "holy-burst";
      if (this.hasAny(raw, ["アビス", "深淵", "闇影", "繧｢繝薙せ", "豺ｱ豺ｵ"])) return "abyss-vortex";
      return null;
    },
    isSpellData(data, cmd) {
      const raw = this.rawData(data);
      if (cmd?.isReaction) return false;
      if (this.hasAny(raw, ["魔法", "呪文", "spell", "鬲疲ｳ", "繝｡繝ｩ", "繝偵Ε", "繝舌ぐ", "繧､繧ｪ", "繝峨Ν"])) return true;
      if (this.isPhysicalData(data, cmd) || this.isSupport(data)) return false;
      return !!data?.elm && !cmd?.isEnemy;
    },
    isPhysicalData(data, cmd) {
      const raw = this.rawData(data);
      return !!(
        cmd?.type === "attack" ||
        cmd?.isReaction ||
        this.hasAny(raw, ["物理", "通常攻撃", "特技", "攻撃", "斬", "剣", "槍", "斧", "爪", "拳", "打撃", "迚ｩ逅", "騾壼ｸｸ謾ｻ", "迚ｹ谿", "謾ｻ謦"])
      );
    },
    isBreathData(data) {
      const raw = this.rawData(data);
      return this.hasAny(raw, ["ブレス", "息", "breath", "繝悶Ξ繧ｹ", "諱ｯ", "郢晄じ"]);
    },
    isDebuffOnlyData(data) {
      if (!data) return false;
      const raw = this.rawData(data);
      if (data.PercentDamage) return false;
      if (String(data.type || "") === "弱体" || this.hasAny(raw, ["弱体", "デバフ", "debuff"])) return true;
      const hasDebuff = !!(data.debuff || data.Poison || data.ToxicPoison || data.Shock || data.Fear || data.SpellSeal || data.SkillSeal || data.HealSeal || data.Debuff);
      return hasDebuff && Number(data.rate || 0) <= 0 && Number(data.base || 0) <= 0;
    },
    statusOnlyKind(data, cmd) {
      if (!data) return null;
      const noDirectDamage = Number(data.rate || 0) <= 0 && Number(data.base || 0) <= 0 && !data.fix && !data.ratio;
      if (!noDirectDamage) return null;
      if (data.Poison || data.ToxicPoison) return "poison";
      if (data.PercentDamage || data.InstantDeath) return "abyss-vortex";
      if (data.debuff || data.Debuff || data.Shock || data.Fear || data.SpellSeal || data.SkillSeal || data.HealSeal) return "debuff";
      return null;
    },
    isSpecialAttackData(data, cmd) {
      const raw = this.rawData(data);
      return !!(
        data &&
        !this.isSupport(data) &&
        !this.isBreathData(data) &&
        this.hasAny(raw, ["特殊", "special", "迚ｹ谿", "奥義", "秘技"])
      );
    },
    supportKind(data, cmd) {
      const type = String(data?.type || "");
      if (type.includes("強化") || data?.buff || data?.elmResUp || data?.HPRegen || data?.MPRegen) return "buff";
      if (type.includes("回復") || type.includes("蘇生") || type.includes("MP回復") || data?.CureAilments || data?.debuff_reset) return "heal-blossom";
      const base = this.elementKind(data, cmd);
      if (base === "buff") return "buff";
      if (base === "debuff") return "debuff";
      if (base === "heal") return "heal-blossom";
      return this.specialKind(data, cmd) || "heal-blossom";
    },
    ultimateSkillKind(data, cmd) {
      const id = Number(data?.id || 0);
      if ([500, 901, 906, 999].includes(id)) return "ultimate-chaos";
      if (id === 501) return "holy-burst";
      if ([502, 902, 924].includes(id)) return "abyss-vortex";
      if (id === 925) return "meteor";
      if ((id >= 500 && id <= 502) || id >= 900) return this.specialKind(data, cmd) || "special-rupture";
      return null;
    },
    spellKind(data, cmd) {
      const base = this.elementKind(data, cmd);
      return ({
        fire: "spell-fire",
        ice: "spell-ice",
        thunder: "spell-thunder",
        wind: "spell-wind",
        light: "spell-light",
        dark: "spell-dark",
        chaos: "spell-chaos"
      })[base] || "spell-dark";
    },
    elementFxKind(prefix, data, cmd) {
      const base = this.elementKind(data, cmd);
      return ["fire", "ice", "thunder", "wind", "light", "dark", "chaos"].includes(base) ? `${prefix}-${base}` : null;
    },
    breathKind(data, cmd) {
      return this.elementFxKind("breath", data, cmd) || "breath";
    },
    physicalElementKind(cmd) {
      return this.elementFxKind("phys", cmd?.data, cmd);
    },
    physicalKind(cmd, perHit = false) {
      const raw = this.rawData(cmd?.data);
      if (cmd?.isReaction) return this.pendingNeutralPhysicalKind || "neutral-chain";
      if (this.hitCount(cmd) > 1) return perHit ? "neutral-slash" : "phys-sword";
      if (this.hasAny(raw, ["槍", "突", "pierce", "spear"])) return "neutral-pierce";
      if (this.hasAny(raw, ["斧", "打", "砕", "粉砕", "smash", "axe"])) return "neutral-smash";
      if (this.hasAny(raw, ["奥義", "渾身", "heavy", "finisher"])) return "neutral-heavy";
      return perHit ? "neutral-slash" : "phys-sword";
    },
    visualKind(cmd, perHit = false) {
      if (!cmd) return "neutral-slash";
      const statusOnly = this.statusOnlyKind(cmd?.data, cmd);
      if (statusOnly) return statusOnly;
      if (this.isDebuffOnlyData(cmd?.data)) {
        if (cmd?.data?.Poison || cmd?.data?.ToxicPoison) return "poison";
        const base = this.elementKind(cmd?.data, cmd);
        return base === "poison" ? "poison" : "debuff";
      }
      if (this.isSupport(cmd?.data)) return this.supportKind(cmd?.data, cmd);
      if (this.isBreathData(cmd?.data)) return this.breathKind(cmd?.data, cmd);
      if (cmd?.isReaction) return this.physicalKind(cmd, perHit);
      const ultimate = this.ultimateSkillKind(cmd?.data, cmd);
      if (ultimate) return ultimate;
      const special = this.specialKind(cmd?.data, cmd);
      if (special) return special;
      if (this.isSpecialAttackData(cmd?.data, cmd)) {
        const base = this.elementKind(cmd?.data, cmd);
        if (["fire", "ice", "thunder", "wind", "light", "dark", "chaos"].includes(base)) return this.spellKind(cmd?.data, cmd);
        return "special-rupture";
      }
      if (this.isSpellData(cmd?.data, cmd)) return this.spellKind(cmd?.data, cmd);
      if (cmd?.isEnemy || cmd?.type === "enemy_attack") return perHit ? "party-hit" : "enemy-claw";
      if (this.isPhysicalData(cmd?.data, cmd)) return this.physicalElementKind(cmd) || (this.isArea(cmd) ? "all-slash" : this.physicalKind(cmd, perHit));
      return "neutral-slash";
    },
    logNeutralPhysicalKind(text) {
      if (this.hasAny(text, ["連携", "騾｣謳ｺ"])) return "neutral-chain";
      if (this.hasAny(text, ["追撃", "追い討ち", "霑ｽ", "霑ｽ縺・ｨ弱■"])) return "neutral-slash";
      if (this.hasAny(text, ["反撃", "蜿肴茶"])) return "neutral-smash";
      if (this.hasAny(text, ["先制", "蜈亥宛"])) return "neutral-pierce";
      return null;
    },
    queueNeutralPhysicalKind(kind) {
      if (!kind) return;
      this.pendingNeutralPhysicalKind = kind;
      if (this.pendingNeutralPhysicalTimer) clearTimeout(this.pendingNeutralPhysicalTimer);
      this.pendingNeutralPhysicalTimer = setTimeout(() => {
        if (this.pendingNeutralPhysicalKind === kind) this.pendingNeutralPhysicalKind = null;
      }, 1600);
      document.documentElement.dataset.polishLastFxCue = kind;
    },
    consumeNeutralPhysicalKind() {
      const kind = this.pendingNeutralPhysicalKind;
      if (kind) {
        this.pendingNeutralPhysicalKind = null;
        if (this.pendingNeutralPhysicalTimer) clearTimeout(this.pendingNeutralPhysicalTimer);
      }
      return kind;
    },
    criticalKindFromLog(text) {
      if (this.hasAny(text, ["かいしん", "会心", "痛恨", "魔力が暴走", "暴走", "防御を貫通", "貫通", "魔法ダメージ2倍", "魔法ダメージ２倍", "呪文ダメージ2倍", "呪文ダメージ２倍", "荳謦", "垓襍ｰ"])) return "critical-spark";
      return null;
    },
    queueCriticalKind(kind) {
      if (!kind) return;
      this.pendingCriticalKind = kind;
      if (this.pendingCriticalTimer) clearTimeout(this.pendingCriticalTimer);
      this.pendingCriticalTimer = setTimeout(() => {
        if (this.pendingCriticalKind === kind) this.pendingCriticalKind = null;
      }, 1400);
      document.documentElement.dataset.polishLastFxCue = kind;
    },
    consumeCriticalKind() {
      const kind = this.pendingCriticalKind;
      if (kind) {
        this.pendingCriticalKind = null;
        if (this.pendingCriticalTimer) clearTimeout(this.pendingCriticalTimer);
      }
      return kind;
    },
    enhancedDamageKind(cmd) {
      if (!cmd || cmd?.isReaction) return null;
      if (cmd?.data?.IgnoreDefense) return "critical-spark";
      const magBuff = Number(cmd?.actor?.battleStatus?.buffs?.mag?.val || 0);
      if (this.isSpellData(cmd?.data, cmd) && (cmd?.actor?.passive?.magDouble || magBuff >= 2)) return "critical-spark";
      return null;
    },
    snapshot() {
      if (typeof Battle === "undefined") return new Map();
      return new Map([...(Battle.party || []), ...(Battle.enemies || [])].filter(Boolean).map((unit) => [unit, {
        hp: Number(unit.hp || 0),
        mp: Number(unit.mp || 0)
      }]));
    },
    targetPool(cmd, support) {
      if (typeof Battle === "undefined") return [];
      if (cmd?.isEnemy) {
        return support
          ? (Battle.enemies || []).filter((e) => e && !e.isFled && !e.isDead)
          : (Battle.party || []).filter((p) => p && !p.isDead);
      }
      return support
        ? (Battle.party || []).filter((p) => p && !p.isDead)
        : (Battle.enemies || []).filter((e) => e && !e.isDead && !e.isFled);
    },
    getTargets(cmd) {
      const support = this.isSupport(cmd?.data);
      let scope = cmd?.targetScope;
      if (!scope && (cmd?.target === "all_enemy" || cmd?.target === "all_ally")) scope = "all";
      if (!scope && cmd?.target === "random") scope = "random";
      const target = cmd?.target;

      if (target && typeof target === "object") return [target].filter(Boolean);
      if (scope && /全体|蜈ｨ|all/i.test(scope)) return this.targetPool(cmd, support);
      if (scope && /ランダム|繝ｩ|random/i.test(scope)) return this.targetPool(cmd, support).slice(0, 1);
      if (scope && /自分|閾ｪ|self/i.test(scope)) return [cmd.actor].filter(Boolean);
      return this.targetPool(cmd, support).slice(0, 1);
    },
    anchor(unit) {
      const layer = this.ensureLayer();
      const scene = byId("battle-scene");
      if (!layer || !scene) return null;
      let el = null;
      if (this.isEnemy(unit)) {
        el = this.nodeForUnit("enemy-container", unit, Battle.enemies);
      } else if (this.isParty(unit)) {
        el = this.nodeForUnit("battle-party-bar", unit, Battle.party);
      }
      const base = scene.getBoundingClientRect();
      const rect = el ? el.getBoundingClientRect() : base;
      const x = rect.left - base.left + rect.width / 2;
      const y = rect.top - base.top + rect.height * (this.isEnemy(unit) ? 0.46 : 0.5);
      return { layer, el, x, y, w: Math.max(54, rect.width), h: Math.max(54, rect.height) };
    },
    effect(unit, kind, options = {}) {
      const pos = this.anchor(unit);
      if (!pos) return;
      document.documentElement.dataset.polishLastFxKind = String(kind || "");
      const node = document.createElement("div");
      node.className = `battle-fx battle-fx-${kind}`;
      node.style.left = `${pos.x}px`;
      node.style.top = `${pos.y}px`;
      const imageAsset = this.assetFor(kind);
      const isWide = /all-|ultimate|meteor|pillar|vortex|burst|combo|breath|special|critical/.test(kind);
      const size = Math.max(72, Math.min(isWide ? 190 : 148, Math.max(pos.w, pos.h) * (options.big || isWide ? 1.08 : 0.76)));
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      if (imageAsset) {
        node.classList.add("battle-fx-image");
        node.style.backgroundImage = `url("${imageAsset}")`;
      }
      if (options.hitIndex) {
        const spread = ((options.hitIndex - 1) % 5 - 2) * 7;
        node.style.setProperty("--fx-offset-x", `${spread}px`);
        node.style.setProperty("--fx-rotate", `${spread * 0.7}deg`);
      }
      pos.layer.appendChild(node);
      this.particles(pos, kind, { ...options, quiet: !!imageAsset && !options.big });
      setTimeout(() => node.remove(), 760);
    },
    particles(pos, kind, options = {}) {
      const colors = {
        fire: "#ffb15e",
        ice: "#dff",
        thunder: "#fff28a",
        wind: "#81e5ab",
        light: "#fff2a8",
        dark: "#b156ff",
        chaos: "#67d7c4",
        heal: "#8fffad",
        buff: "#67d7c4",
        debuff: "#c36bff",
        slash: "#ffe2a0",
        claw: "#ff6767",
        combo: "#ffe2a0",
        "all-slash": "#f4c95d",
        "enemy-claw": "#ff6767",
        "party-hit": "#ff7777",
        meteor: "#ff8a3d",
        "ice-spear": "#dff",
        "thunder-pillar": "#fff28a",
        "abyss-vortex": "#b156ff",
        "holy-burst": "#fff2a8",
        poison: "#c36bff",
        "ultimate-chaos": "#67d7c4",
        "heal-blossom": "#8fffad",
        "special-rupture": "#c36bff",
        "critical-spark": "#fff2a8",
        "neutral-slash": "#d6d1c2",
        "neutral-smash": "#aeb4b8",
        "neutral-pierce": "#e8edf0",
        "neutral-combo": "#cfd3d6",
        "neutral-chain": "#d9dde0",
        "neutral-heavy": "#9ea4a8",
        "phys-sword": "#d6d1c2",
        "phys-spear": "#e8edf0",
        "phys-axe": "#aeb4b8",
        "phys-combo": "#cfd3d6",
        "phys-fire": "#ff9b45",
        "phys-ice": "#dff",
        "phys-thunder": "#fff28a",
        "phys-wind": "#81e5ab",
        "phys-light": "#fff2a8",
        "phys-dark": "#b156ff",
        "phys-chaos": "#67d7c4",
        "spell-fire": "#ffb15e",
        "spell-ice": "#dff",
        "spell-thunder": "#fff28a",
        "spell-wind": "#81e5ab",
        "spell-light": "#fff2a8",
        "spell-dark": "#b156ff",
        "spell-chaos": "#67d7c4",
        breath: "#ff7777",
        "breath-fire": "#ff8a3d",
        "breath-ice": "#dff",
        "breath-thunder": "#fff28a",
        "breath-wind": "#81e5ab",
        "breath-light": "#fff2a8",
        "breath-dark": "#b156ff",
        "breath-chaos": "#67d7c4"
      };
      if (options.quiet) return;
      const count = options.big ? 10 : 6;
      for (let i = 0; i < count; i += 1) {
        const dot = document.createElement("span");
        dot.className = "battle-fx-particle";
        dot.style.left = `${pos.x}px`;
        dot.style.top = `${pos.y}px`;
        dot.style.color = colors[kind] || "#fff";
        const angle = (Math.PI * 2 * i / count) + (options.big ? 0.25 : 0);
        const distance = 28 + (i % 3) * 12;
        dot.style.setProperty("--fx-x", `${Math.cos(angle) * distance}px`);
        dot.style.setProperty("--fx-y", `${Math.sin(angle) * distance}px`);
        pos.layer.appendChild(dot);
        setTimeout(() => dot.remove(), 700);
      }
    },
    float(unit, text, color, options = {}) {
      const pos = this.anchor(unit);
      if (!pos) return;
      const node = document.createElement("div");
      node.className = "battle-fx-float";
      if (options.critical) node.classList.add("battle-fx-critical-float");
      node.textContent = text;
      const jitter = options.hitIndex ? ((options.hitIndex - 1) % 5 - 2) * 10 : 0;
      node.style.left = `${pos.x + jitter}px`;
      node.style.top = `${pos.y - 18 - Math.floor((options.hitIndex || 1) / 2) * 2}px`;
      node.style.color = color;
      pos.layer.appendChild(node);
      setTimeout(() => node.remove(), 820);
    },
    mark(unit, cls) {
      const pos = this.anchor(unit);
      if (!pos?.el) return;
      pos.el.classList.remove(cls);
      void pos.el.offsetWidth;
      pos.el.classList.add(cls);
      setTimeout(() => pos.el?.classList.remove(cls), 520);
    },
    unitFromText(text) {
      if (typeof Battle === "undefined") return null;
      const units = [...(Battle.party || []), ...(Battle.enemies || [])].filter(Boolean);
      return units
        .slice()
        .sort((a, b) => String(b.name || "").length - String(a.name || "").length)
        .find((unit) => unit?.name && text.includes(this.stripHtml(unit.name))) || null;
    },
    hitColorFromLog(message, fallback = "#ff7777") {
      const match = String(message || "").match(/color:\s*([^;"']+)/i);
      return match ? match[1].trim() : fallback;
    },
    isDualWieldCommand(cmd) {
      return !!(
        cmd &&
        !cmd.isReaction &&
        cmd.type !== "item" &&
        typeof PassiveSkill !== "undefined" &&
        typeof PassiveSkill.getSumValue === "function" &&
        PassiveSkill.getSumValue(cmd.actor, "dual_dmg_mult") > 0
      );
    },
    isDualWieldFollowUpLog(text) {
      const cmd = this.current?.cmd;
      const actorName = this.stripHtml(cmd?.actor?.name || "");
      const normalized = String(text || "").replace(/\s+/g, " ").trim();
      return !!(
        this.isDualWieldCommand(cmd) &&
        actorName &&
        (normalized === `${actorName}の 追撃！` ||
          normalized === `${actorName}の 追撃!` ||
          normalized === `${actorName}の 追撃`)
      );
    },
    playIntentEffects(cmd, options = {}) {
      if (!cmd || cmd.type === "defend" || cmd.type === "skip" || cmd.type === "flee") return 0;
      const targets = this.getTargets(cmd).filter(Boolean);
      if (targets.length === 0) return 0;
      const kind = options.kind || this.visualKind(cmd, false);
      targets.forEach((target, index) => {
        setTimeout(() => this.effect(target, kind, { big: targets.length > 1 }), Math.min(index * 55, 260));
      });
      this.lastAt = performance.now();
      return targets.length;
    },
    reactToLog(message) {
      if (!this.current) return;
      const text = this.stripHtml(message);
      if (this.isDualWieldFollowUpLog(text)) {
        this.current.dualWieldFollowUp = true;
        this.current.dualWieldKind = this.visualKind(this.current.cmd, false);
        this.playIntentEffects(this.current.cmd, { kind: this.current.dualWieldKind });
        return;
      }
      if (!text || text === "--- ターン開始 ---") return;
      const criticalKind = this.criticalKindFromLog(text);
      if (criticalKind) this.queueCriticalKind(criticalKind);
      if (this.current?.cmd?.isReaction) {
        this.queueNeutralPhysicalKind(this.logNeutralPhysicalKind(text));
      }
      const unit = this.unitFromText(text);
      if (!unit) return;

      const damageMatch = text.match(/に\s*([0-9,]+)\s*のダメージ/) || text.match(/ダメージを\s*([0-9,]+)\s*受けた/) || text.match(/に\s*([0-9,]+)\s*の?ダメージ/);
      const healMatch = text.match(/HP[をが]\s*([0-9,]+)\s*回復/) || text.match(/([0-9,]+)\s*回復/);
      const missMatch = /ミス|身をかわした|うけない|効かなかった|きかなかった/.test(text);

      if (!damageMatch && !healMatch && !missMatch) return;

      this.current.hits += 1;
      this.totalHitEvents += 1;
      document.documentElement.dataset.polishBattleFxHits = String(this.totalHitEvents);

      const hitIndex = this.current.hits;
      const cmd = this.current.cmd;
      const delay = Math.min(120, (hitIndex - 1) * 24);
      const area = this.isArea(cmd);
      setTimeout(() => {
        if (damageMatch) {
          const amount = damageMatch[1].replace(/,/g, "");
          const kind = cmd?.isReaction ? (this.consumeNeutralPhysicalKind() || this.visualKind(cmd, true)) : (this.current?.dualWieldKind || this.visualKind(cmd, true));
          const criticalKind = this.consumeCriticalKind() || this.enhancedDamageKind(cmd);
          this.mark(unit, "battle-hit-shake");
          if (this.isBossTarget(unit)) this.mark(unit, "battle-boss-flash");
          if (this.isParty(unit)) this.mark(unit, "battle-party-damaged");
          if (!area) this.effect(unit, kind, { hitIndex });
          if (criticalKind) {
            if (!area) this.effect(unit, criticalKind, { hitIndex, big: true });
            this.float(unit, `-${amount}`, "#fff2a8", { hitIndex, critical: true });
          } else {
            this.float(unit, `-${amount}`, this.hitColorFromLog(message), { hitIndex });
          }
          return;
        }
        if (healMatch) {
          const amount = healMatch[1].replace(/,/g, "");
          this.mark(unit, "battle-heal-pulse");
          if (!area) this.effect(unit, this.visualKind(cmd, true) || "heal-blossom", { hitIndex });
          this.float(unit, `+${amount}`, "#8fffad", { hitIndex });
          return;
        }
        const missKind = cmd?.isReaction ? (this.consumeNeutralPhysicalKind() || "neutral-slash") : (this.current?.dualWieldKind || this.visualKind(cmd, true) || (this.isParty(unit) ? "party-hit" : "neutral-slash"));
        if (!area) this.effect(unit, missKind, { hitIndex });
        this.float(unit, "MISS", "#d6d1c2", { hitIndex });
      }, delay);
    },
    async playIntent(cmd) {
      const targetCount = this.playIntentEffects(cmd);
      if (targetCount === 0) return;
      await new Promise((resolve) => setTimeout(resolve, targetCount > 1 ? 310 : 240));
    },
    async playResults(cmd, before, options = {}) {
      if (!before || typeof Battle === "undefined") return;
      const units = [...(Battle.party || []), ...(Battle.enemies || [])].filter(Boolean);
      const changes = units.map((unit) => {
        const prev = before.get(unit);
        if (!prev) return null;
        return { unit, hpDelta: Number(unit.hp || 0) - prev.hp, mpDelta: Number(unit.mp || 0) - prev.mp };
      }).filter(Boolean);

      const damaged = changes.filter((change) => change.hpDelta < 0).slice(0, 6);
      const healed = changes.filter((change) => change.hpDelta > 0).slice(0, 6);
      const area = this.isArea(cmd);

      if (options.skipNumbers) {
        damaged.forEach(({ unit }) => {
          this.mark(unit, "battle-hit-shake");
          if (this.isBossTarget(unit)) this.mark(unit, "battle-boss-flash");
          if (this.isParty(unit)) this.mark(unit, "battle-party-damaged");
        });
        healed.forEach(({ unit }) => this.mark(unit, "battle-heal-pulse"));
        return;
      }

      damaged.forEach(({ unit, hpDelta }, index) => {
        setTimeout(() => {
          this.mark(unit, "battle-hit-shake");
          if (this.isBossTarget(unit)) this.mark(unit, "battle-boss-flash");
          if (this.isParty(unit)) this.mark(unit, "battle-party-damaged");
          if (!area) this.effect(unit, this.visualKind(cmd, true));
          this.float(unit, `${hpDelta}`, "#ff7777");
        }, index * 45);
      });

      healed.forEach(({ unit, hpDelta }, index) => {
        setTimeout(() => {
          this.mark(unit, "battle-heal-pulse");
          if (!area) this.effect(unit, "heal");
          this.float(unit, `+${hpDelta}`, "#8fffad");
        }, index * 45);
      });

      if (damaged.length || healed.length) {
        await new Promise((resolve) => setTimeout(resolve, 220 + Math.max(damaged.length, healed.length) * 40));
      }
    }
  };

  const installBattleEffects = () => {
    if (typeof Battle === "undefined" || typeof Battle.processAction !== "function" || Battle.processAction.__polishedEffects) return;
    window.PolishBattleFX = BattleFX;
    if (typeof Battle.log === "function" && !Battle.log.__polishedEffects) {
      const originalLog = Battle.log.bind(Battle);
      Battle.log = (message) => {
        const result = originalLog(message);
        try {
          BattleFX.reactToLog(message);
        } catch (error) {
          console.warn("[PolishFX] log reaction failed", error);
        }
        return result;
      };
      Battle.log.__polishedEffects = true;
    }
    const originalProcessAction = Battle.processAction.bind(Battle);
    Battle.processAction = async (cmd) => {
      const before = BattleFX.snapshot();
      const previous = BattleFX.current;
      BattleFX.current = { cmd, hits: 0 };
      let loggedHits = 0;
      try {
        await BattleFX.playIntent(cmd);
      } catch (error) {
        console.warn("[PolishFX] intent failed", error);
      }
      let result;
      try {
        result = await originalProcessAction(cmd);
        loggedHits = BattleFX.current?.hits || 0;
      } finally {
        BattleFX.current = previous;
      }
      try {
        await BattleFX.playResults(cmd, before, { skipNumbers: loggedHits > 0 });
      } catch (error) {
        console.warn("[PolishFX] result failed", error);
      }
      return result;
    };
    Battle.processAction.__polishedEffects = true;
  };

  const patchRuntime = () => {
    if (typeof App !== "undefined" && typeof App.updateHUD === "function" && !App.updateHUD.__polished) {
      const originalUpdateHUD = App.updateHUD.bind(App);
      App.updateHUD = (...args) => {
        const result = originalUpdateHUD(...args);
        requestAnimationFrame(fixStaticText);
        return result;
      };
      App.updateHUD.__polished = true;
    }
    if (typeof Field !== "undefined" && typeof Field.render === "function" && !Field.render.__polished) {
      const originalRender = Field.render.bind(Field);
      Field.render = (...args) => {
        const result = originalRender(...args);
        requestAnimationFrame(fixStaticText);
        return result;
      };
      Field.render.__polished = true;
    }
  };

  const boot = () => {
    installGraphics();
    installThemes();
    installNames();
    patchRuntime();
    installBattleEffects();
    enhanceControls();
    fixStaticText();
    setTimeout(fixStaticText, 60);
    setTimeout(fixStaticText, 350);
  };

  boot();
  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", () => {
    boot();
    setTimeout(boot, 120);
  });
})();
