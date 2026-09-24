# Pixels in Motion — shader-driven slides

A self-contained presentation that demonstrates its own thesis: **GLSL for atmosphere, SVG for meaning, vanilla everything else.** Eleven slides, zero dependencies, zero build step.

## Run it

```sh
npx serve .        # or: python3 -m http.server
# ...or just open index.html — everything is inline or local
```

## Controls

| Input | Action |
| --- | --- |
| `→` `↓` `Space` `PageDown` `click` / swipe | next slide |
| `←` `↑` `PageUp` | previous slide |
| `Home` / `End` | first / last slide |
| `1`–`5` | toggle Pixelate · Halftone · Grid · Aberration · Grain |
| `F` | fullscreen |

## Structure

```
index.html   eleven slides, semantic DOM, inline SVG
style.css    layout, panels, five keyframe families
gl.js        WebGL2 renderer — one program, eleven scenes, the FX stack
slides.js    navigation, activation, letter-splitting
```

## How it works

**GLSL layer.** A single fragment shader contains all eleven scene functions
(`waves`, `ink`, `glow`, `rings`, `blueprint`, `vroom`) behind an explicit
if-chain, selected by a `u_slide` uniform. Slide changes trigger a
noise-dissolve transition (mix by `smoothstep(noise, u_progress)`) with a hot
rim. The post-FX chain runs in fixed order: pixelate → aberration → halftone →
grid → vignette → grain, each driven by an eased 0–1 uniform so chips and
number keys crossfade effects live.

**SVG layer.** Titles are split into per-letter spans (`data-split`), each on
its own staggered clock (`--i × 32 ms`). Icons draw on via
`stroke-dasharray: 1` + `pathLength="1"` — every path shares one normalized
clock regardless of its real length. The morphing blob uses SMIL path
interpolation between structurally identical paths. Deactivating a slide resets
animations (`animation: none`), so entrances replay on every visit.

**Transitions.** The DOM layer crossfades in 0.55 s; the shader dissolves in
0.95 s. They overlap deliberately — the GPU keeps painting while the DOM
settles, so nothing ever looks "cut".

## Principles (github.com/basecamp/house-style)

Applied to this codebase:

- **A pleasure to read** — both JS files read top-down in invocation order:
  boot → compile → state → frame → public API.
- **Abstractions earn their keep** — no effect base-class, no scene registry,
  no framework. Five effects are five uniform reads; eleven scenes are eleven
  if-branches. A registry would need a third variation that doesn't exist.
- **Explicit over clever** — `data-scene="3"` on each slide beats deriving
  scene ids from DOM order; the if-chain beats reflection.
- **Compute at write time** — shader source is a template string compiled once;
  letter-splitting and `pathLength` normalization happen once at load; the
  render loop allocates nothing per frame.
- **Choose boring, native, removable tech** — WebGL2, SMIL, CSS keyframes. Any
  piece can be deleted and replaced without ceremony.

## Adding a slide

1. Add a `<section class="slide" data-scene="N" data-fx="ca:.2,grain:.3">` to
   `index.html`.
2. Add a scene function + one line to `scene()` in `gl.js`'s fragment shader.
3. Nothing else — navigation, transitions, and effects are generic.

## Accessibility & fallback

- `prefers-reduced-motion` freezes ambient shader time and collapses all
  entrance animations to near-zero duration.
- No WebGL2 → the canvas hides, slides render over a static CSS gradient.
- All text is real DOM text (selectable, screen-reader friendly); the canvas is
  `aria-hidden`.