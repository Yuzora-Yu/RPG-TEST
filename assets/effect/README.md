# Battle Effect Runtime Assets

This folder is the runtime source of truth for battle effect graphics.

`polish.js` `PolishBattleFX` reads effect images from here. Accepted file naming should prefer:

- `fx_phys_<kind>_vNNN.png`
- `fx_spell_<element>_vNNN.png`
- `fx_support_<kind>_vNNN.png`
- `fx_breath_<kind>_vNNN.png`
- `fx_special_<kind>_vNNN.png`

Some `fx-*-ai.png` files are transitional accepted assets copied from earlier generated outputs. They should be replaced by the naming pattern above when their final versions are remade.

