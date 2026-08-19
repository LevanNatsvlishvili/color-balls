// GameDirector state machine, wall pacing, and crash outcomes.

import gsap from 'gsap';
import type { Lane } from './track';
import type { WallConfig } from './walls';

export type DirectorState =
  | 'INTRO'
  | 'RUN'
  | 'FAIL_IMPACT'
  | 'FINISH_STRETCH'
  | 'CELEBRATE'
  | 'CTA';

export type WallFlightMode = 'approach' | 'cracked' | 'impact';

export interface WallFlight {
  index: number;
  progress: number;
  mode: WallFlightMode;
  recoverMs: number;
}

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
  /** Nearest in-flight wall (highest progress). */
  wallIndex = 0;
  /** 0..1 progress of the nearest in-flight wall. */
  runProgress = 0;
  /** Monotonic, never resets — drives track/chevron scroll. */
  distanceTraveled = 0;
  /** Scales gameplay-only delta time. State timers and cosmetic GSAP tweens are unaffected. */
  gameTimeScale = 1;
  lane: Lane = 0;
  crashCount = 0;
  /** Live walls on the track. Mutated in place — do not hold across frames. */
  readonly flights: WallFlight[] = [];

  private readonly walls: readonly WallConfig[];
  private readonly events: DirectorEvents;
  private stateElapsedMs = 0;
  private nextSpawnIndex = 0;
  private msSinceLastSpawn = 0;
  private resolvedCount = 0;

  constructor(walls: readonly WallConfig[], events: DirectorEvents = {}) {
    this.walls = walls;
    this.events = events;
  }

  get hasShield(): boolean {
    return this.crashCount === 0;
  }

  /**
   * Visual speed vs wall 1. Chevrons and the trail sample this so later walls
   * don't just arrive sooner — the road itself reads faster.
   */
  get speedScale(): number {
    const baseline = this.walls[0]?.approachDurationMs ?? 2000;
    const index = Math.min(this.wallIndex, this.walls.length - 1);
    const wall = this.walls[index];
    if (!wall) return 1;
    return baseline / wall.approachDurationMs;
  }

  /** Call once per tick with the raw (unscaled) frame delta. */
  update(deltaMS: number): void {
    this.stateElapsedMs += deltaMS;

    // State timers run on raw time; only world motion is scaled. Otherwise the
    // 0.4s slow-mo beat would stretch to a full second of wall-clock.
    const scaledDeltaMS = deltaMS * this.gameTimeScale;

    switch (this.state) {
      case 'INTRO':
        if (this.stateElapsedMs >= INTRO_DURATION_MS) {
          this.setState('RUN');
          this.spawnWall();
        }
        break;
      case 'RUN':
        this.updateRun(scaledDeltaMS, deltaMS);
        break;
      case 'FAIL_IMPACT':
        if (this.stateElapsedMs >= FAIL_IMPACT_DURATION_MS) this.setState('CTA');
        break;
      case 'FINISH_STRETCH':
        this.distanceTraveled += scaledDeltaMS * this.speedScale;
        if (this.stateElapsedMs >= FINISH_STRETCH_DURATION_MS) {
          this.setState('CELEBRATE');
          this.events.onCelebrate?.();
        }
        break;
      case 'CELEBRATE':
        this.distanceTraveled += scaledDeltaMS * this.speedScale;
        if (this.stateElapsedMs >= CELEBRATE_DURATION_MS) this.setState('CTA');
        break;
      case 'CTA':
        break;
    }

    this.syncNearest();
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

  private spawnWall(): void {
    if (this.nextSpawnIndex >= this.walls.length) return;
    this.flights.push({
      index: this.nextSpawnIndex,
      progress: 0,
      mode: 'approach',
      recoverMs: 0,
    });
    this.nextSpawnIndex++;
  }

  private updateRun(scaledDeltaMS: number, rawDeltaMS: number): void {
    this.distanceTraveled += scaledDeltaMS * this.speedScale;
    this.maybeSpawn(scaledDeltaMS);

    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i];
      if (flight.mode === 'impact') continue;

      if (flight.mode === 'cracked') {
        flight.recoverMs += rawDeltaMS;
        if (flight.recoverMs >= CRASH_RECOVER_DURATION_MS) {
          this.flights.splice(i, 1);
          this.resolvedCount++;
          this.maybeFinish();
        }
        continue;
      }

      const wall = this.walls[flight.index];
      flight.progress += scaledDeltaMS / wall.approachDurationMs;
      if (flight.progress >= this.verdictT(wall)) {
        if (flight.progress > 1) flight.progress = 1;
        this.resolveFlight(flight, i);
      }
    }
  }

  /**
   * Insert the next wall `spacingMs` after the previous one was inserted —
   * not after it was passed. Several walls can be on the track at once.
   */
  private maybeSpawn(scaledDeltaMS: number): void {
    if (this.nextSpawnIndex >= this.walls.length || this.nextSpawnIndex === 0) return;
    this.msSinceLastSpawn += scaledDeltaMS;
    while (this.nextSpawnIndex < this.walls.length) {
      const delay = this.walls[this.nextSpawnIndex - 1].spacingMs;
      if (this.msSinceLastSpawn < delay) break;
      this.msSinceLastSpawn -= delay;
      this.spawnWall();
    }
  }

  private resolveFlight(flight: WallFlight, flightIndex: number): void {
    const wall = this.walls[flight.index];

    if (this.lane === wall.openLane) {
      this.events.onWallPass?.(flight.index);
      this.flights.splice(flightIndex, 1);
      this.resolvedCount++;
      this.maybeFinish();
      return;
    }

    this.crashCount++;

    if (this.crashCount === 1) {
      flight.mode = 'cracked';
      flight.recoverMs = 0;
      this.events.onCrashShielded?.(flight.index);
      this.triggerSlowMo(SLOWMO_SCALE, SLOWMO_HOLD_MS, SLOWMO_EASE_MS);
      return;
    }

    flight.mode = 'impact';
    this.events.onCrashFatal?.(flight.index);
    this.setState('FAIL_IMPACT');
  }

  private maybeFinish(): void {
    if (this.state !== 'RUN') return;
    if (this.resolvedCount < this.walls.length) return;
    this.flights.length = 0;
    this.setState('FINISH_STRETCH');
    this.events.onFinish?.();
  }

  private syncNearest(): void {
    let nearest: WallFlight | undefined;
    for (let i = 0; i < this.flights.length; i++) {
      const flight = this.flights[i];
      if (!nearest || flight.progress > nearest.progress) nearest = flight;
    }
    if (nearest) {
      this.wallIndex = nearest.index;
      this.runProgress = nearest.progress;
    } else if (this.nextSpawnIndex > 0) {
      this.wallIndex = Math.min(this.nextSpawnIndex, this.walls.length) - 1;
    }
  }

  private setState(next: DirectorState): void {
    this.state = next;
    this.stateElapsedMs = 0;
    this.events.onStateChange?.(next);
  }
}
