export interface Directions {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface Axis {
  /** -1 (sol) ile 1 (sağ) arası */
  x: number;
  /** -1 (yukarı) ile 1 (aşağı) arası */
  y: number;
}

export interface DirectionSource {
  getDirections(): Directions;
}

export const NO_DIRECTIONS: Directions = { up: false, down: false, left: false, right: false };

const DIAGONAL = Math.SQRT1_2;

/** Karşıt yönler birbirini iptal eder, çaprazda hız sabit kalır. */
export function axisFromDirections(d: Directions): Axis {
  const x = (d.right ? 1 : 0) - (d.left ? 1 : 0);
  const y = (d.down ? 1 : 0) - (d.up ? 1 : 0);
  if (x !== 0 && y !== 0) return { x: x * DIAGONAL, y: y * DIAGONAL };
  return { x, y };
}

export function mergeDirections(list: Directions[]): Directions {
  return {
    up: list.some((d) => d.up),
    down: list.some((d) => d.down),
    left: list.some((d) => d.left),
    right: list.some((d) => d.right),
  };
}
