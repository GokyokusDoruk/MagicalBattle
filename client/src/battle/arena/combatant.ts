import { wandGeometry } from './wandModel';
import * as THREE from 'three';
import type { Element } from '../damage/elements';
import { ELEMENT_COLORS } from './palette';
import { createWizard, type WizardClip, type WizardInstance } from './wizardModel';

const SKIN = 0xf0c8a0;
const FLASH = new THREE.Color(0xffffff);

/**
 * Düşük poligonlu büyücü: cüppe, kafa, şapka ve ucunda element küresi olan asa.
 * Hepsi koda çizilir. Animasyonlar (bekleme, büyü, savunma, vuruş, yenilgi) zamanla `update` ile ilerler.
 */
export class Combatant {
  /** Arenadaki yeri ve yönü bu grup üzerinden verilir */
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly staff = new THREE.Group();
  private readonly orbMaterial: THREE.MeshLambertMaterial;
  private readonly flashMaterials: THREE.MeshLambertMaterial[] = [];
  private readonly baseColors: THREE.Color[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  private time = Math.random() * 10;
  private castLeft = 0;
  private castTotal = 1;
  private defendLeft = 0;
  private hitLeft = 0;
  private hitStrength = 0;
  private defeatedAmount = 0;
  private defeated = false;
  /** Faz 5: yenilgi biçimi: yana yığılma ya da vuruşla arkaya düşüp yere serilme */
  private fallStyle: 'collapse' | 'backward' = 'collapse';
  /** Gerçek büyücü modeli (Quaternius Wizard, CC0); yüklenene kadar ya da yüklenemezse basit büyücü görünür */
  private model: WizardInstance | null = null;
  private clip: WizardClip | null = null;
  private hidden = false;
  private disposed = false;

  constructor(
    readonly name: string,
    readonly element: Element,
  ) {
    const colors = ELEMENT_COLORS[element];
    const cloak = this.material(colors.main, 0.12);
    const trim = this.material(new THREE.Color(colors.main).multiplyScalar(0.55).getHex(), 0.05);
    const skin = this.material(SKIN, 0.4);
    const wood = this.material(0xb07a42, 0.12);
    this.orbMaterial = this.material(colors.glow, 0.9);

    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
      this.disposables.push(geo);
      return new THREE.Mesh(geo, mat);
    };

    const robe = mesh(new THREE.ConeGeometry(0.78, 1.9, 8), cloak);
    robe.position.y = 0.95;
    const sash = mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.14, 8), trim);
    sash.position.y = 1.25;
    const head = mesh(new THREE.SphereGeometry(0.32, 8, 6), skin);
    head.position.y = 2.15;
    const hat = mesh(new THREE.ConeGeometry(0.46, 0.95, 8), trim);
    hat.position.y = 2.82;
    hat.rotation.z = 0.12;
    const brim = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 10), trim);
    brim.position.y = 2.42;

    // Gerçek asa modeli (paylaşılan geometri, atılmaz); ucunda element küresi parlar
    const rod = new THREE.Mesh(wandGeometry(), wood);
    const orb = mesh(new THREE.SphereGeometry(0.15, 8, 6), this.orbMaterial);
    orb.position.y = 2.62;
    this.staff.add(rod, orb);
    this.staff.position.set(0.72, 0, 0.25);

    // Ayak halkası: element renginde zemin işareti
    const ring = mesh(
      new THREE.RingGeometry(0.85, 1.05, 24),
      new THREE.MeshBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.disposables.push(ring.material as THREE.Material);

    this.body.add(robe, sash, head, hat, brim, this.staff);
    this.group.add(this.body, ring);

    // Gerçek modeli arkada yükle; gelince basit büyücünün yerini alır
    void createWizard(element)
      .then((m) => {
        if (this.disposed) {
          m.dispose();
          return;
        }
        this.model = m;
        this.body.visible = false;
        m.root.visible = !this.hidden;
        this.group.add(m.root);
        this.playClip(this.defeated ? 'death' : 'idle', 0);
      })
      .catch(() => {
        // Model yüklenemedi (ağ): basit büyücüyle devam
      });
  }

  /** Modelde bir animasyona yumuşak geçiş. Tek seferlik olanlar (büyü, darbe, ölüm) baştan oynar. */
  private playClip(clip: WizardClip, fade = 0.2): void {
    const m = this.model;
    if (!m) return;
    const next = m.actions.get(clip);
    if (!next) return;
    const prev = this.clip ? m.actions.get(this.clip) : undefined;
    if (this.clip === clip && clip !== 'cast' && clip !== 'hit') return;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (prev && prev !== next) next.crossFadeFrom(prev, fade, false);
    next.play();
    this.clip = clip;
  }

  /** Vuruş parlaması için renkleri izlenen yarı parlak malzeme. */
  private material(color: number, emissive: number): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    m.emissive = new THREE.Color(color).multiplyScalar(emissive);
    this.flashMaterials.push(m);
    this.baseColors.push(m.emissive.clone());
    this.disposables.push(m);
    return m;
  }

  /** Büyü çekme hareketi: asa yukarı kalkar, orb parlar. */
  cast(durationSec = 1.3): void {
    this.castTotal = durationSec;
    this.castLeft = durationSec;
    if (!this.defeated) this.playClip('cast', 0.12);
  }

  /** Savunma duruşu: geriye yaslanır, asayı öne uzatır. */
  defend(durationSec = 2): void {
    this.defendLeft = durationSec;
  }

  endDefend(): void {
    this.defendLeft = 0;
  }

  /** Vuruş tepkisi: beyaz parlama, geri savrulma. `strength` 0-1. */
  hit(strength: number): void {
    this.hitStrength = Math.min(1, Math.max(0.15, strength));
    this.hitLeft = 0.5;
    if (!this.defeated) this.playClip('hit', 0.08);
  }

  /** Yenilgi: `backward` ise vuruşun etkisiyle arkaya devrilip sırtüstü yere yığılır (son büyü), aksi halde yana çöker. */
  defeat(style: 'collapse' | 'backward' = 'collapse'): void {
    this.defeated = true;
    this.fallStyle = style;
    this.playClip('death', 0.1);
  }

  /** Birinci kişi bakışta kendi gövden kameranın önünü kapatmasın diye gizlenir. */
  setVisible(visible: boolean): void {
    this.hidden = !visible;
    if (this.model) this.model.root.visible = visible;
    else this.body.visible = visible;
  }

  reset(): void {
    this.defeated = false;
    this.defeatedAmount = 0;
    this.fallStyle = 'collapse';
    this.hidden = false;
    this.body.visible = !this.model;
    if (this.model) {
      this.model.root.visible = true;
      this.clip = null;
      this.model.mixer.stopAllAction();
      this.playClip('idle', 0);
    }
    this.castLeft = this.defendLeft = this.hitLeft = 0;
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.model) this.updateModel(dt);
    this.castLeft = Math.max(0, this.castLeft - dt);
    this.defendLeft = Math.max(0, this.defendLeft - dt);
    this.hitLeft = Math.max(0, this.hitLeft - dt);
    this.defeatedAmount = THREE.MathUtils.clamp(this.defeatedAmount + (this.defeated ? dt / (this.fallStyle === 'backward' ? 0.95 : 0.8) : -dt / 0.4), 0, 1);

    // Bekleme: hafif süzülme
    let y = Math.sin(this.time * 2) * 0.06;
    let lean = 0;
    let staffZ = 0;
    let staffX = 0;
    let orbGlow = 0.9;

    if (this.castLeft > 0) {
      const p = 1 - this.castLeft / this.castTotal; // 0→1
      const bump = Math.sin(Math.min(1, p) * Math.PI); // yukarı kalk, geri in
      staffZ = -bump * 1.0;
      staffX = bump * 0.25;
      lean = bump * 0.18;
      y += bump * 0.12;
      orbGlow = 0.9 + bump * 2.2;
    }
    if (this.defendLeft > 0) {
      lean -= 0.22;
      staffX = 0.9;
      staffZ = 0.15;
      orbGlow = 2.2;
    }

    let knock = 0;
    let flash = 0;
    if (this.hitLeft > 0) {
      const k = this.hitLeft / 0.5;
      knock = k * 0.7 * this.hitStrength;
      flash = k * this.hitStrength;
      lean -= k * 0.3 * this.hitStrength;
    }

    const f = this.defeatedAmount;
    if (this.fallStyle === 'backward') {
      // Arkaya devrilme: önce geriye savrulur, sonra sırtüstü yere serilir (kolay başlayıp hızlanan düşüş)
      const fall = f * f;
      this.body.position.set(0, y * (1 - f) - fall * 0.35, -knock - f * 1.1);
      this.body.rotation.set(lean - fall * (Math.PI / 2.05), 0, f * 0.08);
    } else {
      this.body.position.set(0, y - f * 0.45, -knock);
      this.body.rotation.set(lean + f * 0.4, 0, f * (Math.PI / 2.2));
    }
    this.staff.rotation.set(staffX, 0, staffZ);
    this.orbMaterial.emissive.set(ELEMENT_COLORS[this.element].glow).multiplyScalar(orbGlow);

    this.flashMaterials.forEach((m, i) => {
      if (m === this.orbMaterial) return;
      m.emissive.copy(this.baseColors[i]).lerp(FLASH, flash * 0.8);
    });
  }

  /** Modelin animasyon durumu: bitmiş tek seferlik animasyondan sonra savunma ya da bekleme duruşuna döner; vuruşta geri savrulur ve parlar. */
  private updateModel(dt: number): void {
    const m = this.model!;
    m.mixer.update(dt);
    if (!this.defeated) {
      const oneShot = this.clip === 'cast' || this.clip === 'hit';
      const running = oneShot && m.actions.get(this.clip!)!.isRunning();
      if (!running) this.playClip(this.defendLeft > 0 ? 'guard' : 'idle', 0.25);
    }
    const k = this.hitLeft > 0 ? this.hitLeft / 0.5 : 0;
    const back = this.defeated && this.fallStyle === 'backward' ? -Math.min(1, this.defeatedAmount) * 0.6 : 0;
    m.root.position.set(0, 0, -k * 0.5 * this.hitStrength + back);
    const flash = 0.35 + k * this.hitStrength * 0.9;
    m.root.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (mat && 'emissive' in mat) mat.emissive.setScalar(flash);
    });
  }

  dispose(): void {
    this.disposed = true;
    this.model?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
