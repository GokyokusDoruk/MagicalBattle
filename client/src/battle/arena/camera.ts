import * as THREE from 'three';

export interface Shot {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

/** Kareden bağımsız yumuşatma katsayısı: büyüdükçe hedefe daha hızlı yaklaşılır. */
export const dampFactor = (lambda: number, dt: number): number => 1 - Math.exp(-lambda * dt);

/** Dikey (telefon) ekran: savaşçılar yan yana sığmaz, kamera düello ekseninin arkasına geçer. */
export function isPortrait(aspect: number): boolean {
  return Number.isFinite(aspect) && aspect > 0 && aspect < 0.9;
}

/**
 * Yatay ama dar ekranda (örn. kare) iki savaşçı da sığsın diye kamerayı uzaklaştırma çarpanı.
 * Geniş ekranda ve dikeyde 1 (dikeyde bunun yerine eksen çekimi kullanılır).
 */
export function viewDistanceScale(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0 || isPortrait(aspect)) return 1;
  return Math.min(1.6, Math.max(1, 1.23 / aspect));
}

const IDLE_LOOK = new THREE.Vector3(0, 1.7, 0);
const SHAKE_DECAY = 6;

/**
 * Dinamik kamera: boştayken arenayı yavaşça süzer, çekim verilince (büyü, takip, vuruş) oraya yumuşakça geçer,
 * vuruşta sarsılır. `setShot(null)` boşta haline döner.
 */
export class CameraDirector {
  private shot: Shot | null = null;
  private readonly pos = new THREE.Vector3(0, 6.5, 15);
  private readonly look = IDLE_LOOK.clone();
  private shakeAmount = 0;
  private distanceScale = 1;
  private portrait = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly rand: () => number = Math.random,
  ) {}

  setAspect(aspect: number): void {
    this.distanceScale = viewDistanceScale(aspect);
    this.portrait = isPortrait(aspect);
  }

  setShot(shot: Shot | null): void {
    this.shot = shot;
  }

  get hasShot(): boolean {
    return this.shot !== null;
  }

  /** Sarsıntı şiddeti (0-1). Daha büyük bir sarsıntı varsa onu korur. */
  shake(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, Math.min(1, Math.max(0, amount)));
  }

  get currentShake(): number {
    return this.shakeAmount;
  }

  private idleShot(time: number): Shot {
    if (this.portrait) {
      // Oyuncunun arkasından düelloya bakış: rakip uzakta, karşıda
      const sway = Math.sin(time * 0.22) * 2.2;
      return { position: new THREE.Vector3(-15.5, 5.6, sway), lookAt: new THREE.Vector3(2.5, 1.8, 0) };
    }
    const sway = Math.sin(time * 0.22) * 4.5;
    return { position: new THREE.Vector3(sway, 6.8, 15.5), lookAt: IDLE_LOOK };
  }

  update(dt: number, time: number): void {
    const target = this.shot ?? this.idleShot(time);
    // Mesafeyi bakılan noktadan uzaklaştırarak ölçekle
    const desired = target.lookAt.clone().add(target.position.clone().sub(target.lookAt).multiplyScalar(this.distanceScale));
    const k = dampFactor(this.shot ? 3.4 : 1.4, dt);
    this.pos.lerp(desired, k);
    this.look.lerp(target.lookAt, k);

    this.shakeAmount *= Math.exp(-SHAKE_DECAY * dt);
    if (this.shakeAmount < 0.001) this.shakeAmount = 0;
    const s = this.shakeAmount * 0.9;
    this.camera.position.set(
      this.pos.x + (this.rand() - 0.5) * s,
      this.pos.y + (this.rand() - 0.5) * s,
      this.pos.z + (this.rand() - 0.5) * s,
    );
    this.camera.lookAt(this.look);
  }
}
