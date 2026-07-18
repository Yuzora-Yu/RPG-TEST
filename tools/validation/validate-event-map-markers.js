const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const main = read('main.js');
const phaser = read('phaser-field.js');
const assets = read('assets.js');
const editor = read('map_story_editor.html');
const developmentPolicy = read('docs/development-policy.md');
const markerRelative = 'assets/map/overlays/overlay_event_blue_glimmer_v001.png';
const markerPath = path.join(root, markerRelative);

assert(!main.includes('大きな障害物が道を塞いでいる'), 'Generic blocking-decoration log still exists');
assert(main.includes('if (targetBlockingObject.log) App.log(targetBlockingObject.log);'), 'Blocking decorations do not use explicit logs only');
assert(main.includes('宝箱が道を塞いでいる'), 'Chest-specific blocked log was removed accidentally');

assert(assets.includes(`overlay_event_blue_glimmer: "${markerRelative}"`), 'Blue event glimmer is not registered');
assert(fs.existsSync(markerPath), 'Blue event glimmer asset is missing');
const png = fs.readFileSync(markerPath);
assert(png.subarray(1, 4).toString('ascii') === 'PNG', 'Blue event glimmer is not a PNG');
assert(png.readUInt32BE(16) === 32 && png.readUInt32BE(20) === 32, 'Blue event glimmer must be a 32x32 tile asset');
assert(png[25] === 6, 'Blue event glimmer must be RGBA');

assert(main.includes("img: 'overlay_event_blue_glimmer'"), 'Image-less map actions do not receive the blue glimmer');
assert(main.includes('action.suppressEventMarker === true'), 'Map actions have no explicit event-marker opt-out');
assert(main.includes('const hasPhysicalObject = !!Field.getBlockingObjectAt?.(tileX, tileY)'), 'Image-less event markers do not defer to physical map objects');
assert(main.includes('eventMarker: true'), 'Blue glimmer is not identified as an event marker');
assert(main.includes('blockingObject: false'), 'Blue glimmer must never become a movement blocker');
assert(main.includes('suppressShadow: true'), 'Blue glimmer must not receive an object shadow');
assert(main.includes('overlayConfig.suppressShadow !== true'), 'Overlay renderer ignores shadow suppression');
assert(main.includes('drawWidth: Math.max(9, Number(action.markerDrawWidth || 12))'), 'Blue glimmer is not configured for a 12 px maximum');
assert(main.includes('const eventMarkerPulse = eventMarkerOverlay && Field.step === 1 ? 0.75 : 1;'), 'Legacy blue glimmer is not constrained to 9-12 px');
assert(main.includes('ctx.globalAlpha = Field.step === 1 ? 0.52 : 0.92;'), 'Legacy blue glimmer has no restrained blink');
assert(phaser.includes('const eventMarkerOverlay = overlay.eventMarker === true;'), 'Phaser renderer does not recognize event markers');
assert(phaser.includes("displayWidth: { from: Math.max(9, width * 0.75), to: width }"), 'Phaser event marker is not constrained to 9-12 px');
assert(phaser.includes("duration: 520") && phaser.includes("yoyo: true") && phaser.includes("repeat: -1"), 'Phaser event marker tween is not continuous');
assert(phaser.includes('eventMarkerOverlay ? py + TILE_SIZE / 2 : py + TILE_SIZE'), 'Phaser event marker is not centered in its tile');
assert(phaser.includes('object?.__prismaTween?.remove?.();'), 'Phaser event marker tweens are not cleaned up');
assert(developmentPolicy.includes('phaser-field.js') && developmentPolicy.includes('automatic safety fallback'), 'Phaser-first rendering policy is not documented');
assert(editor.includes("'overlay_event_blue_glimmer'"), 'Map editor does not preview the image-less event marker');
assert(!editor.includes("log:'調べても特に変わったものはない。'"), 'Editor still injects generic blocking-object text');

console.log('Explicit blocking-object logs and image-less event glimmers validated.');
