// Gate entities, shatter on pass, and rigged pacing table.

import type { BallColor } from './ball';

export interface GateConfig {
  color: BallColor;
  /** Gate 3: any input within the assist window snaps to the correct color. */
  assist: boolean;
  /** Fraction of runProgress (0..1) at which the assist window opens. Only used when assist is true. */
  assistWindowStart: number;
  /** Gate 3: gate visually flashes as a hint. */
  hintFlash: boolean;
}
