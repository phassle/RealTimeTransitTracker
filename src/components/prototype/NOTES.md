# PROTOTYPE — Fancier control panel

**Question:** What should a fancier version of the map control panel look like?

**Shape:** UI prototype, sub-shape A — same map route, only the panel rendering
swaps via a `?variant=` URL param. Dev-only; production keeps the real
`ControlPanel` (`App.jsx` gates on `import.meta.env.DEV`).

## How to run

```bash
npm run dev   # http://localhost:3000
```

Flip variants with the floating pill at the bottom-centre, the ← / → keys, or by
setting `?variant=A|B|C|original` in the URL. Toggle dark mode (🌙) — every
variant is theme-aware via the existing `--chrome-*` CSS vars.

## Variants (structurally different, not recolours)

- **A — Glass HUD** (`VariantGlassHud`): frosted translucent left panel, hero
  stat numbers, glowing segmented mode pills. Vertical, premium reskin.
- **B — Command Dock** (`VariantCommandDock`): horizontal bar pinned to the
  bottom. Stats inline left, segmented mode control as the hero, regions/lines
  behind popovers that open upward.
- **C — Icon Rail** (`VariantIconRail`): thin vertical icon rail; each icon
  opens a contextual flyout. Hierarchy collapsed to icons; Overview flyout has
  a mode-distribution bar chart.
- **original**: the current `ControlPanel`, for side-by-side comparison.

## Verdict

**Winner: C — Icon Rail.** Per picked the rail + contextual-flyout structure and
asked for a **Palantir-inspired** aesthetic. Variant C has been reskinned to a
command-console look: hairline borders, sharp 2px corners, a steel-blue accent,
monospace readouts, uppercase micro-labels, and a LIVE/SYNC status strip. It is
now the default variant (`?variant=C`). Dark mode carries the signature
near-black slate palette; light mode is a neutral usable fallback.

Still open before production fold-in: re-add the **favourites stars** and
**camera-type sub-filters** the prototype dropped, write tests, and replace the
real `ControlPanel`. This PR ships the prototype for design sign-off only.

## Files (all throwaway)

- `src/components/prototype/` — variants, switcher, shared helpers, this file
- `App.jsx` — the `PanelComponent` dev gate (3 added lines)
