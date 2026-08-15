# "Color Match Gate Run" — Playable Ad Build Plan
### Claude Code + Cursor workflow with per-step model picks
*Target: single-file HTML playable, <3MB zipped, 20–30s loop, Pixi.js + GSAP*

---

## The Game (locked spec — paste this into every planning prompt)

> A glossy ball auto-rolls forward down a 3-lane track (fake-3D perspective in 2D Pixi — track narrows toward a vanishing point). Colored gates approach the player. The ball must match the gate's color to pass through. Player swipes left/right (or taps left/right halves of screen) to cycle the ball's color between 3 colors (e.g., magenta / cyan / yellow).
>
> **Pacing (rigged, like real playable ads):**
> - Gate 1: ball already matches → free win, teaches "passing feels good"
> - Gate 2: wrong color, generous timing window → player swipes, succeeds
> - Gate 3: wrong color, tighter window, gate flashes as a hint → player succeeds (input is assisted: any swipe within the window snaps to the correct color)
> - Finish line: confetti burst, ball scales up, "YOU'RE A NATURAL!" text pop
> - CTA overlay slides up: fake app icon + "PLAY NOW" button (pulsing), dimmed gameplay behind it
> - Idle fallback: if no input for 4s at any point, auto-play the correct move and continue (playables must never dead-end)
>
> **Feel targets:** 60fps on mid-range mobile, squash/stretch on color switch, motion trail behind ball, screen shake + particle burst on each gate pass, near-miss slow-mo (0.3s at 40% speed) on gate 3.

---

## Ground Rules for the Whole Project (put in CLAUDE.md / .cursorrules)

Create this file FIRST — both tools will read it and it prevents 80% of AI drift:

```markdown
# CLAUDE.md / .cursorrules

## Project: Playable ad (Color Match Gate Run)
- FINAL DELIVERABLE: one self-contained index.html. Zero network requests at runtime.
- All assets inlined: base64 images (or better: procedural PIXI.Graphics — no image files at all), no external fonts (system font stack or one subsetted base64 woff2).
- Size budget: 2.5MB zipped HARD CAP (Meta's limit is the strictest major network at ~2MB; ironSource/Unity/AppLovin allow ~5MB single-HTML).
- Stack: Pixi.js v8 + GSAP. No React. No physics engine (lane logic is arithmetic).
- Vanilla TS, Vite for dev, single-file build via vite-plugin-singlefile.
- Mobile-first: touch events primary, mouse as fallback. Portrait AND landscape must both work (letterbox the play area, don't stretch).
- 60fps target: object pooling for particles, no per-frame allocations in the ticker, no filters heavier than one blur.
- MRAID shim: check for window.mraid; if present, gate game start on mraid ready + viewable events; CTA button calls mraid.open(STORE_URL), else window.open.
- Never add features not in the spec. Ask before adding dependencies.
```

---

## Phase 0 — Scaffold (15 min)
**Tool:** Cursor · **Model:** Composer 2.5 (or Auto)
Boilerplate — don't spend frontier-model credits here. Composer 2.5 is Cursor's fast in-house model and pulls from the cheaper usage pool.

**Prompt:**
```
Scaffold a Vite + TypeScript project for a single-file playable ad.
- deps: pixi.js@^8, gsap
- devDeps: vite-plugin-singlefile
- vite.config.ts: singlefile plugin, target es2018, inline all assets, no code splitting
- src/main.ts boots a PIXI.Application (resizeTo: window, backgroundAlpha via solid dark bg color, antialias on desktop only via matchMedia)
- src/ folder structure: core/ (app, resize, input, mraid), game/ (track, ball, gates, director), fx/ (particles, trail, shake), ui/ (cta, tutorialHand, textPops)
- npm scripts: dev, build, and "size" script that gzips dist/index.html and prints the byte count
Create empty stub files with one-line comments describing responsibility. Don't implement logic yet.
```

**Verify:** `npm run dev` shows a blank Pixi canvas; `npm run build` emits ONE html file; `npm run size` prints a number.

---

## Phase 1 — Architecture pass (30 min, highest-leverage step)
**Tool:** Claude Code, **Plan Mode** (shift+tab) · **Model:** Claude Opus 5 (the current Claude Code default) — or Claude Fable 5 if you have access and want the strongest reasoning for the state-machine design.

This is where you want deep reasoning: the game director (rigged pacing + idle auto-play + interrupt-safe tweens) is the only genuinely tricky logic in the project.

**Prompt:**
```
Read CLAUDE.md and the spec below. [paste the locked spec]

In plan mode, design (do not implement yet):
1. A GameDirector state machine: INTRO → RUN(gateIndex) → GATE_RESOLVE → FINISH → CTA, plus an IDLE_ASSIST watcher that can inject the correct input after 4s of inactivity from ANY state without corrupting state.
2. The fake-3D projection math: track is a trapezoid; a gate at progress t ∈ [0,1] gets scale(t) and y(t). Ball sits at fixed y, lanes map to x offsets scaled by perspective. Keep it as one pure function project(t, lane) → {x, y, scale}.
3. Input model: swipe threshold vs tap-halves, how "assisted input" on gate 3 works (any input inside the assist window resolves to the correct color).
4. Time model: everything driven by a single normalized runProgress advanced in the ticker, so slow-mo = scaling one timescale variable (gsap.globalTimeline.timeScale must stay untouched — UI tweens keep running during slow-mo).
5. File-by-file responsibilities matching the existing stubs.

Flag any spec ambiguities before we build.
```

Review the plan yourself — you have 7 years of frontend instinct, use it. Then approve and let it implement `core/` + the GameDirector skeleton in the same session (Opus 5, normal mode).

---

## Phase 2 — Core gameplay (2–3 hrs)
**Tool:** Cursor Agent mode · **Model:** Claude Sonnet 5 (current community default; strong agent mode, 1M context, cheap through Aug 31). Budget alternative for long grinding sessions: Grok 4.5 (Cursor's value pick, built for agent work).

Work in small agent tasks, one per commit:

**Task 2a — Track + projection:**
```
Implement game/track.ts using the project(t, lane) function from the plan.
Procedural PIXI.Graphics only: dark track trapezoid, lane divider lines, subtle
scrolling chevrons on the track to sell forward motion (offset by runProgress).
Add a debug overlay (toggle with 'd') showing gate t-values and current lane.
```

**Task 2b — Ball + color switching:**
```
Implement game/ball.ts: circle with radial-gradient-fake (two stacked circles),
3-color palette from a single COLORS const. Swipe/tap cycles color with a GSAP
squash-stretch (scaleX 1.25/scaleY 0.8 → back, 180ms, back.out). Color change
is instant logically, animated visually (flash ring on switch).
```

**Task 2c — Gates + resolve logic:**
```
Implement game/gates.ts + wire GateResolve in the director per the plan:
gate = full-width bar with a colored core and glow rim, approaches via project().
Match → gate shatters into 8 shards (pooled Graphics, GSAP outward+fade).
The rigged pacing table lives in one GATES const: [{color, assist, hintFlash}].
```

**Verify after each task on a real phone** (dev server over LAN, `--host`). Cursor can't feel input latency for you.

---

## Phase 3 — Juice pass (1–2 hrs)
**Tool:** Cursor · **Model:** Claude Sonnet 5. (If a specific effect fights you — e.g., the trail looks wrong — escalate that one conversation to Claude Opus 5 or GPT-5.5, then drop back down.)

One prompt per effect, in this order (each is verifiable in isolation):
1. **Motion trail** — ring buffer of 12 pooled sprites sampling ball position every 24ms, alpha/scale falloff, tinted to current ball color.
2. **Gate-pass burst** — pooled particle emitter (16 particles, gravity, 400ms), plus 6px/120ms screen shake on the game container (never the CTA layer).
3. **Slow-mo on gate 3** — timescale dip to 0.4 for 300ms with a 60ms white vignette flash, then ease back over 200ms.
4. **Text pops** — "GREAT!" / "PERFECT!" with GSAP elastic scale-in, 500ms life.
5. **Tutorial hand** — animated hand/chevron sprite showing swipe direction, appears at gate 2, hides forever after first real input.
6. **Sound (optional but strong)** — 3 tiny synthesized SFX via WebAudio (no files): switch blip, pass chime, win fanfare. Must init on first touch (autoplay policy), and must be muted by default when MRAID reports audio restrictions.

---

## Phase 4 — CTA + MRAID + ad-network compliance (1 hr)
**Tool:** Claude Code · **Model:** Claude Opus 5 — MRAID lifecycle edge cases (viewability gating, pause/resume on ad hide) are exactly the "subtle correctness" work worth the stronger model.

**Prompt:**
```
Implement ui/cta.ts and core/mraid.ts per CLAUDE.md:
- CTA overlay: dim layer, fake app icon (procedural), title, pulsing PLAY NOW
  button (GSAP scale 1↔1.06 loop). Entire overlay is clickable, not just button.
- MRAID: if window.mraid exists → wait for 'ready', gate start on isViewable /
  'viewableChange'; pause ticker + all GSAP when not viewable, resume cleanly.
- clickthrough(): mraid.open(url) if present else window.open(url, '_blank').
  STORE_URL is a const at top of main.ts.
- Also fire clickthrough on any tap after the CTA has been visible for 2s
  anywhere on screen (standard playable behavior).
- Add ?state= query param for testing: ?state=cta jumps straight to CTA.
```

Then a compliance sweep prompt:
```
Audit the built dist/index.html for playable-ad network compliance:
no external network requests, no localStorage/cookies, no document.write,
gzipped size vs 2.5MB budget, works when injected into an iframe with
sandbox="allow-scripts", orientation change mid-game doesn't break layout.
Produce a checklist with pass/fail and fix the failures.
```

---

## Phase 5 — Size + perf hardening (30–60 min)
**Tool:** Claude Code · **Model:** Claude Opus 5 for the build-config surgery; Haiku 4.5 (or Composer 2.5 in Cursor) for the mechanical cleanups it prescribes.

- `npm run size` — you should be nowhere near budget since assets are procedural; if Pixi v8 full build pushes it, have the model set up a custom Pixi build importing only used subsystems.
- Perf audit prompt: "Profile the ticker: eliminate per-frame allocations, confirm particle/trail pooling, cap devicePixelRatio at 2."
- Test on the worst device you can find, not your Blade 16.

---

## Phase 6 — Portfolio packaging (30 min)
**Tool:** Cursor · **Model:** Composer 2.5 / Auto (this is light work)

- Deploy the single HTML to your portfolio behind a phone-frame wrapper page (iframe with device bezel, portrait default, landscape toggle).
- Add a short "How it's built" blurb next to it: single-file, size in KB, procedural assets, MRAID-ready, rigged-pacing design. That paragraph is what makes it read as *ad-tech competence* rather than *mini-game*.
- Record a 15s screen capture as fallback for recruiters on desktop who won't interact.

---

## Model cheat-sheet (Aug 2026)

| Step | Tool | Model | Why |
|---|---|---|---|
| Scaffold | Cursor | Composer 2.5 / Auto | Boilerplate; save credits |
| Architecture plan | Claude Code (plan mode) | **Claude Opus 5** (or Fable 5) | State machine + projection math design |
| Core gameplay | Cursor Agent | **Claude Sonnet 5** | Best default agent coder right now, cheap intro pricing |
| Long grind sessions (alt) | Cursor Agent | Grok 4.5 | Value pick for extended agent runs |
| Juice/FX | Cursor | Claude Sonnet 5 | Iterative visual work |
| Stuck on one effect | Cursor | Opus 5 or GPT-5.5 | Escalation path only |
| MRAID + compliance | Claude Code | **Claude Opus 5** | Lifecycle edge cases |
| Size/perf surgery | Claude Code | Opus 5 → Haiku 4.5 | Plan with big model, execute cleanups cheap |
| Packaging | Cursor | Composer 2.5 | Trivial |

## Definition of done
- One index.html, <2.5MB zipped, zero runtime network calls
- 60fps on a mid-range Android phone
- Completes in 20–30s with zero input (idle assist) AND feels skill-based with input
- CTA reachable from every path; clickthrough works with and without MRAID
- Survives sandboxed iframe + orientation change
- Live and playable on your portfolio with a build-notes blurb