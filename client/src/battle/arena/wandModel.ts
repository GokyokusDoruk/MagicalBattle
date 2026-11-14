import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import wandObj from './models/wand.obj?raw';

/**
 * Asa modeli (düşük poligonlu OBJ, ~2000 köşe): ince gövde, alt ucunda topuz, üst ucunda süslü baş.
 * Geometri bir kez çözülür ve tüm savaşçılar paylaşır (bu yüzden savaşçı kapanırken atılmaz).
 */
export const WAND_LENGTH = 2.5;

let cached: THREE.BufferGeometry | null = null;

/** Boyu `WAND_LENGTH`, alt ucu y=0, gövdesi y ekseninde duran paylaşılan geometri. */
export function wandGeometry(): THREE.BufferGeometry {
  if (cached) return cached;
  const group = new OBJLoader().parse(wandObj);
  let geo: THREE.BufferGeometry | null = null;
  group.traverse((o) => {
    if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry.clone();
  });
  if (!geo) throw new Error('Asa modeli okunamadı');
  const g: THREE.BufferGeometry = geo;
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const s = WAND_LENGTH / (box.max.y - box.min.y);
  g.translate(-(box.max.x + box.min.x) / 2, -box.min.y, -(box.max.z + box.min.z) / 2);
  g.scale(s, s, s);
  g.computeVertexNormals();
  cached = g;
  return g;
}
