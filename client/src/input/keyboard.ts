import { type DirectionSource, type Directions, NO_DIRECTIONS } from './axis';

const KEY_MAP: Record<string, keyof Directions> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** WASD ve ok tuşlarını yön olarak izler. `target` testlerde sahte olabilir. */
export class KeyboardSource implements DirectionSource {
  private pressed = new Set<string>();

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent, true));
    target.addEventListener('keyup', (e) => this.onKey(e as KeyboardEvent, false));
    // Sekme arka plana geçince basılı kalan tuşlar takılmasın.
    target.addEventListener('blur', () => this.pressed.clear());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!(e.code in KEY_MAP)) return;
    if (down) this.pressed.add(e.code);
    else this.pressed.delete(e.code);
  }

  getDirections(): Directions {
    const result = { ...NO_DIRECTIONS };
    for (const code of this.pressed) result[KEY_MAP[code]] = true;
    return result;
  }
}
