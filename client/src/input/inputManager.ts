import { type Axis, type DirectionSource, axisFromDirections, mergeDirections } from './axis';

/** Klavye ve D-Pad gibi kaynakları tek bir hareket eksenine birleştirir. */
export class InputManager {
  constructor(private readonly sources: DirectionSource[]) {}

  getAxis(): Axis {
    return axisFromDirections(mergeDirections(this.sources.map((s) => s.getDirections())));
  }
}
