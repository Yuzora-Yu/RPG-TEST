const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const inventory = fs.readFileSync(path.join(root, 'menus_inventory.js'), 'utf8');
const common = fs.readFileSync(path.join(root, 'menus.js'), 'utf8');

if (inventory.includes('traitHtml') || inventory.includes('color:#00ffff')) {
    throw new Error('Inventory still renders a second cyan trait line below the shared equipment details.');
}
if (!common.includes('getEquipDetailHTML: (equip, showName = true) =>') ||
    !inventory.includes('Menu.getEquipDetailHTML(item, false)')) {
    throw new Error('The shared equipment detail and gold trait display was removed unexpectedly.');
}

console.log('Inventory equipment display validation passed: traits render once through the shared detail formatter.');
