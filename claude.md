# Gate Run v2 — "Wall Dodge" Gameplay Rebuild Plan
### Scoped as a DIFF against the finished v1 build (Phases 1–6 complete)
*Claude Code + Cursor workflow · per-step model picks · Aug 2026*

---

## Assumptions I made (override if wrong)
1. **Shield is visible from frame one** — a subtle glowing bubble around the ball from the intro, so its shatter on crash #1 reads as "I lost my armor," not "invisible mechanic fired."
2. **2nd crash = short impact beat, not slow-mo** — ball tumbles/bounces off the wall (~0.3s), then CTA slides up. Slow-mo is reserved for the crash-#1 "close call" so the two crashes feel different.
3. **No coin/breather pickup** — cut from scope; pacing comes purely from the 5-wall ramp.

---

## Locked spec v2 (paste into every prompt)

> Purple ball auto-rolls down the existing 3-lane perspective track. Swipe left/right changes LANE (reuses v1 swipe input; color system fully removed). Visible shield bubble around ball from start.
>
> **13 walls**, escalating: walls 1–4 single-gap (one lane open), walls 5–13 split-gap (two wall segments, one open lane between/beside them). Gap forgiveness, wall spacing, and approach speed all tighten each wall; approach ramps 2000ms → 900ms (~55% faster), spacing 2000ms → 500ms, forgiveness 220ms → 40ms. Several walls are in flight at once — spacing counts from the previous wall being SPAWNED, not passed.
>
> **Crash #1 (any wall):** shield shatters (bubble pop + shard burst), 0.4s slow-mo at ~40% timescale with white vignette flash, wall segment cracks open, ball squeezes through unharmed, run continues.
> **Crash #2:** hard fail — ball bounces off wall with quick tumble (~0.3s), cut to CTA. No game-over screen, no retry.
>
> **Win path:** clear all 13 walls → ~1.5s finish stretch (clear road, confetti trail) → ~2s celebration (text pop + burst) → CTA.
>
> **No idle assist.** Removed deliberately — the run is not rigged to complete itself. A player who never touches the screen crashes twice and reaches the CTA via the fail path.
>
> **Runtime (measured, not aspirational):** ~20s to CTA on a clean win. The fail path has no fixed length — it ends wherever the 2nd crash lands, from ~8.4s (no input at all) up past 15s for a late fumble. CTA triggers off wall/finish-line events, NEVER off a timer.

---

## What's reused vs rebuilt (read this before prompting anything)

| Module | Status |
|---|---|
| `core/` (app, resize, input, mraid) | **Reuse as-is** — swipe input already emits left/right |
| `game/track.ts` + `project(t, lane)` | **Reuse as-is** |
| `game/ball.ts` | **Minor edit** — strip color palette/switch, fix purple, keep squash-stretch on lane change; add shield child sprite |
| `game/gates.ts` | **Delete → new `game/walls.ts`** |
| `game/director.ts` | **Significant rework** — new state machine (crash counter, dual crash outcomes, wallCount-based CTA trigger) |
| `fx/` (particles, trail, shake) | **Reuse** + one new effect (shield shatter shards) |
| `ui/cta.ts`, tutorial hand, text pops | **Reuse** — retarget hand to "swipe to dodge" copy |
| Slow-mo system (v1 gate-3 near-miss) | **Reuse** — retarget trigger to crash #1 |

Net-new code is basically: walls.ts, shield visuals + shatter, director rework, difficulty ramp table. Everything else is retargeting.

---

## Phase R0 — Branch + audit (15 min)
**Tool:** Cursor · **Model:** Composer 2.5 / Auto

```bash
git checkout -b feat/wall-dodge-v2
```

**Prompt:**
```
Read CLAUDE.md. We are replacing the color-match mechanic with a lane-dodge
mechanic (spec below). [paste spec] Produce an audit: list every file that
references the color system (COLORS const, color switch logic, gate color
resolve), every file that can stay untouched, and the exact call sites in
director.ts that walls.ts will need to hook instead of gates.ts. Do NOT
change any code yet.
```

Also update `CLAUDE.md` + `.cursor/rules/*.mdc` NOW with the v2 spec (replace the old gate/color spec) — same commit, before any agent touches code. Two rule files drifting from the actual game is how agents reintroduce deleted mechanics.

## Phase R1 — Director rework design (30–45 min, do this before any implementation)
**Tool:** Claude Code, Plan Mode · **Model:** Claude Opus 5 (Claude Code default) — this is the one genuinely stateful piece; worth the strong model.

**Prompt:**
```
Read CLAUDE.md (v2 spec) and the R0 audit. In plan mode, redesign GameDirector:
1. States: INTRO → RUN(wallIndex 0..12) → WALL_RESOLVE(pass | crash1 | crash2)
   → FINISH_STRETCH → CELEBRATE → CTA, plus FAIL_IMPACT → CTA on crash2.
2. crashCount lives in the director, not walls.ts. WALL_RESOLVE outcomes:
   - pass: burst + shake (existing fx), advance
   - crash1 (crashCount 0→1): shield shatter sequence + slow-mo + wall crack-open,
     then resume RUN. Slow-mo must reuse the v1 timescale system (game timescale
     only; UI/GSAP-global untouched).
   - crash2: impact tumble (~0.3s), straight to CTA. CTA layer must be
     interactive immediately even if impact anim is still settling.
3. Difficulty ramp as ONE table: WALLS = [{type: 'single'|'split', openLane,
   gapForgiveness, approachSpeed, spacing}] — all tuning lives here, nothing
   hardcoded in walls.ts.
4. Collision definition: ball is "in the gap" if its lane equals openLane at
   the moment wall t crosses the ball's t, with gapForgiveness allowing a
   late swipe mid-crossing on early walls (forgiveness shrinks per the table).
5. Idle assist: SUPERSEDED — this was built, then removed outright. The run is
   not rigged to complete itself; a hands-off player fails out. Do not reinstate.
Flag ambiguities before implementing.
```

Review the plan yourself, then approve implementation of the director rework in the same session.

## Phase R2 — walls.ts + ball edits (1–2 hrs)
**Tool:** Cursor Agent · **Model:** Claude Sonnet 5 (still the default agent pick; intro pricing ends Aug 31 — this phase lands inside it)

**Task R2a — walls.ts:**
```
Implement game/walls.ts replacing gates.ts per the plan:
- Procedural PIXI.Graphics wall segments, purple-complementary palette
  (dark slate segments, warning-glow rim), scaled via project(t, lane).
- 'single': two segments covering the two closed lanes. 'split': two segments
  with the open lane between/beside them — visually distinct silhouette so the
  player reads the pattern earlier at speed.
- Crack-open state for crash1: segment splits with a jagged seam + shards
  (pooled), leaving a ball-sized hole.
- Consumes the WALLS ramp table only; no local difficulty constants.
```

**Task R2b — ball.ts edits (can run parallel in a second agent/branch if you want, it's independent):**
```
Edit game/ball.ts: remove COLORS/color-switch entirely, ball is fixed purple
(keep the two-circle fake-gradient). Keep squash-stretch, now triggered on
lane change. Add shield: a translucent glowing bubble (additive blend, gentle
1.5s pulse loop) as a child, with shatter() → 10-12 pooled shard sprites
bursting outward + bubble alpha snap to 0. Expose hasShield for the director.
```

Test on a real phone after R2a lands: can you READ split-gap walls in time at wall-5 speed? If not, the fix is silhouette contrast or spacing in the table — not slowing the whole game.

## Phase R3 — Crash sequences + juice retarget (1–2 hrs)
**Tool:** Cursor · **Model:** Claude Sonnet 5; escalate a single stuck effect to Opus 5 / GPT-5.5, then drop back.

Order:
1. **Crash-1 sequence** — wire shield shatter + slow-mo + crack-open + vignette into WALL_RESOLVE(crash1). This is choreography, not new systems: one GSAP timeline calling existing pieces.
2. **Crash-2 impact** — ball tumble (rotation + bounce-back tween, ~0.3s), screen shake at higher amplitude than pass-shake, immediate CTA slide-in layered over it.
3. **Speed-ramp feel pass** — chevron scroll rate and trail sample rate should scale with approachSpeed so speed reads visually, not just mechanically.
4. **Retarget tutorial hand** — "swipe to dodge" at wall 1 only, hides after first input.
5. **Finish stretch** — 1.5s clear-road with confetti trail behind ball, then celebration text pop.

## Phase R4 — Pacing + difficulty tuning (30–60 min, mostly YOU, not the agent)
**Tool:** your thumbs on a phone · **Model:** none (or Haiku 4.5 / Composer for mechanical table edits)

- Everything tunable is in the WALLS table — iterate there only.
- Verify with a stopwatch: clean win ~20s, wall-1 approach ≥2s (first-time readability). The fail path has no target length — it ends wherever the 2nd crash lands.
- Rig check: an average player should crash ~once somewhere in the back half of the ramp (the shield moment is your emotional peak — if nobody ever crashes, tighten late-wall forgiveness; if everyone crashes twice early, loosen it).
- Idle test: hands-off run must still reach the CTA — via the fail path, not a win. It must never stall or dead-end.

## Phase R5 — CTA trigger rework + compliance re-sweep (30 min)
**Tool:** Claude Code · **Model:** Claude Opus 5

- Confirm CTA is now event-driven (FINISH/crash2), remove any残 v1 timer trigger.
- Re-run the v1 compliance audit prompt (sandbox iframe, orientation change mid-slow-mo, no external requests, gzip size vs budget — shard/shield code should add ~nothing).
- MRAID pause/resume must now also freeze the slow-mo timescale correctly (pause during slow-mo, resume still in slow-mo, not snapped out).

## Phase R6 — Cleanup + merge (20 min)
**Tool:** Cursor · **Model:** Composer 2.5 / Auto

- Dead-code sweep: gates.ts gone, COLORS gone, any color-swipe references gone (grep, don't trust memory).
- `npm run size`, final phone pass, merge `feat/wall-dodge-v2` → main, update the portfolio blurb (new capture: the shield-shatter slow-mo is your money shot for the 15s reel — make sure the recording includes a crash-1).

---

## Model cheat-sheet for this rebuild

| Step | Tool | Model |
|---|---|---|
| R0 audit + rules update | Cursor | Composer 2.5 / Auto |
| R1 director redesign | Claude Code (plan mode) | **Claude Opus 5** |
| R2 walls + ball | Cursor Agent | **Claude Sonnet 5** (ball.ts can go to Gemini in a parallel agent if you split) |
| R3 crash choreography | Cursor | Claude Sonnet 5 (escalate stuck effects only) |
| R4 tuning | You + phone | Haiku 4.5 / Composer for table edits |
| R5 CTA + compliance | Claude Code | **Claude Opus 5** |
| R6 cleanup + merge | Cursor | Composer 2.5 |

## Definition of done (v2 deltas)
- No color system anywhere in the codebase; ball is purple with a visible shield
- 13-wall ramp entirely table-driven; single + split gaps both readable at speed
- Crash #1: shatter + slow-mo + continue. Crash #2: impact → CTA. Both feel distinct
- CTA is event-driven (no timers anywhere in src); clean win ~20s, fail path ends at the 2nd crash
- Compliance sweep re-passed; size budget unchanged