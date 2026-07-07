# Area Cockpit + Script surface — ground-up rebuild spec (Dash, 2026-07-06)

Andrew's mandate (scoped to the AREA surface): existing code = feature spec only.
World-class design, simplicity, consistency, performance, maintainability. Diff irrelevant.

## Feature spec (current implementation + Andrew's verbatim asks)
1. Boot: photorealistic 3D flyover of client HQ immediately; radius ring + HQ pin; NEVER blank; no reset across tab switches.
2. Search: Google Places autocomplete, prominent, typo-proof.
3. On address pick (the qualification moment): drop to map view, frame the WHOLE red drive route HQ→prospect; one glass card: address · ✓/✗ IN SERVICE AREA (straight-line mi vs radius) · drive mi + min · 🏠 est. home value bold — all visible, nothing under layers.
4. Measure: draw on the yard → sq ft (map view only, auto-switch).
5. Street view of the house.
6. ✨ Visualizer: free-text describe → AI renders it on the real satellite yard, hold-to-compare (api/visualize, Gemini).
7. Diagnostics: any Google failure prints WHY on screen. Never silent.

## First-principles architecture
- ONE mode machine: mode = "3d" | "map" | "street". Ring/route/markers/measure exist ONLY in "map"; address pick forces mode=map + fitBounds; boot prefers 3d, falls back to map. Kills the hidden-under-a-layer bug class.
- Modules (Apprentice's logic lane per ruling, imported by the component):
  - src/map/loader.ts — importLibrary wrapper (js-api-loader pinned ^1)
  - src/map/qualify.ts — haversine, verdict, formatters (pure, testable)
  - src/map/useAreaMap.ts — hook owning map/3d/street lifecycles + the mode machine
  - src/components/AreaCockpit.tsx — thin composition: overlays only
  - api/home-value.js, api/visualize.js — unchanged (server lane)
- One overlay system: glass cards, one shadow, one radius, 12/13px ramp. top-left = search + qual card · top-right = mode switcher (3D | Map | Street) + Measure · bottom-right = ✨ Visualize · bottom-center = measure readout.
- Perf: idle-preload map libs post-login; keep-mounted; fitBounds animations only.

## Deletions
BadassMapCanvas.tsx (replaced), ZipChecker usage on this surface, mode-tangled refs/shims, silent catch-all fallbacks (replaced by the diagnostic surface).

## Script surface (scope extended by Andrew, same mandate)
Current: rich-text HTML rendered in an iframe (HtmlPreviewFrame) with injected
CSS fighting the editor's inline styles via !important — the whole class dies.
First principles: PARSE the stored content (HTML or marker format) into a
structured model — Module[] { title, rules[], sayLines[], notes[] } — and render
natively in React as a true teleprompter component (ScriptTeleprompter.tsx):
say-lines as the hero cards, rules quiet, module step-rail navigation (jump to
module N), sticky current-module header, density set for mid-call reading.
No iframe, no CSS injection, no editor-style warfare. Editing keeps the
existing RichTextEditor path untouched.
