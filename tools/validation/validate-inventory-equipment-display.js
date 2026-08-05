const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const inventory = fs.readFileSync(path.join(root, 'menus_inventory.js'), 'utf8');

if (!inventory.includes('inventory-equip-card-shell') ||
    !inventory.includes('inventory-equip-footer') ||
    !inventory.includes('inventory-equip-select') ||
    !inventory.includes('inventory-equip-lock')) {
    throw new Error('Inventory equipment cards or footer controls are missing.');
}
if (!inventory.includes('card?.getBaseStats') ||
    !inventory.includes('card?.getOptionText') ||
    !inventory.includes('card?.getTraitText')) {
    throw new Error('Inventory equipment cards are not using the shared complete equipment formatter.');
}
if (inventory.includes('Menu.getEquipDetailHTML(item, false)')) {
    throw new Error('Legacy inventory detail layout is still active.');
}
if (inventory.includes('特性:') || inventory.includes('特性：')) {
    throw new Error('Inventory card restored the removed trait prefix.');
}

console.log('Inventory equipment display validation passed: acquisition-style cards and footer controls are active.');
