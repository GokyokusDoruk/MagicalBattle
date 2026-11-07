import { type DirectionSource, type Directions, NO_DIRECTIONS } from '../input/axis';

const BUTTONS: { dir: keyof Directions; label: string; cell: string }[] = [
  { dir: 'up', label: '▲', cell: 'col-start-2 row-start-1' },
  { dir: 'left', label: '◀', cell: 'col-start-1 row-start-2' },
  { dir: 'right', label: '▶', cell: 'col-start-3 row-start-2' },
  { dir: 'down', label: '▼', cell: 'col-start-2 row-start-3' },
];

/** Ekranda klasik 4 yönlü D-Pad. Çoklu dokunuşu destekler (iki yön aynı anda). */
export class DPad implements DirectionSource {
  readonly element: HTMLDivElement;
  private state: Directions = { ...NO_DIRECTIONS };

  constructor() {
    this.element = document.createElement('div');
    this.element.className =
      'fixed bottom-6 left-6 z-50 grid h-40 w-40 select-none grid-cols-3 grid-rows-3 gap-1 touch-none';
    this.element.hidden = true;

    for (const b of BUTTONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = b.label;
      button.setAttribute('aria-label', b.dir);
      button.className = `${b.cell} rounded-lg bg-white/15 text-xl text-amber-200 active:bg-white/35 touch-none`;
      this.bind(button, b.dir);
      this.element.appendChild(button);
    }
  }

  private bind(button: HTMLButtonElement, dir: keyof Directions): void {
    const press = (e: PointerEvent): void => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      this.state[dir] = true;
    };
    const release = (): void => {
      this.state[dir] = false;
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
    if (!visible) this.state = { ...NO_DIRECTIONS };
  }

  getDirections(): Directions {
    return { ...this.state };
  }
}
