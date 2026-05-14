# PRISMA ABYSS Layout Style Map

Screen layout CSS is centralized in `modern-polish.css`.

- `body.game-page`: `index.html` runtime game screen layout and visual polish.
- `body.title-page`: `main.html` title/save-management screen layout.
- `modern-polish.css` order: base game layout, title page layout, shared animation keyframes, then modern visual polish overrides.
- `index.html` and `main.html` should not add new `<style>` blocks for layout fixes. Add reusable layout rules to `modern-polish.css` under the matching page scope.
- JavaScript should keep inline styles only for dynamic values, one-off DOM state, or generated content that cannot be expressed as a stable class yet.

This keeps layout changes from being split between HTML inline `<style>` blocks and CSS override files.
