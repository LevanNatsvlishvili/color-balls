// GameDirector state machine, run pacing, and idle assist watcher.

import gsap from 'gsap';
import type { BallColor } from './ball';
import type { GateConfig } from './gates';

export type DirectorState = 'INTRO' | 'RUN' | 'GATE_RESOLVE' | 'FINISH' | 'CTA';

export interface DirectorEvents {
  onStateChange?(state: DirectorState): void;
  onGatePass?(gateIndex: number): void;
  onFinish?(): void;
}

const IDLE_TIMEOUT_MS = 4000;
const INTRO_DURATION_MS = 600;
const GATE_APPROACH_DURATION_MS = 2200;
const FINISH_DURATION_MS = 1800;

export class GameDirector {
  state: DirectorState = 'INTRO';
  gateIndex = 0;
  /** 0..1 progress toward the current gate. Resets every gate. */
  runProgress = 0;
  /** Monotonic, never resets — drives track/chevron scroll. */
  distanceTraveled = 0;
  /** Scales gameplay-only delta time (RUN/track motion). Cosmetic GSAP tweens are unaffected. */
  gameTimeScale = 1;
  ballColor: BallColor;
  lastInputAt = 0;

  private readonly gates: readonly GateConfig[];
  private readonly events: DirectorEvents;
  private introElapsedMs = 0;
  private finishElapsedMs = 0;

  constructor(gates: readonly GateConfig[], initialBallColor: BallColor, events: DirectorEvents = {}) {
    this.gates = gates;
    this.ballColor = initialBallColor;
    this.events = events;
  }

  /** Call once per tick with the raw (unscaled) frame delta and current wall-clock time. */
  update(deltaMS: number, nowMS: number): void {
    this.checkIdleAssist(nowMS);

    switch (this.state) {
      case 'INTRO':
        this.introElapsedMs += deltaMS;
        if (this.introElapsedMs >= INTRO_DURATION_MS) {
          this.setState('RUN');
        }
        break;
      case 'RUN':
        this.updateRun(deltaMS * this.gameTimeScale);
        break;
      case 'GATE_RESOLVE':
        // Resolved synchronously inside updateRun -> resolveGate(); never sits here across frames.
        break;
      case 'FINISH':
        this.finishElapsedMs += deltaMS;
        if (this.finishElapsedMs >= FINISH_DURATION_MS) {
          this.setState('CTA');
        }
        break;
      case 'CTA':
        break;
    }
  }

  /** Raw gesture reported by input.ts, already resolved to a target color by the caller. */
  registerInput(color: BallColor, nowMS: number): void {
    this.lastInputAt = nowMS;
    if (this.state !== 'RUN') return;

    const gate = this.gates[this.gateIndex];
    if (gate.assist && this.runProgress >= gate.assistWindowStart) {
      this.ballColor = gate.color;
    } else {
      this.ballColor = color;
    }
  }

  /** Dips gameplay time scale for a near-miss slow-mo beat without touching gsap.globalTimeline. */
  triggerSlowMo(scale: number, holdMs: number, easeBackMs: number): void {
    gsap.killTweensOf(this);
    this.gameTimeScale = scale;
    gsap.to(this, { gameTimeScale: 1, duration: easeBackMs / 1000, delay: holdMs / 1000, ease: 'power1.out' });
  }

  private checkIdleAssist(nowMS: number): void {
    if (this.state !== 'RUN') return;
    if (nowMS - this.lastInputAt < IDLE_TIMEOUT_MS) return;

    const gate = this.gates[this.gateIndex];
    this.ballColor = gate.color;
    this.lastInputAt = nowMS;
  }

  private updateRun(scaledDeltaMS: number): void {
    this.runProgress += scaledDeltaMS / GATE_APPROACH_DURATION_MS;
    this.distanceTraveled += scaledDeltaMS;

    if (this.runProgress >= 1) {
      this.runProgress = 1;
      this.resolveGate();
    }
  }

  private resolveGate(): void {
    this.setState('GATE_RESOLVE');

    const gate = this.gates[this.gateIndex];
    if (this.ballColor !== gate.color) {
      // Defensive snap-correct: guarantees a pass even under an assist/idle timing race.
      this.ballColor = gate.color;
    }
    this.events.onGatePass?.(this.gateIndex);

    this.gateIndex++;
    this.runProgress = 0;

    if (this.gateIndex >= this.gates.length) {
      this.finishElapsedMs = 0;
      this.setState('FINISH');
      this.events.onFinish?.();
    } else {
      this.setState('RUN');
    }
  }

  private setState(next: DirectorState): void {
    this.state = next;
    this.events.onStateChange?.(next);
  }
}
