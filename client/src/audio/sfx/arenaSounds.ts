import type { ArenaSounds } from '../../battle/arena/sounds';
import type { SoundEngine } from './engine';

/** Arena olaylarını ses motoruna çevirir. */
export function createArenaSounds(engine: SoundEngine): ArenaSounds {
  return {
    charge: (element) => engine.play('charge', { element }),
    launch: (element) => engine.play('launch', { element }),
    impact: (element, intensity, head) => {
      engine.play('impact', { element, intensity });
      if (head) engine.play('crit');
    },
    shieldUp: () => engine.play('shieldUp'),
    shieldBlock: (ratio) => engine.play('shieldBlock', { intensity: ratio }),
    shieldBreak: () => engine.play('shieldBreak'),
    fizzle: () => engine.play('fizzle'),
    defeat: () => engine.play('defeat'),
  };
}
