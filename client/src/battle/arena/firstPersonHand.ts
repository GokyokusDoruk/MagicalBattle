import * as THREE from 'three';
import type { Element } from '../damage/elements';
import { ELEMENT_COLORS } from './palette';
import { loadWandModel, type HeroGear } from './heroModel';
import { wandGeometry } from './wandModel';

const SKIN = 0xe9bf98;

/**
 * Faz 5: birinci kişi bakışta oyuncunun eli ve kuşanılı asası. Kameraya bağlıdır (kamera uzayında), ekranın sağ altından girer.
 * Çizerken parmağın/farenin olduğu yere doğru uzanır ve asa ucunu oraya çevirir; çizim hızlandıkça el sallanır, asa ucu parlar.
 * Kol, cüppe kolu (elementin renginde), avuç, kıvrık parmaklar ve başparmak; ucunda element küresi olan asa.
 */
export class FirstPersonHand {
  readonly group = new THREE.Group();
  private readonly arm = new THREE.Group();
  private readonly wand = new THREE.Group();
  private readonly orbMaterial: THREE.MeshStandardMaterial;
  private readonly sleeveMaterial: THREE.MeshStandardMaterial;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly orbLight = new THREE.PointLight(0xffffff, 0, 3, 2);
  private readonly rod: THREE.Mesh;
  private readonly orb: THREE.Mesh;
  private modelWand: { object: THREE.Object3D; dispose: () => void } | null = null;
  private gearKey = '';
  /** Hedef ve mevcut nişan (ekran koordinatı, -1..1) */
  private readonly aimTarget = new THREE.Vector2(0.25, -0.1);
  private readonly aim = new THREE.Vector2(0.25, -0.1);
  private drawing = false;
  private swing = 0;
  private time = 0;
  private shown = 0;
  private visible = false;
  private disposed = false;

  constructor() {
    const skin = this.mat(new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.75 }));
    this.sleeveMaterial = this.mat(new THREE.MeshStandardMaterial({ color: 0x3a3f9e, roughness: 0.9 }));
    const cuff = this.mat(new THREE.MeshStandardMaterial({ color: 0xd7b66d, roughness: 0.5, metalness: 0.4 }));
    const wood = this.mat(new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.65 }));
    this.orbMaterial = this.mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.2 }));

    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh => {
      this.disposables.push(geo);
      return new THREE.Mesh(geo, m);
    };

    // Ön kol ve cüppe kolu (kameraya doğru genişleyen)
    const sleeve = mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.62, 14, 1, true), this.sleeveMaterial);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, -0.02, 0.36);
    const sleeveEnd = mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 16), cuff);
    sleeveEnd.position.set(0, -0.02, 0.05);
    const wrist = mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 12), skin);
    wrist.rotation.x = Math.PI / 2;
    wrist.position.set(0, -0.02, 0.0);

    // Avuç ve asayı kavrayan parmaklar
    const palm = mesh(new THREE.SphereGeometry(0.07, 16, 12), skin);
    palm.scale.set(1, 0.75, 1.15);
    palm.position.set(0, 0, -0.08);
    const fingers: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const f = mesh(new THREE.TorusGeometry(0.034, 0.016, 8, 12, Math.PI * 1.25), skin);
      f.position.set(-0.012, 0.03 - i * 0.026, -0.11);
      f.rotation.set(0, Math.PI / 2, -0.4);
      fingers.push(f);
    }
    const thumb = mesh(new THREE.CapsuleGeometry(0.017, 0.06, 4, 8), skin);
    thumb.position.set(0.045, 0.05, -0.1);
    thumb.rotation.set(0.3, 0, -0.9);

    // Asa: elin içinden yukarı-ileri uzanır, ucunda element küresi
    const rod = (this.rod = new THREE.Mesh(wandGeometry(), wood));
    rod.scale.setScalar(0.2);
    rod.position.y = -0.15;
    const orb = (this.orb = mesh(new THREE.SphereGeometry(0.026, 16, 12), this.orbMaterial));
    orb.position.y = -0.15 + 2.5 * 0.2 + 0.02;
    this.orbLight.position.copy(orb.position);
    this.wand.add(rod, orb, this.orbLight);
    this.wand.position.set(-0.012, 0, -0.1);
    this.wand.rotation.set(-0.55, 0, 0.12);

    this.arm.add(sleeve, sleeveEnd, wrist, palm, ...fingers, thumb, this.wand);
    this.group.add(this.arm);
    this.group.visible = false;
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.disposables.push(m);
    return m;
  }

  /** Elin elementini ayarlar: cüppe kolu ve asa küresi o renge döner. */
  setElement(element: Element): void {
    const c = ELEMENT_COLORS[element];
    this.sleeveMaterial.color.setHex(c.main).multiplyScalar(0.8);
    this.orbMaterial.color.setHex(c.glow);
    this.orbMaterial.emissive.setHex(c.glow);
    this.orbLight.color.setHex(c.glow);
  }

  /**
   * Faz 7: kuşanılı ekipman. Asa, karakterin kendi asa modeli olur (Sıradan-Nadir değnek, Destansı ve üstü büyük asa);
   * cüppe kolu cüppenin elementinin renginde. Model yüklenemezse basit asa kalır.
   */
  setGear(gear: HeroGear | undefined): void {
    if (gear?.robe) this.sleeveMaterial.color.setHex(ELEMENT_COLORS[gear.robe.element].main).multiplyScalar(0.8);
    const w = gear?.wand;
    const key = w ? `${w.element}:${w.rarity}` : '';
    if (key === this.gearKey) return;
    this.gearKey = key;
    this.clearModelWand();
    if (!w) return;
    const length = w.rarity >= 4 ? 0.56 : 0.46;
    void loadWandModel(w, length)
      .then((model) => {
        if (this.gearKey !== key || this.disposed) return model.dispose();
        this.modelWand = model;
        this.wand.add(model.object);
        this.rod.visible = false;
        this.orb.position.y = model.tipY + 0.015;
        this.orb.scale.setScalar(w.rarity >= 4 ? 1.5 : 1);
        this.orbLight.position.copy(this.orb.position);
      })
      .catch(() => undefined);
  }

  private clearModelWand(): void {
    if (this.modelWand) {
      this.wand.remove(this.modelWand.object);
      this.modelWand.dispose();
      this.modelWand = null;
    }
    this.rod.visible = true;
    this.orb.position.y = -0.15 + 2.5 * 0.2 + 0.02;
    this.orb.scale.setScalar(1);
    this.orbLight.position.copy(this.orb.position);
  }

  show(on: boolean): void {
    this.visible = on;
    if (on) this.group.visible = true;
  }

  /** Nişan: ekran koordinatı (-1 sol/alt, 1 sağ/üst). `down` çizim sürüyor mu. */
  setAim(nx: number, ny: number, down: boolean): void {
    const prev = this.aimTarget.clone();
    this.aimTarget.set(THREE.MathUtils.clamp(nx, -1, 1), THREE.MathUtils.clamp(ny, -1, 1));
    if (down) this.swing = Math.min(1, this.swing + prev.distanceTo(this.aimTarget) * 3);
    this.drawing = down;
  }

  /**
   * `aspect`: kameranın en/boy oranı, `fovDeg`: dikey görüş açısı. El, ekranın sağ altına oranla yerleşir;
   * dar (dikey telefon) ekranda da görünür kalır ve biraz küçülür.
   */
  update(dt: number, aspect = 1.6, fovDeg = 48): void {
    this.time += dt;
    this.shown = THREE.MathUtils.clamp(this.shown + (this.visible ? dt / 0.35 : -dt / 0.25), 0, 1);
    if (this.shown === 0 && !this.visible) {
      this.group.visible = false;
      return;
    }
    const k = 1 - Math.exp(-(this.drawing ? 14 : 6) * dt);
    this.aim.lerp(this.aimTarget, k);
    this.swing *= Math.exp(-4 * dt);
    const ease = 1 - Math.pow(1 - this.shown, 3);
    // Sağ alttan içeri; nişana doğru uzanır (el ekranda nişanın sağ altında kalır, asa ucu nişana bakar)
    const halfW = 0.62 * Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * aspect;
    const size = THREE.MathUtils.clamp(aspect * 0.95, 0.62, 1);
    this.group.scale.setScalar(size);
    const x = halfW * (0.55 + this.aim.x * 0.35);
    const y = -0.3 + (1 - size) * 0.25 + this.aim.y * 0.14 - (1 - ease) * 0.5;
    const bob = Math.sin(this.time * 2.2) * 0.008 + Math.sin(this.time * 17) * 0.012 * this.swing;
    this.group.position.set(x, y + bob, -0.62);
    this.group.rotation.set(0.25 + this.aim.y * 0.35, -0.35 - this.aim.x * 0.45, 0.18 + this.swing * 0.12 * Math.sin(this.time * 11));
    const glow = 1.2 + (this.drawing ? 1.8 : 0) + this.swing * 1.5 + Math.sin(this.time * 6) * 0.2;
    this.orbMaterial.emissiveIntensity = glow;
    this.orbLight.intensity = glow * 0.6;
  }

  dispose(): void {
    this.disposed = true;
    this.clearModelWand();
    this.disposables.forEach((d) => d.dispose());
  }
}
