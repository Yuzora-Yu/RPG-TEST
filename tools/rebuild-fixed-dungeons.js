/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const mapPath = path.join(root, "map.js");

const q = (value) => JSON.stringify(value);
const jp = (floor) => `${floor}階`;

function makeGrid(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "W"));
}

function set(grid, x, y, ch) {
  if (grid[y] && grid[y][x] !== undefined) grid[y][x] = ch;
}

function rect(grid, x1, y1, x2, y2, ch = "T") {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) set(grid, x, y, ch);
  }
}

function line(grid, x1, y1, x2, y2, ch = "T") {
  let x = x1;
  let y = y1;
  set(grid, x, y, ch);
  while (x !== x2) {
    x += x < x2 ? 1 : -1;
    set(grid, x, y, ch);
  }
  while (y !== y2) {
    y += y < y2 ? 1 : -1;
    set(grid, x, y, ch);
  }
}

function pathLine(grid, points, ch = "T") {
  for (let i = 1; i < points.length; i++) {
    line(grid, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], ch);
  }
}

function scatter(grid, coords, ch = "G") {
  coords.forEach(([x, y]) => set(grid, x, y, ch));
}

function finish(grid, symbols = {}) {
  Object.entries(symbols).forEach(([key, value]) => {
    if (Array.isArray(value[0])) {
      value.forEach(([x, y]) => set(grid, x, y, key));
    } else {
      set(grid, value[0], value[1], key);
    }
  });
  return grid.map((row) => row.join(""));
}

function floor(width, height, build, symbols) {
  const grid = makeGrid(width, height);
  build(grid);
  return finish(grid, symbols);
}

function towerTiles(n, from, to, options = {}) {
  const g = makeGrid(21, 21);
  const variant = n % 5;
  if (variant === 1) {
    [[1, 1, 6, 5], [14, 1, 19, 5], [2, 8, 8, 13], [12, 8, 18, 13], [1, 16, 7, 19], [13, 16, 19, 19]].forEach((r) => rect(g, ...r));
    rect(g, 9, 8, 11, 12, "T");
  } else if (variant === 2) {
    rect(g, 2, 2, 18, 4);
    rect(g, 2, 16, 18, 18);
    rect(g, 2, 4, 4, 16);
    rect(g, 16, 4, 18, 16);
    rect(g, 7, 7, 13, 13);
    rect(g, 9, 9, 11, 11, "W");
  } else if (variant === 3) {
    rect(g, 1, 1, 8, 6);
    rect(g, 12, 1, 19, 8);
    rect(g, 1, 12, 9, 19);
    rect(g, 13, 13, 19, 19);
    rect(g, 8, 8, 12, 12);
  } else if (variant === 4) {
    rect(g, 1, 2, 6, 6);
    rect(g, 8, 1, 12, 8);
    rect(g, 14, 2, 19, 6);
    rect(g, 3, 10, 17, 12);
    rect(g, 1, 15, 5, 19);
    rect(g, 15, 15, 19, 19);
  } else {
    rect(g, 2, 1, 18, 5);
    rect(g, 4, 7, 16, 9);
    rect(g, 1, 11, 7, 15);
    rect(g, 13, 11, 19, 15);
    rect(g, 3, 17, 17, 19);
    rect(g, 9, 10, 11, 16);
  }
  pathLine(g, [from, [10, from[1]], [10, 10], [to[0], 10], to]);
  pathLine(g, [[4, 3], [10, 3], [16, 3]]);
  pathLine(g, [[5, 18], [10, 18], [16, 18]]);
  const deco = [];
  for (let y = 3; y <= 17; y += 4) deco.push([variant === 2 ? 6 : 10, y]);
  for (let x = 4; x <= 16; x += 4) deco.push([x, variant === 4 ? 11 : 10]);
  scatter(g, deco, "G");
  if (options.midDoor) set(g, options.midDoor[0], options.midDoor[1], options.midDoor[2]);
  if (options.boss) set(g, options.boss[0], options.boss[1], "B");
  if (options.extra) options.extra(g);
  return finish(g, options.symbols || {});
}

function fortressTiles(width, height, from, to, options = {}) {
  const g = makeGrid(width, height);
  rect(g, 1, 1, width - 2, height - 2);
  for (let y = 3; y < height - 3; y += 4) {
    for (let x = 3; x < width - 3; x += 4) rect(g, x, y, Math.min(width - 3, x + 1), Math.min(height - 3, y + 1), "W");
  }
  pathLine(g, [from, [Math.floor(width / 2), from[1]], [Math.floor(width / 2), Math.floor(height / 2)], [to[0], Math.floor(height / 2)], to]);
  scatter(g, [[4, 4], [12, 4], [8, 8], [4, 12], [12, 12]], "G");
  if (options.boss) set(g, options.boss[0], options.boss[1], "B");
  if (options.door) set(g, options.door[0], options.door[1], options.door[2]);
  return finish(g, options.symbols || {});
}

function palaceTiles(from, to, options = {}) {
  const g = makeGrid(25, 21);
  rect(g, 1, 1, 23, 19);
  rect(g, 3, 3, 21, 17, "W");
  rect(g, 5, 4, 19, 16, "T");
  rect(g, 8, 7, 16, 13, "W");
  rect(g, 10, 8, 14, 12, "T");
  pathLine(g, [from, [12, from[1]], [12, 10], [to[0], 10], to]);
  pathLine(g, [[2, 2], [12, 2], [22, 2]]);
  pathLine(g, [[2, 18], [12, 18], [22, 18]]);
  scatter(g, [[6, 5], [18, 5], [6, 15], [18, 15], [12, 6], [12, 14]], "G");
  if (options.boss) set(g, options.boss[0], options.boss[1], "B");
  return finish(g, options.symbols || {});
}

function darkTiles(from, to, options = {}) {
  const g = makeGrid(27, 23);
  rect(g, 1, 1, 25, 21);
  rect(g, 4, 3, 22, 19, "W");
  rect(g, 6, 4, 20, 18, "T");
  for (let y = 6; y <= 16; y += 5) rect(g, 8, y, 18, y, "W");
  pathLine(g, [from, [13, from[1]], [13, 11], [to[0], 11], to]);
  pathLine(g, [[2, 2], [6, 2], [6, 6], [13, 6]]);
  pathLine(g, [[24, 20], [20, 20], [20, 16], [13, 16]]);
  scatter(g, [[7, 5], [19, 5], [7, 17], [19, 17], [13, 8], [13, 14]], "G");
  if (options.boss) set(g, options.boss[0], options.boss[1], "B");
  if (options.door) set(g, options.door[0], options.door[1], options.door[2]);
  return finish(g, options.symbols || {});
}

const areas = [
  {
    key: "IGNIS_VOLCANO",
    header: [
      'name: "イグナ火山"',
      'themeKey: "FIRE_VILLAGE"',
      "rank: 12",
      "encounterRank: 12",
      'battleBg: "battle_bg_fire"',
      'overlayOverrides: { B: tileEntry("overlay_npc_bronze_knight", "#b8843a") }',
      "entryPoint: { x: 10, y: 18 }"
    ],
    floors: [
      {
        label: "火山道",
        encounterRank: 12,
        monsters: [100010, 100011, 100012],
        width: 21,
        height: 21,
        tiles: floor(21, 21, (g) => {
          rect(g, 7, 16, 13, 19);
          rect(g, 14, 3, 19, 7);
          rect(g, 15, 1, 19, 2);
          pathLine(g, [[10, 18], [10, 12], [15, 12], [15, 5], [18, 5]]);
          pathLine(g, [[15, 5], [18, 5], [18, 1]]);
          rect(g, 2, 8, 6, 12);
          pathLine(g, [[10, 12], [6, 12], [6, 10]]);
          scatter(g, [[4, 9], [5, 10], [16, 4], [17, 6], [11, 17]], "G");
          scatter(g, [[3, 2], [4, 2], [3, 3], [5, 14], [16, 15], [17, 15], [18, 15]], "M");
        }, { S: [10, 20], D: [18, 5], C: [18, 1] }),
        floorLinks: [
          { x: 10, y: 20, to: "EXIT", label: "里へ戻る" },
          { x: 18, y: 5, toFloor: 2, targetX: 2, targetY: 17, label: "溶岩回廊へ" }
        ],
        chests: [{ x: 18, y: 1, itemId: 1, type: "item" }],
        entryPoint: { x: 10, y: 18 }
      },
      {
        label: "溶岩回廊",
        encounterRank: 14,
        monsters: [100012, 100013, 100014],
        width: 21,
        height: 21,
        tiles: floor(21, 21, (g) => {
          rect(g, 1, 14, 5, 19);
          rect(g, 14, 1, 19, 5);
          rect(g, 7, 8, 13, 12);
          pathLine(g, [[2, 17], [5, 17], [5, 10], [10, 10], [10, 3], [19, 3], [19, 1]]);
          pathLine(g, [[2, 17], [1, 17], [1, 15]]);
          scatter(g, [[9, 9], [11, 9], [9, 11], [11, 11], [18, 2]], "G");
          scatter(g, [[3, 5], [4, 5], [5, 5], [15, 9], [16, 9], [15, 10], [16, 10], [12, 15], [13, 15]], "M");
        }, { U: [2, 17], D: [19, 1], C: [1, 15] }),
        floorLinks: [
          { x: 2, y: 17, toFloor: 1, targetX: 18, targetY: 5, label: "火山道へ戻る" },
          { x: 19, y: 1, toFloor: 3, targetX: 10, targetY: 17, label: "火の祭壇へ" }
        ],
        chests: [{ x: 1, y: 15, itemId: 99, type: "item" }],
        entryPoint: { x: 2, y: 17 }
      },
      {
        label: "火の祭壇",
        encounterRank: 16,
        monsters: [100014, 100015, 100016],
        width: 21,
        height: 21,
        tiles: floor(21, 21, (g) => {
          rect(g, 5, 14, 15, 18);
          rect(g, 4, 4, 16, 12);
          rect(g, 7, 6, 13, 9, "G");
          pathLine(g, [[10, 17], [10, 11], [10, 6]]);
          scatter(g, [[5, 5], [15, 5], [5, 11], [15, 11], [8, 7], [12, 7]], "M");
        }, { U: [10, 17], B: [10, 6] }),
        floorLinks: [{ x: 10, y: 17, toFloor: 2, targetX: 19, targetY: 1, label: "溶岩回廊へ戻る" }],
        bosses: [{ x: 10, y: 6, monsterId: [301002, 301001, 301001, 301001], startEventId: "fire_volcano_soldiers_encounter", storyEventId: "fire_volcano_soldiers_clear", actionLabel: "兵士に声をかける" }],
        entryPoint: { x: 10, y: 17 }
      }
    ]
  },
  {
    key: "FORBIDDEN_FOREST",
    header: [
      'name: "禁忌の森"',
      'themeKey: "WIND_VILLAGE"',
      "rank: 22",
      "encounterRank: 22",
      'battleBg: "battle_bg_field"',
      "entryPoint: { x: 21, y: 9 }"
    ],
    floors: [
      {
        label: "封じられた森",
        encounterRank: 22,
        monsters: [100020, 100021, 100022],
        width: 23,
        height: 19,
        tiles: floor(23, 19, (g) => {
          rect(g, 18, 6, 21, 12);
          rect(g, 8, 6, 14, 12);
          rect(g, 1, 1, 5, 5);
          rect(g, 2, 14, 8, 17);
          pathLine(g, [[21, 9], [15, 9], [11, 9], [4, 9], [4, 3], [1, 3]]);
          pathLine(g, [[11, 9], [5, 16]]);
          scatter(g, [[10, 7], [12, 7], [9, 10], [13, 10], [3, 2], [4, 4]], "G");
        }, { S: [22, 9], D: [1, 3], C: [11, 9] }),
        floorLinks: [
          { x: 22, y: 9, to: "EXIT", label: "集落へ戻る" },
          { x: 1, y: 3, toFloor: 2, targetX: 2, targetY: 15, label: "祈りの広場へ" }
        ],
        chests: [{ x: 11, y: 9, itemId: 1, type: "item" }],
        entryPoint: { x: 21, y: 9 }
      },
      {
        label: "祈りの広場",
        encounterRank: 24,
        monsters: [100022, 100023, 100024],
        width: 23,
        height: 19,
        tiles: floor(23, 19, (g) => {
          rect(g, 1, 13, 5, 17);
          rect(g, 5, 4, 17, 13);
          rect(g, 8, 6, 14, 10, "G");
          pathLine(g, [[2, 15], [6, 15], [6, 10], [11, 10], [11, 7]]);
          scatter(g, [[7, 7], [15, 7], [7, 11], [15, 11], [11, 5], [11, 12]], "T");
        }, { U: [2, 15], B: [11, 7] }),
        floorLinks: [{ x: 2, y: 15, toFloor: 1, targetX: 1, targetY: 3, label: "封じられた森へ戻る" }],
        bosses: [{ x: 11, y: 7, monsterId: [301011, 301012], startEventId: "wind_forest_guardians_encounter", storyEventId: "wind_forest_guardians_clear", actionLabel: "石碑を調べる" }],
        entryPoint: { x: 2, y: 15 }
      }
    ]
  },
  {
    key: "WIND_TEMPLE",
    header: [
      'name: "風の神殿"',
      'themeKey: "WIND_VILLAGE"',
      "rank: 26",
      "encounterRank: 26",
      'battleBg: "battle_bg_dungeon"',
      "entryPoint: { x: 11, y: 18 }"
    ],
    floors: [
      {
        label: "風廊",
        encounterRank: 26,
        monsters: [100024, 100025, 100026],
        width: 23,
        height: 21,
        tiles: floor(23, 21, (g) => {
          rect(g, 8, 16, 14, 19);
          rect(g, 17, 6, 21, 12);
          rect(g, 2, 2, 6, 5);
          pathLine(g, [[11, 19], [11, 13], [18, 13], [18, 9], [20, 9]]);
          pathLine(g, [[11, 13], [4, 13], [4, 3]]);
          scatter(g, [[10, 17], [12, 17], [18, 8], [19, 10], [3, 4]], "G");
        }, { S: [11, 20], D: [20, 9], C: [3, 3] }),
        floorLinks: [
          { x: 11, y: 20, to: "EXIT", label: "森へ戻る" },
          { x: 20, y: 9, toFloor: 2, targetX: 2, targetY: 9, label: "旋風の回廊へ" }
        ],
        chests: [{ x: 3, y: 3, itemId: 1, type: "item" }],
        entryPoint: { x: 11, y: 19 }
      },
      {
        label: "旋風の回廊",
        encounterRank: 28,
        monsters: [100026, 100027, 100028],
        width: 23,
        height: 21,
        tiles: floor(23, 21, (g) => {
          rect(g, 1, 7, 6, 11);
          rect(g, 8, 4, 15, 8);
          rect(g, 14, 15, 21, 19);
          pathLine(g, [[2, 9], [10, 9], [10, 6], [15, 6], [15, 18], [19, 18]]);
          pathLine(g, [[10, 9], [10, 14], [16, 14]]);
          scatter(g, [[9, 5], [14, 7], [17, 16], [20, 18], [6, 9]], "G");
        }, { U: [2, 9], D: [19, 18] }),
        floorLinks: [
          { x: 2, y: 9, toFloor: 1, targetX: 20, targetY: 9, label: "風廊へ戻る" },
          { x: 19, y: 18, toFloor: 3, targetX: 11, targetY: 17, label: "風の祭壇へ" }
        ],
        entryPoint: { x: 2, y: 9 }
      },
      {
        label: "風の祭壇",
        encounterRank: 30,
        monsters: [100028, 100029, 100030],
        width: 23,
        height: 21,
        tiles: floor(23, 21, (g) => {
          rect(g, 7, 15, 15, 18);
          rect(g, 5, 5, 17, 12);
          rect(g, 8, 7, 14, 10, "G");
          pathLine(g, [[11, 17], [11, 12], [11, 8]]);
          scatter(g, [[7, 6], [15, 6], [7, 11], [15, 11], [9, 8], [13, 8]], "T");
        }, { U: [11, 17], B: [11, 8] }),
        floorLinks: [{ x: 11, y: 17, toFloor: 2, targetX: 19, targetY: 18, label: "旋風の回廊へ戻る" }],
        bosses: [{ x: 11, y: 8, monsterId: 301020, startEventId: "wind_temple_elicia_encounter", storyEventId: "wind_temple_clear", actionLabel: "祭壇へ進む" }],
        entryPoint: { x: 11, y: 17 }
      }
    ]
  },
  {
    key: "SEABED_TEMPLE",
    header: [
      'name: "海底神殿"',
      'themeKey: "WATER_CITY"',
      "rank: 35",
      "encounterRank: 35",
      'battleBg: "battle_bg_dungeon"',
      'overlayOverrides: { B: tileEntry("overlay_npc_dark_soldier", "#333946"), A: tileEntry("overlay_npc_dark_soldier", "#333946") }',
      "entryPoint: { x: 11, y: 20 }"
    ],
    floors: [
      {
        label: "沈水回廊",
        encounterRank: 35,
        monsters: [100033, 100034, 301021],
        width: 23,
        height: 23,
        tiles: floor(23, 23, (g) => {
          rect(g, 7, 18, 15, 21);
          rect(g, 6, 12, 16, 16);
          rect(g, 7, 3, 15, 7);
          pathLine(g, [[11, 20], [11, 15], [11, 5]]);
          pathLine(g, [[7, 14], [3, 14], [3, 6], [8, 6]]);
          pathLine(g, [[15, 14], [19, 14], [19, 6], [14, 6]]);
          scatter(g, [[8, 13], [14, 13], [9, 6], [13, 6]], "G");
        }, { S: [11, 22], D: [11, 5], B: [11, 15] }),
        floorLinks: [
          { x: 11, y: 22, to: "EXIT", label: "水上都市へ戻る" },
          { x: 11, y: 5, toFloor: 2, targetX: 11, targetY: 19, label: "赤水門へ" }
        ],
        bosses: [{ x: 11, y: 15, monsterId: [301022, 301021, 301021], keyRewardColor: "red", startEventId: "sea_temple_gate_encounter", storyEventId: "sea_temple_gate_clear", actionLabel: "封鎖兵と対峙する" }],
        entryPoint: { x: 11, y: 20 }
      },
      {
        label: "赤水門",
        encounterRank: 37,
        monsters: [100034, 100035, 301022],
        width: 23,
        height: 23,
        tiles: floor(23, 23, (g) => {
          rect(g, 8, 17, 14, 21);
          rect(g, 8, 9, 14, 13);
          rect(g, 1, 1, 5, 5);
          pathLine(g, [[11, 19], [11, 10], [11, 3], [2, 3], [2, 2]]);
          scatter(g, [[9, 18], [13, 18], [9, 12], [13, 12], [3, 2]], "G");
        }, { U: [11, 19], X: [11, 10], D: [2, 2] }),
        floorLinks: [
          { x: 11, y: 19, toFloor: 1, targetX: 11, targetY: 5, label: "沈水回廊へ戻る" },
          { x: 2, y: 2, toFloor: 3, targetX: 11, targetY: 19, label: "祈祷の間へ" }
        ],
        entryPoint: { x: 11, y: 19 }
      },
      {
        label: "祈祷の間",
        encounterRank: 39,
        monsters: [100036, 100037, 301022],
        width: 23,
        height: 23,
        tiles: floor(23, 23, (g) => {
          rect(g, 7, 17, 15, 21);
          rect(g, 5, 5, 17, 13);
          rect(g, 7, 7, 15, 10, "G");
          pathLine(g, [[11, 19], [11, 12], [11, 8]]);
          scatter(g, [[6, 6], [16, 6], [6, 12], [16, 12], [9, 8], [13, 8]], "T");
        }, { U: [11, 19], B: [11, 8] }),
        floorLinks: [{ x: 11, y: 19, toFloor: 2, targetX: 2, targetY: 2, label: "赤水門へ戻る" }],
        bosses: [{ x: 11, y: 8, monsterId: [301030, 301022, 301022], startEventId: "water_temple_syris_encounter", storyEventId: "water_temple_clear", actionLabel: "氷の祭壇へ進む" }],
        entryPoint: { x: 11, y: 19 }
      }
    ]
  }
];

const towerFloors = [];
const towerLinks = [
  [[10, 20], [18, 2]], [[18, 18], [2, 2]], [[2, 18], [18, 2]], [[18, 18], [2, 2]], [[2, 18], [18, 2]],
  [[18, 18], [2, 2]], [[2, 18], [18, 2]], [[18, 18], [2, 2]], [[2, 18], [18, 2]], [[18, 18], [10, 4]]
];
const towerLabels = ["下層・潮風の塔道", "下層・螺旋階段", "中層・灯火回廊", "中層・吹き抜け", "中層・結界炉", "上層・風鳴りの壁", "上層・古い守衛室", "上層・星見回廊", "頂層・封印階", "灯台頂上"];
for (let i = 0; i < 10; i++) {
  const from = towerLinks[i][0];
  const to = towerLinks[i][1];
  const isTop = i === 9;
  const options = {
    symbols: {},
    boss: i === 4 ? [10, 10] : (isTop ? [10, 4] : null),
    midDoor: i === 5 ? [10, 10, "Z"] : null
  };
  const down = i % 2 === 0 ? "D" : "U";
  const up = i % 2 === 0 ? "U" : "D";
  if (i === 0) options.symbols.S = [10, 20];
  else options.symbols[up] = from;
  if (!isTop) options.symbols[down] = to;
  if (i % 2 === 0 && !isTop) options.symbols.C = [[2, 2], [18, 18]];
  if (isTop) options.symbols.C = [2, 2];
  towerFloors.push({
    label: towerLabels[i],
    encounterRank: i === 9 ? 40 : 30 + i,
    monsters: [100026 + i, 100027 + i, 100028 + i],
    width: 21,
    height: 21,
    entryPoint: i === 0 ? { x: 10, y: 19 } : { x: from[0], y: from[1] },
    tiles: towerTiles(i + 1, from, to, options),
    floorLinks: i === 0
      ? [{ x: 10, y: 20, to: "EXIT", label: "外に出る" }, { x: 18, y: 2, toFloor: 2, targetX: 18, targetY: 18, label: "2階へ" }]
      : isTop
        ? [{ x: 18, y: 18, toFloor: 9, targetX: 18, targetY: 2, label: "9階へ戻る" }]
        : [
          { x: from[0], y: from[1], toFloor: i, targetX: towerLinks[i - 1][1][0], targetY: towerLinks[i - 1][1][1], label: `${i}階へ戻る` },
          { x: to[0], y: to[1], toFloor: i + 2, targetX: towerLinks[i + 1][0][0], targetY: towerLinks[i + 1][0][1], label: `${i + 2}階へ` }
        ],
    chests: i % 2 === 0 && !isTop
      ? [{ x: 2, y: 2, itemId: 1, type: "item" }, { x: 18, y: 18, itemId: 3, type: "item" }]
      : isTop ? [{ x: 2, y: 2, itemId: 1, type: "item" }] : undefined,
    bosses: i === 4
      ? [{ x: 10, y: 10, monsterId: [301060, 301062], keyRewardColor: "gold", startEventId: "big_tower_midboss_encounter", storyEventId: "big_tower_midboss_clear", actionLabel: "結界炉へ踏み込む" }]
      : isTop ? [{ x: 10, y: 4, monsterId: 301061, startEventId: "big_tower_lilith_encounter", storyEventId: "big_tower_clear", actionLabel: "リリスと対峙する" }] : undefined
  });
}

areas.push({
  key: "BIG_TOWER",
  header: [
    'name: "大灯台"',
    'themeKey: "BIG_TOWER"',
    "rank: 30",
    "encounterRank: 30",
    'battleBg: "battle_bg_dungeon"',
    "entryPoint: { x: 10, y: 19 }"
  ],
  floors: towerFloors
});

areas.push({
  key: "THUNDER_FORT",
  header: [
    'name: "雷の要塞"',
    'themeKey: "THUNDER_FORT"',
    "rank: 40",
    "encounterRank: 40",
    'battleBg: "battle_bg_dungeon"',
    "entryPoint: { x: 8, y: 15 }"
  ],
  floors: [
    {
      label: "1階・外郭電路",
      encounterRank: 40,
      monsters: [100036, 100037, 100038],
      width: 17,
      height: 17,
      tiles: fortressTiles(17, 17, [8, 15], [14, 2], { symbols: { S: [8, 16], D: [14, 2], C: [[2, 2], [14, 14]] } }),
      entryPoint: { x: 8, y: 15 },
      floorLinks: [{ x: 8, y: 16, to: "EXIT", label: "外に出る" }, { x: 14, y: 2, toFloor: 2, targetX: 14, targetY: 14, label: "地下1階へ" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }, { x: 14, y: 14, itemId: 3, type: "item" }]
    },
    {
      label: "地下1階・暴走機関室",
      encounterRank: 42,
      monsters: [100038, 100039, 100040],
      width: 17,
      height: 17,
      tiles: fortressTiles(17, 17, [14, 14], [2, 2], { boss: [8, 8], door: [5, 5, "X"], symbols: { U: [14, 14], D: [2, 2] } }),
      entryPoint: { x: 14, y: 14 },
      floorLinks: [{ x: 14, y: 14, toFloor: 1, targetX: 14, targetY: 2, label: "1階へ戻る" }, { x: 2, y: 2, toFloor: 3, targetX: 2, targetY: 14, label: "地下2階へ" }],
      bosses: [{ x: 8, y: 8, monsterId: 301031, keyRewardColor: "red", startEventId: "thunder_machine_gate_encounter", storyEventId: "thunder_machine_gate_clear", actionLabel: "制御盤に近づく" }]
    },
    {
      label: "地下2階・雷鎧の防衛線",
      encounterRank: 44,
      monsters: [100040, 100041, 100042],
      width: 17,
      height: 17,
      tiles: fortressTiles(17, 17, [2, 14], [14, 2], { boss: [8, 8], door: [11, 5, "Y"], symbols: { U: [2, 14], D: [14, 2], C: [[2, 2], [14, 14]] } }),
      entryPoint: { x: 2, y: 14 },
      floorLinks: [{ x: 2, y: 14, toFloor: 2, targetX: 2, targetY: 2, label: "地下1階へ戻る" }, { x: 14, y: 2, toFloor: 4, targetX: 14, targetY: 14, label: "地下3階へ" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }, { x: 14, y: 14, itemId: 3, type: "item" }],
      bosses: [{ x: 8, y: 8, monsterId: 301032, keyRewardColor: "blue", startEventId: "thunder_armor_gate_encounter", storyEventId: "thunder_armor_gate_clear", actionLabel: "雷鎧を停止する" }]
    },
    {
      label: "地下3階・雷の中枢",
      encounterRank: 46,
      monsters: [100042, 100043, 100044],
      width: 17,
      height: 17,
      tiles: fortressTiles(17, 17, [14, 14], [8, 4], { boss: [8, 4], symbols: { U: [14, 14], C: [2, 2] } }),
      entryPoint: { x: 14, y: 14 },
      floorLinks: [{ x: 14, y: 14, toFloor: 3, targetX: 14, targetY: 2, label: "地下2階へ戻る" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }],
      bosses: [{ x: 8, y: 4, monsterId: 301040, startEventId: "thunder_leonard_encounter", storyEventId: "thunder_fort_clear", actionLabel: "レナードと対峙する" }]
    }
  ]
});

areas.push({
  key: "LIGHT_PALACE",
  header: [
    'name: "光の宮殿"',
    'themeKey: "LIGHT_PALACE"',
    "rank: 50",
    "encounterRank: 50",
    'battleBg: "battle_bg_dungeon"',
    "entryPoint: { x: 12, y: 19 }"
  ],
  floors: [
    {
      label: "1階・白光の回廊",
      encounterRank: 50,
      monsters: [100046, 100047, 100048],
      width: 25,
      height: 21,
      tiles: palaceTiles([12, 19], [22, 2], { symbols: { S: [12, 20], D: [22, 2], C: [[2, 2], [22, 18]] } }),
      entryPoint: { x: 12, y: 19 },
      floorLinks: [{ x: 12, y: 20, to: "EXIT", label: "外に出る" }, { x: 22, y: 2, toFloor: 2, targetX: 22, targetY: 18, label: "地下1階へ" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }, { x: 22, y: 18, itemId: 3, type: "item" }]
    },
    {
      label: "地下1階・祝福の水盤",
      encounterRank: 52,
      monsters: [100048, 100049, 100050],
      width: 25,
      height: 21,
      tiles: palaceTiles([22, 18], [2, 2], { symbols: { U: [22, 18], D: [2, 2] } }),
      entryPoint: { x: 22, y: 18 },
      floorLinks: [{ x: 22, y: 18, toFloor: 1, targetX: 22, targetY: 2, label: "1階へ戻る" }, { x: 2, y: 2, toFloor: 3, targetX: 2, targetY: 18, label: "地下2階へ" }]
    },
    {
      label: "地下2階・結界の聖廊",
      encounterRank: 54,
      monsters: [100050, 100051, 100052],
      width: 25,
      height: 21,
      tiles: palaceTiles([2, 18], [22, 2], { symbols: { U: [2, 18], D: [22, 2], C: [[2, 2], [22, 18]] } }),
      entryPoint: { x: 2, y: 18 },
      floorLinks: [{ x: 2, y: 18, toFloor: 2, targetX: 2, targetY: 2, label: "地下1階へ戻る" }, { x: 22, y: 2, toFloor: 4, targetX: 22, targetY: 18, label: "地下3階へ" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }, { x: 22, y: 18, itemId: 3, type: "item" }]
    },
    {
      label: "地下3階・光の祭壇",
      encounterRank: 56,
      monsters: [100052, 100053, 100054],
      width: 25,
      height: 21,
      tiles: palaceTiles([22, 18], [12, 5], { boss: [12, 5], symbols: { U: [22, 18], C: [2, 2] } }),
      entryPoint: { x: 22, y: 18 },
      floorLinks: [{ x: 22, y: 18, toFloor: 3, targetX: 22, targetY: 2, label: "地下2階へ戻る" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }],
      bosses: [{ x: 12, y: 5, monsterId: [301070, 301050], startEventId: "light_palace_final_encounter", storyEventId: "light_palace_clear", actionLabel: "祭壇へ進む" }]
    }
  ]
});

areas.push({
  key: "DARK_CASTLE",
  header: [
    'name: "魔王城"',
    'themeKey: "DARK_CASTLE"',
    "rank: 60",
    "encounterRank: 60",
    'battleBg: "battle_bg_lastboss"',
    "entryPoint: { x: 13, y: 21 }"
  ],
  floors: [
    {
      label: "地下1階・黒鉄の門",
      encounterRank: 60,
      monsters: [100056, 100057, 100058],
      width: 27,
      height: 23,
      tiles: darkTiles([13, 21], [24, 2], { boss: [13, 11], symbols: { S: [13, 22], D: [24, 2], C: [[2, 2], [24, 20]] } }),
      entryPoint: { x: 13, y: 21 },
      floorLinks: [{ x: 13, y: 22, to: "EXIT", label: "外に出る" }, { x: 24, y: 2, toFloor: 2, targetX: 24, targetY: 20, label: "地下2階へ" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }, { x: 24, y: 20, itemId: 3, type: "item" }],
      bosses: [{ x: 13, y: 11, monsterId: 301080, keyRewardColor: "red", startEventId: "dark_castle_zeldras_encounter", storyEventId: "dark_castle_zeldras_clear", actionLabel: "黒い影と対峙する" }]
    },
    {
      label: "地下2階・冥騎士の間",
      encounterRank: 65,
      monsters: [100061, 100062, 100063],
      width: 27,
      height: 23,
      tiles: darkTiles([24, 20], [2, 2], { boss: [13, 11], door: [8, 8, "X"], symbols: { U: [24, 20], D: [2, 2] } }),
      entryPoint: { x: 24, y: 20 },
      floorLinks: [{ x: 24, y: 20, toFloor: 1, targetX: 24, targetY: 2, label: "地下1階へ戻る" }, { x: 2, y: 2, toFloor: 3, targetX: 2, targetY: 20, label: "地下3階へ" }],
      bosses: [{ x: 13, y: 11, monsterId: [301081, 301082], keyRewardColor: "gold", startEventId: "dark_castle_belet_elm_encounter", storyEventId: "dark_castle_belet_elm_clear", actionLabel: "冥騎士たちと対峙する" }]
    },
    {
      label: "地下3階・闇の玉座",
      encounterRank: 70,
      monsters: [100066, 100067, 100068],
      width: 27,
      height: 23,
      tiles: darkTiles([2, 20], [13, 4], { boss: [13, 4], door: [13, 11, "Z"], symbols: { U: [2, 20], C: [[2, 2], [24, 20]] } }),
      entryPoint: { x: 2, y: 20 },
      floorLinks: [{ x: 2, y: 20, toFloor: 2, targetX: 2, targetY: 2, label: "地下2階へ戻る" }],
      chests: [{ x: 2, y: 2, itemId: 1, type: "item" }, { x: 24, y: 20, itemId: 3, type: "item" }],
      bosses: [{ x: 13, y: 4, monsterId: 301100, startEventId: "dark_castle_zenon_encounter", storyEventId: "dark_castle_clear", actionLabel: "魔王と対峙する" }]
    }
  ]
});

function emitArray(value, indent) {
  const text = JSON.stringify(value, null, 4);
  return text.split("\n").map((line) => " ".repeat(indent) + line).join("\n").trimStart();
}

function emitFloor(floorDef, indent = 8) {
  const pad = " ".repeat(indent);
  const lines = [`${pad}{`];
  lines.push(`${pad}    label: ${q(floorDef.label)},`);
  lines.push(`${pad}    encounterRank: ${floorDef.encounterRank},`);
  lines.push(`${pad}    monsters: ${JSON.stringify(floorDef.monsters)},`);
  lines.push(`${pad}    width: ${floorDef.width},`);
  lines.push(`${pad}    height: ${floorDef.height},`);
  lines.push(`${pad}    tiles: ${emitArray(floorDef.tiles, indent + 4)},`);
  lines.push(`${pad}    floorLinks: ${emitArray(floorDef.floorLinks, indent + 4)},`);
  if (floorDef.chests) lines.push(`${pad}    chests: ${emitArray(floorDef.chests, indent + 4)},`);
  if (floorDef.bosses) lines.push(`${pad}    bosses: ${emitArray(floorDef.bosses, indent + 4)},`);
  if (floorDef.entryPoint) lines.push(`${pad}    entryPoint: ${emitArray(floorDef.entryPoint, indent + 4)},`);
  const last = lines[lines.length - 1];
  if (last.endsWith(",")) lines[lines.length - 1] = last.slice(0, -1);
  lines.push(`${pad}}`);
  return lines.join("\n");
}

function emitArea(area) {
  const lines = [`    ${area.key}: {`];
  area.header.forEach((entry) => lines.push(`        ${entry},`));
  lines.push("        floors: [");
  area.floors.forEach((f, index) => {
    lines.push(emitFloor(f, 12) + (index < area.floors.length - 1 ? "," : ""));
  });
  lines.push("        ]");
  lines.push("    }");
  return lines.join("\n");
}

function validateArea(area) {
  for (const f of area.floors) {
    if (f.tiles.length !== f.height) throw new Error(`${area.key} ${f.label}: height mismatch`);
    f.tiles.forEach((row, y) => {
      if (row.length !== f.width) throw new Error(`${area.key} ${f.label}: width mismatch at y=${y}`);
    });
  }
}

areas.forEach(validateArea);

const replacement = areas.map(emitArea).join(",\n");
const source = fs.readFileSync(mapPath, "utf8");
const start = source.indexOf("    IGNIS_VOLCANO:");
const end = source.indexOf("\n};\n\nconst MapRegistry", start);
if (start < 0 || end < 0) throw new Error("Could not locate fixed dungeon block in map.js");

const next = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(mapPath, next, "utf8");
console.log(`Rebuilt ${areas.length} fixed dungeon definitions in map.js`);
