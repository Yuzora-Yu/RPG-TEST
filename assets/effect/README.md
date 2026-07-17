# Battle Effect Runtime Assets

This folder is the runtime source of truth for battle effect graphics.

`polish.js` `PolishBattleFX` reads effect images from here. Accepted file naming should prefer:

- `fx_phys_<kind>_vNNN.png`
- `fx_spell_<element>_vNNN.png`
- `fx_support_<kind>_vNNN.png`
- `fx_breath_<kind>_vNNN.png`
- `fx_special_<kind>_vNNN.png`

Some `fx-*-ai.png` files are transitional accepted assets copied from earlier generated outputs. They should be replaced by the naming pattern above when their final versions are remade.

`fx_phys_elemental_arc_v001.png` is the neutral-color generated master for elemental physical attacks. `polish.js` keeps the weapon arc silhouette and applies the fire / ice / thunder / wind / light / dark / chaos grade in CSS. Do not route elemental physical attacks back to the old neutral slash image.

Effect scale is not encoded only in the bitmap. `PolishBattleFX.effectProfile()` derives a four-level power tier, target scope, hit count, action type, and element from each skill. CSS classes `battle-fx-tier-1` through `battle-fx-tier-4` add the corresponding scale, ring, afterglow, and flash.

The 2026-07-15 generated set adds separate final assets for sword slash, lance thrust, ground smash, ranged volley, high-tier arcane accent, healing radiance, debuff hex, and a neutral breath cone. The neutral breath and physical masters receive elemental color grading in CSS; high-tier elemental spells keep their element-specific primary sprite and layer the arcane circle as an accent instead of losing their element identity.

