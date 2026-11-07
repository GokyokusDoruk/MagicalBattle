import * as Phaser from 'phaser';
import type { Axis } from '../input/axis';
import { WorldScene } from './WorldScene';

export function bootWorld(parent: HTMLElement, getAxis: () => Axis): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#111426',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [new WorldScene(getAxis)],
  });
}
