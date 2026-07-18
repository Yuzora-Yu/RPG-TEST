# Light Wing field sprites v003

- `down` keeps the accepted v002 wing layer unchanged.
- `up` was regenerated with the roots at the shoulder blades and the tips rising outward.
- `left` / `right` were regenerated with a broad two-wing silhouette visible in side view.
- `*-chroma.png` are the built-in image generator outputs.
- `*-alpha.png` are the managed transparent masters produced by `remove_chroma_key.py`.
- `tools/assets/build-hero-wing-sprites.py` composites the layers behind the canonical hero frames without modifying hero pixels.

Runtime outputs are `assets/generated/hero-wing-<direction>-<step>-v003.png`.
