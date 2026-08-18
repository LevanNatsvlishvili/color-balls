// GameDirector state machine, wall pacing, and crash outcomes.

import gsap from 'gsap';
import type { Lane } from './track';
import type { WallConfig } from './walls';

export type DirectorState =
  | 'INTRO'
  | 'WALL_GAP'
  | 'RUN'
  | 'WALL_RESOLVE'
  | 'CRASH_RECOVER'
  | 'FAIL_IMPACT'
  | 'FINISH_STRETCH'
  | 'CELEBRATE'
  | 'CTA';

export interface DirectorEvents {
  onStateChange?(state: DirectorState): void;
  onWallPass?(wallIndex: number): void;
  /** Crash #1: the shield absorbs it and the run continues. */
  onCrashShielded?(wallIndex: number): void;
  /** Crash #2: hard fail. Show the CTA here, not on the CTA state, so it is tappable during the tumble. */
  onCrashFatal?(wallIndex: number): void;
  onFinish?(): void;
  onCelebrate?(): void;
}

const INTRO_DURATION_MS = 600;
const CRASH_RECOVER_DURATION_MS = 900;
const FAIL_IMPACT_DURATION_MS = 300;
const FINISH_STRETCH_DURATION_MS = 1500;
const CELEBRATE_DURATION_MS = 2000;

/**
 * Progress at which the wall plane reaches the ball and the verdict window opens.
 * Forgiveness extends the verdict later within [CONTACT_T, 1], so the wall is
 * always visibly overlapping the ball while a late swipe can still save it.
 */
const CONTACT_T = 0.92;

const SLOWMO_SCALE = 0.4;
const SLOWMO_HOLD_MS = 400;
const SLOWMO_EASE_MS = 200;

function clampLane(value: number): Lane {
  if (value <= -1) return -1;
  if (value >= 1) return 1;
  return 0;
}

export class GameDirector {
  state: DirectorState = 'INTRO';
  wallIndex = 0;
  /** 0..1 progress of the current wall's approach. Resets every wall. */
  runProgress = 0;
  /** Monotonic, never resets — drives track/chevron scroll. */
  distanceTraveled = 0;
  /** Scales gameplay-only delta time. State timers and cosmetic GSAP tweens are unaffected. */
  gameTimeScale = 1;
  lane: Lane = 0;
  crashCount = 0;

  private readonly walls: readonly WallConfig[];
  private readonly events: DirectorEvents;
  private stateElapsedMs = 0;

  constructor(walls: readonly WallConfig[], events: DirectorEvents = {}) {
    this.walls = walls;
    this.events = events;
  }

  get hasShield(): boolean {
    return this.crashCount === 0;
  }

  /** Call once per tick with the raw (unscaled) frame delta. */
  update(deltaMS: number): void {
    this.stateElapsedMs += deltaMS;

    // State timers run on raw time; only world motion is scaled. Otherwise the
    // 0.4s slow-mo beat would stretch to a full second of wall-clock.
    const scaledDeltaMS = deltaMS * this.gameTimeScale;

    switch (this.state) {
      case 'INTRO':
        if (this.stateElapsedMs >= INTRO_DURATION_MS) this.beginWall();
        break;
      case 'WALL_GAP':
        this.distanceTraveled += scaledDeltaMS;
        if (this.stateElapsedMs >= this.walls[this.wallIndex].spacingMs) this.setState('RUN');
        break;
      case 'RUN':
        this.updateRun(scaledDeltaMS);
        break;
      case 'WALL_RESOLVE':
        // Dispatcher only — resolveWall() always leaves it in the same frame.
        break;
      case 'CRASH_RECOVER':
        // The wall stays pinned at the ball (runProgress frozen) while it cracks
        // open, but the track keeps scrolling so the slow-mo reads visually.
        this.distanceTraveled += scaledDeltaMS;
        if (this.stateElapsedMs >= CRASH_RECOVER_DURATION_MS) {
          this.wallIndex++;
          this.beginWall();
        }
        break;
      case 'FAIL_IMPACT':
        if (this.stateElapsedMs >= FAIL_IMPACT_DURATION_MS) this.setState('CTA');
        break;
      case 'FINISH_STRETCH':
        this.distanceTraveled += scaledDeltaMS;
        if (this.stateElapsedMs >= FINISH_STRETCH_DURATION_MS) {
          this.setState('CELEBRATE');
          this.events.onCelebrate?.();
        }
        break;
      case 'CELEBRATE':
        this.distanceTraveled += scaledDeltaMS;
        if (this.stateElapsedMs >= CELEBRATE_DURATION_MS) this.setState('CTA');
        break;
      case 'CTA':
        break;
    }
  }

  /** Raw swipe reported by input.ts, already reduced to a lane delta by the caller. */
  registerInput(delta: -1 | 1): void {
    if (this.state !== 'RUN') return;
    this.lane = clampLane(this.lane + delta);
  }

  /** Dips gameplay time scale without touching gsap.globalTimeline, so UI tweens keep full speed. */
  triggerSlowMo(scale: number, holdMs: number, easeBackMs: number): void {
    gsap.killTweensOf(this);
    this.gameTimeScale = scale;
    gsap.to(this, { gameTimeScale: 1, duration: easeBackMs / 1000, delay: holdMs / 1000, ease: 'power1.out' });
  }

  /** Progress at which this wall's verdict locks in. Forgiveness never pushes it past 1. */
  private verdictT(wall: WallConfig): number {
    const forgiveness = Math.min(wall.gapForgivenessMs / wall.approachDurationMs, 1 - CONTACT_T);
    return CONTACT_T + forgiveness;
  }

  private updateRun(scaledDeltaMS: number): void {
    const wall = this.walls[this.wallIndex];
    this.runProgress += scaledDeltaMS / wall.approachDurationMs;
    this.distanceTraveled += scaledDeltaMS;

    if (this.runProgress >= this.verdictT(wall)) {
      if (this.runProgress > 1) this.runProgress = 1;
      this.resolveWall(wall);
    }
  }

  private resolveWall(wall: WallConfig): void {
    this.setState('WALL_RESOLVE');

    if (this.lane === wall.openLane) {
      this.events.onWallPass?.(this.wallIndex);
      this.wallIndex++;
      this.beginWall();
      return;
    }

    this.crashCount++;

    if (this.crashCount === 1) {
      this.events.onCrashShielded?.(this.wallIndex);
      this.triggerSlowMo(SLOWMO_SCALE, SLOWMO_HOLD_MS, SLOWMO_EASE_MS);
      this.setState('CRASH_RECOVER');
      return;
    }

    this.events.onCrashFatal?.(this.wallIndex);
    this.setState('FAIL_IMPACT');
  }

  /** Starts the breather before `wallIndex`, or ends the run when the walls are exhausted. */
  private beginWall(): void {
    this.runProgress = 0;

    if (this.wallIndex >= this.walls.length) {
      this.setState('FINISH_STRETCH');
      this.events.onFinish?.();
      return;
    }

    this.setState('WALL_GAP');
  }

  private setState(next: DirectorState): void {
    this.state = next;
    this.stateElapsedMs = 0;
    this.events.onStateChange?.(next);
  }
}
