/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mapPath = path.join(root, 'map.js');

const plans = {
  BIG_TOWER: {
    widths: [21, 21, 21, 21, 21, 21, 21],
    heights: [21, 21, 21, 21, 21, 21, 21],
    borders: ['F', '^', '^', '^', '^', '^', '^'],
    impassable: [null, '^', '^', '^', '^', '^', '^'],
  },
  THUNDER_FORT: {
    widths: [31, 31, 31, 31, 31, 31],
    heights: [25, 25, 25, 25, 25, 25],
    borders: ['THUNDER_ENTRANCES', 'K', 'K', 'K', 'K', 'K'],
    impassable: ['H', 'K', 'K', 'K', 'K', 'K'],
  },
  DARK_CASTLE: {
    widths: [31, 31, 31, 31, 31, 31, 31],
    heights: [27, 27, 27, 27, 27, 27, 27],
    borders: ['I', 'K', 'K', 'K', 'K', 'K', 'K'],
    impassable: [null, 'K', 'K', 'K', 'K', 'K', 'K'],
  },
  WIND_TEMPLE: {
    widths: [23, 23, 23],
    heights: [21, 21, 21],
    borders: ['F', 'K', 'K'],
    impassable: [null, 'K', 'K'],
  },
  LIGHT_PALACE: {
    widths: [33, 33, 33, 33],
    heights: [27, 27, 27, 27],
    borders: ['I', '^', '^', '^'],
    impassable: [null, '^', '^', '^'],
  },
  DARK_SHRINE_RUINS: {
    widths: [29, 31],
    heights: [23, 25],
    borders: ['I', 'K'],
    impassable: [null, 'K'],
  },
};

function skipQuoted(source, index, quote) {
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\') i++;
    else if (source[i] === quote) return i;
  }
  throw new Error(`Unterminated ${quote} string at ${index}`);
}

function matching(source, start, open, close) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuoted(source, i, ch);
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i + 2);
      if (i < 0) return source.length - 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2);
      if (i < 0) throw new Error(`Unterminated comment at ${start}`);
      i++;
      continue;
    }
    if (ch === open) depth++;
    if (ch === close && --depth === 0) return i;
  }
  throw new Error(`Unmatched ${open} at ${start}`);
}

function findArea(source, key) {
  const fixedStart = source.indexOf('const FIXED_DUNGEON_MAPS = {');
  const marker = `    ${key}: {`;
  const markerIndex = source.indexOf(marker, fixedStart);
  if (markerIndex < 0) throw new Error(`${key}: area marker missing`);
  const start = source.indexOf('{', markerIndex);
  return { markerIndex, start, end: matching(source, start, '{', '}') };
}

function findFloors(source, area) {
  const marker = source.indexOf('floors:', area.start);
  if (marker < 0 || marker > area.end) throw new Error('floors array missing');
  const start = source.indexOf('[', marker);
  const end = matching(source, start, '[', ']');
  const floors = [];
  let depth = 0;
  for (let i = start + 1; i < end; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuoted(source, i, ch);
      continue;
    }
    if (ch === '{') {
      if (depth === 0) {
        const floorEnd = matching(source, i, '{', '}');
        floors.push({ start: i, end: floorEnd });
        i = floorEnd;
      } else depth++;
    }
  }
  return { marker, start, end, floors };
}

function objectRangesForProperty(source, start, end, property) {
  const ranges = [];
  const re = new RegExp(`\\b${property}\\s*:`, 'g');
  re.lastIndex = start;
  let match;
  while ((match = re.exec(source)) && match.index < end) {
    const brace = source.indexOf('{', re.lastIndex);
    if (brace < 0 || brace > end) break;
    ranges.push([brace, matching(source, brace, '{', '}')]);
    re.lastIndex = ranges[ranges.length - 1][1] + 1;
  }
  return ranges;
}

function isInside(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index <= end);
}

function addReplacement(replacements, start, end, text, label) {
  replacements.push({ start, end, text, label });
}

function thunderBorderForRow(rowIndex, originalHeight) {
  if (rowIndex < 0 || rowIndex >= originalHeight) return 'H';
  return rowIndex >= 10 && rowIndex <= 14 ? 'F' : 'H';
}

function collectFloorReplacements(source, floorRange, plan, floorIndex, replacements) {
  const expectedWidth = plan.widths[floorIndex];
  const expectedHeight = plan.heights[floorIndex];
  const floorText = source.slice(floorRange.start, floorRange.end + 1);
  const widthMatch = /\bwidth:\s*(\d+)/.exec(floorText);
  const heightMatch = /\bheight:\s*(\d+)/.exec(floorText);
  if (!widthMatch || !heightMatch) throw new Error(`floor ${floorIndex + 1}: dimensions missing`);
  const width = Number(widthMatch[1]);
  const height = Number(heightMatch[1]);
  if (width === expectedWidth + 2) {
    const tilesMarker = source.indexOf('tiles:', floorRange.start);
    const tilesStart = source.indexOf('[', tilesMarker);
    const tilesEnd = matching(source, tilesStart, '[', ']');
    const rows = [];
    const rowRe = /"(?:\\.|[^"\\])*"/g;
    rowRe.lastIndex = tilesStart + 1;
    let rowMatch;
    while ((rowMatch = rowRe.exec(source)) && rowMatch.index < tilesEnd) {
      rows.push({ start: rowMatch.index, end: rowRe.lastIndex, row: JSON.parse(rowMatch[0]) });
    }
    if (height !== rows.length || ![expectedHeight + 2, expectedHeight + 3].includes(height)) throw new Error(`floor ${floorIndex + 1}: authored border dimensions are inconsistent`);
    const before = replacements.length;
    const needsSecondTopRow = height === expectedHeight + 2;
    const topOffset = needsSecondTopRow ? 0 : 1;
    const borderKind = plan.borders[floorIndex];
    const edgeFor = originalRowIndex => borderKind === 'THUNDER_ENTRANCES'
      ? thunderBorderForRow(originalRowIndex, height - 2)
      : borderKind;
    rows.forEach((item, rowIndex) => {
      const edge = edgeFor(rowIndex - 1 - topOffset);
      const desired = rowIndex === 0 || rowIndex === rows.length - 1
        ? edge.repeat(width)
        : `${edge}${item.row.slice(1, -1)}${edge}`;
      if (item.row !== desired) addReplacement(replacements, item.start, item.end, JSON.stringify(desired), 'normalized border row');
    });
    if (needsSecondTopRow) {
      const heightValueStart = floorRange.start + heightMatch.index + heightMatch[0].lastIndexOf(heightMatch[1]);
      addReplacement(replacements, heightValueStart, heightValueStart + heightMatch[1].length, String(height + 1), 'second top border height');
      const rowIndent = source.slice(source.lastIndexOf('\n', rows[1].start) + 1, rows[1].start);
      addReplacement(replacements, rows[1].start, rows[1].start, `${JSON.stringify(rows[1].row)},\n${rowIndent}`, 'existing-tile top row');

      const excluded = objectRangesForProperty(source, floorRange.start, floorRange.end, 'exitPoint');
      const yCoordinateRe = /\b(y|y1|y2|toY|targetY|minY|maxY):\s*(-?\d+)/g;
      yCoordinateRe.lastIndex = floorRange.start;
      let yMatch;
      while ((yMatch = yCoordinateRe.exec(source)) && yMatch.index < floorRange.end) {
        if (isInside(yMatch.index, excluded)) continue;
        const numberStart = yMatch.index + yMatch[0].lastIndexOf(yMatch[2]);
        addReplacement(replacements, numberStart, numberStart + yMatch[2].length, String(Number(yMatch[2]) + 1), `second top ${yMatch[1]}`);
      }
    }
    const impassable = plan.impassable[floorIndex];
    const impassableMatch = /\bimpassableTiles\s*:\s*\[\s*"([^"]+)"\s*\]/.exec(floorText);
    if (impassable && impassableMatch && impassableMatch[1] !== impassable) {
      const signStart = floorRange.start + impassableMatch.index + impassableMatch[0].indexOf(`"${impassableMatch[1]}"`);
      addReplacement(replacements, signStart, signStart + impassableMatch[1].length + 2, JSON.stringify(impassable), 'normalized impassable tile');
    }
    return replacements.length > before;
  }
  if (width !== expectedWidth) throw new Error(`floor ${floorIndex + 1}: expected width ${expectedWidth}, got ${width}`);

  const widthValueStart = floorRange.start + widthMatch.index + widthMatch[0].lastIndexOf(widthMatch[1]);
  const heightValueStart = floorRange.start + heightMatch.index + heightMatch[0].lastIndexOf(heightMatch[1]);
  addReplacement(replacements, widthValueStart, widthValueStart + widthMatch[1].length, String(width + 2), 'width');
  addReplacement(replacements, heightValueStart, heightValueStart + heightMatch[1].length, String(height + 3), 'height');

  const tilesMarker = source.indexOf('tiles:', floorRange.start);
  const tilesStart = source.indexOf('[', tilesMarker);
  const tilesEnd = matching(source, tilesStart, '[', ']');
  if (tilesMarker < 0 || tilesMarker > floorRange.end || tilesEnd > floorRange.end) throw new Error(`floor ${floorIndex + 1}: tiles missing`);
  const rowMatches = [];
  const rowRe = /"(?:\\.|[^"\\])*"/g;
  rowRe.lastIndex = tilesStart + 1;
  let rowMatch;
  while ((rowMatch = rowRe.exec(source)) && rowMatch.index < tilesEnd) {
    const row = JSON.parse(rowMatch[0]);
    if (row.length !== width) throw new Error(`floor ${floorIndex + 1}: row width ${row.length}, expected ${width}`);
    rowMatches.push({ start: rowMatch.index, end: rowRe.lastIndex, row });
  }
  if (rowMatches.length !== height) throw new Error(`floor ${floorIndex + 1}: row count ${rowMatches.length}, expected ${height}`);

  const borderKind = plan.borders[floorIndex];
  const edgeFor = rowIndex => borderKind === 'THUNDER_ENTRANCES'
    ? thunderBorderForRow(rowIndex, height)
    : borderKind;
  for (let rowIndex = 0; rowIndex < rowMatches.length; rowIndex++) {
    const item = rowMatches[rowIndex];
    const edge = edgeFor(rowIndex);
    addReplacement(replacements, item.start, item.end, JSON.stringify(`${edge}${item.row}${edge}`), 'tile row');
  }
  const indentMatch = /\n(\s*)"/.exec(source.slice(tilesStart, tilesEnd));
  const rowIndent = indentMatch ? indentMatch[1] : '                    ';
  const topBottom = edgeFor(-1).repeat(width + 2);
  const repeatedFormerTop = `${edgeFor(0)}${rowMatches[0].row}${edgeFor(0)}`;
  addReplacement(replacements, tilesStart + 1, tilesStart + 1, `\n${rowIndent}${JSON.stringify(topBottom)},\n${rowIndent}${JSON.stringify(repeatedFormerTop)},`, 'two-row top border');
  addReplacement(replacements, tilesEnd, tilesEnd, `,\n${rowIndent}${JSON.stringify(topBottom)}\n${rowIndent.slice(4)}`, 'bottom border');

  const excluded = objectRangesForProperty(source, floorRange.start, floorRange.end, 'exitPoint');
  const coordinateRe = /\b(x|y|x1|y1|x2|y2|toX|toY|targetX|targetY|minX|minY|maxX|maxY):\s*(-?\d+)/g;
  coordinateRe.lastIndex = floorRange.start;
  let coordinateMatch;
  while ((coordinateMatch = coordinateRe.exec(source)) && coordinateMatch.index < floorRange.end) {
    if (isInside(coordinateMatch.index, excluded)) continue;
    const numberStart = coordinateMatch.index + coordinateMatch[0].lastIndexOf(coordinateMatch[2]);
    const delta = coordinateMatch[1].toLowerCase().includes('y') ? 2 : 1;
    addReplacement(replacements, numberStart, numberStart + coordinateMatch[2].length, String(Number(coordinateMatch[2]) + delta), coordinateMatch[1]);
  }

  const impassable = plan.impassable[floorIndex];
  if (impassable && !/\bimpassableTiles\s*:/.test(floorText)) {
    const heightLineEnd = source.indexOf('\n', heightValueStart);
    const propertyIndent = source.slice(source.lastIndexOf('\n', heightValueStart) + 1, floorRange.start + heightMatch.index);
    addReplacement(
      replacements,
      heightLineEnd + 1,
      heightLineEnd + 1,
      `${propertyIndent}impassableTiles: [${JSON.stringify(impassable)}],\n`,
      'impassableTiles'
    );
  }
  return true;
}

function applyReplacements(source, replacements) {
  replacements.sort((a, b) => b.start - a.start || b.end - a.end);
  let lastStart = source.length + 1;
  for (const replacement of replacements) {
    if (replacement.end > lastStart) throw new Error(`Overlapping replacement near ${replacement.label}`);
    source = source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end);
    lastStart = replacement.start;
  }
  return source;
}

function authorArea(source, key, plan) {
  const area = findArea(source, key);
  const floors = findFloors(source, area);
  if (floors.floors.length !== plan.widths.length) {
    throw new Error(`${key}: expected ${plan.widths.length} floors, got ${floors.floors.length}`);
  }
  const replacements = [];
  let changed = false;
  let needsHeaderShift = false;
  let needsHeaderTopShift = false;
  floors.floors.forEach((floorRange, floorIndex) => {
    const floorText = source.slice(floorRange.start, floorRange.end + 1);
    const widthMatch = /\bwidth:\s*(\d+)/.exec(floorText);
    const heightMatch = /\bheight:\s*(\d+)/.exec(floorText);
    if (Number(widthMatch?.[1]) === plan.widths[floorIndex]) needsHeaderShift = true;
    if (Number(widthMatch?.[1]) === plan.widths[floorIndex] + 2 && Number(heightMatch?.[1]) === plan.heights[floorIndex] + 2) needsHeaderTopShift = true;
    if (collectFloorReplacements(source, floorRange, plan, floorIndex, replacements)) changed = true;
  });
  if (!changed) return source;

  if (needsHeaderShift) {
    const headerEnd = floors.marker;
    const headerCoordinateRe = /\b(x|y):\s*(-?\d+)/g;
    headerCoordinateRe.lastIndex = area.start;
    let headerMatch;
    while ((headerMatch = headerCoordinateRe.exec(source)) && headerMatch.index < headerEnd) {
      const numberStart = headerMatch.index + headerMatch[0].lastIndexOf(headerMatch[2]);
      const delta = headerMatch[1] === 'y' ? 2 : 1;
      addReplacement(replacements, numberStart, numberStart + headerMatch[2].length, String(Number(headerMatch[2]) + delta), `header ${headerMatch[1]}`);
    }
  }
  if (needsHeaderTopShift) {
    const headerEnd = floors.marker;
    const headerYRe = /\by:\s*(-?\d+)/g;
    headerYRe.lastIndex = area.start;
    let headerYMatch;
    while ((headerYMatch = headerYRe.exec(source)) && headerYMatch.index < headerEnd) {
      const numberStart = headerYMatch.index + headerYMatch[0].lastIndexOf(headerYMatch[1]);
      addReplacement(replacements, numberStart, numberStart + headerYMatch[1].length, String(Number(headerYMatch[1]) + 1), 'header second top y');
    }
  }
  return applyReplacements(source, replacements);
}

let source = fs.readFileSync(mapPath, 'utf8');
for (const [key, plan] of Object.entries(plans)) source = authorArea(source, key, plan);
fs.writeFileSync(mapPath, source, 'utf8');
console.log('Authored explicit fixed-map borders (top 2, other edges 1) and shifted in-map coordinates for 6 facilities.');
