import * as Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const { width, height } = this.scale;
    const star = this.add.star(width / 2, height / 2, 5, 18, 40, 0xd7b66d);
    this.add
      .text(width / 2, height - 24, 'Phaser hazır', { color: '#9aa0b8', fontSize: '14px' })
      .setOrigin(0.5);
    this.tweens.add({ targets: star, angle: 360, duration: 4000, repeat: -1 });
  }
}

export function bootWorld(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [BootScene],
  });
}
