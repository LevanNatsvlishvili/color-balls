// Scripted demo pilot — drives lane changes so portfolio captures record
// themselves. Enabled only by the ?autoplay URL hook; never runs in a real ad.

import { verdictProgress, type GameDirector, type WallFlight } from './director';
import type { Lane } from './track';
import type { WallConfig } from './walls';

export interface AutopilotOptions {
  /**
   * Wall to deliberately fumble so the recording includes the shield shatter.
   * Negative (the default) plays flawlessly.
   */
  missWallIndex?: number;
  /**
   * Progress at which the pilot commits to a wall's lane. Waiting until the
   * wall is half-way reads as a dodge; reacting on spawn reads as a ball
   * parked in a lane, which is a duller recording.
   */
  reactAt?: number;
  /** Gap between swipes, so a two-lane move reads as two gestures. */
  swipeIntervalMs?: number;
}

export interface Autopilot {
  /** Call once per tick with the raw frame delta, BEFORE `director.update`. */
  update(deltaMS: number): void;
}

const REACT_AT = 0.5;
const SWIPE_INTERVAL_MS = 140;

interface Target {
  lane: Lane;
  msLeft: number;
}

export function createAutopilot(
  director: GameDirector,
  walls: readonly WallConfig[],
  options: AutopilotOptions = {},
): Autopilot {
  const missWallIndex = options.missWallIndex ?? -1;
  const reactAt = options.reactAt ?? REACT_AT;
  const swipeIntervalMs = options.swipeIntervalMs ?? SWIPE_INTERVAL_MS;
  let cooldownMs = 0;

  /** Nearest wall still awaiting a verdict, once it is close enough to react to. */
  function nearestPending(): WallFlight | undefined {
    let nearest: WallFlight | undefined;
    for (let i = 0; i < director.flights.length; i++) {
      const flight = director.flights[i];
      if (flight.mode !== 'approach' || flight.progress < reactAt) continue;
      if (!nearest || flight.progress > nearest.progress) nearest = flight;
    }
    return nearest;
  }

  function target(): Target | undefined {
    const flight = nearestPending();
    if (!flight) return undefined;
    const wall = walls[flight.index];
    if (!wall) return undefined;

    // Any closed lane fumbles the wall; lane 0 unless that is the open one.
    const lane: Lane = flight.index === missWallIndex
      ? (wall.openLane === 0 ? 1 : 0)
      : wall.openLane;

    // Deadline in game-time ms. During slow-mo the real deadline is further
    // out than this, which only makes the pilot swipe earlier than it needs to.
    return { lane, msLeft: (verdictProgress(wall) - flight.progress) * wall.approachDurationMs };
  }

  return {
    update(deltaMS: number): void {
      if (director.state !== 'RUN') return;
      cooldownMs -= deltaMS;

      const next = target();
      if (!next) return;

      const lanesToGo = Math.abs(next.lane - director.lane);
      if (lanesToGo === 0) return;

      // Pace the swipes, but drop the pacing the moment the remaining lanes no
      // longer fit before the verdict — a pretty gesture that misses is worse.
      if (cooldownMs > 0 && next.msLeft > lanesToGo * swipeIntervalMs) return;

      director.registerInput(next.lane > director.lane ? 1 : -1);
      cooldownMs = swipeIntervalMs;
    },
  };
}
