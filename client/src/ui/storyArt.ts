/**
 * Sahne resimleri koda çizilmiş SVG'lerdir (telifsiz). Hepsi 800x450 görünüm kutusunda.
 * Anahtarlar `docs/hikaye.md` ve `world/locations.ts` içindeki konum kimlikleriyle aynıdır.
 */

interface Palette {
  skyTop: string;
  skyBottom: string;
  ground: string;
}

const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 197) % 800,
  y: (i * 83) % 220,
  r: 0.8 + ((i * 7) % 3) * 0.5,
}));

function frame(p: Palette, scenery: string, stars = false): string {
  const starMarkup = stars
    ? STARS.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#fff" opacity="0.7"/>`).join('')
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" role="img">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.skyTop}"/><stop offset="1" stop-color="${p.skyBottom}"/>
    </linearGradient></defs>
    <rect width="800" height="450" fill="url(#sky)"/>${starMarkup}${scenery}
    <rect y="330" width="800" height="120" fill="${p.ground}"/>
  </svg>`;
}

const tower = (x: number, w: number, h: number, fill: string): string =>
  `<rect x="${x}" y="${330 - h}" width="${w}" height="${h}" fill="${fill}"/>` +
  `<polygon points="${x - 6},${330 - h} ${x + w / 2},${330 - h - 34} ${x + w + 6},${330 - h}" fill="${fill}"/>`;

const ART: Record<string, string> = {
  ignis: frame(
    { skyTop: '#2a0d0d', skyBottom: '#e8571f', ground: '#1a0a0a' },
    `<circle cx="600" cy="250" r="90" fill="#ffb347" opacity="0.5"/>
     <rect x="120" y="230" width="560" height="100" fill="#2b1b1b"/>
     ${tower(100, 60, 170, '#2b1b1b')}${tower(640, 60, 170, '#2b1b1b')}${tower(370, 60, 200, '#2b1b1b')}
     <rect x="355" y="270" width="90" height="60" fill="#120808"/>
     <path d="M0 330 Q200 300 400 330 T800 330 V360 H0Z" fill="#ff5a1f" opacity="0.85"/>`,
  ),
  ash: frame(
    { skyTop: '#4a4543', skyBottom: '#b59a86', ground: '#5a4a40' },
    `<polygon points="0,330 0,120 140,170 200,330" fill="#3b312c"/>
     <polygon points="800,330 800,100 650,170 590,330" fill="#3b312c"/>
     <polygon points="280,330 330,290 380,330" fill="#6b5546"/><polygon points="400,330 460,280 520,330" fill="#6b5546"/>
     <path d="M0 90 Q200 60 400 100 T800 80" stroke="#e6d5c8" stroke-width="3" fill="none" opacity="0.5"/>
     <path d="M0 130 Q200 100 400 140 T800 120" stroke="#e6d5c8" stroke-width="2" fill="none" opacity="0.4"/>`,
  ),
  abyss: frame(
    { skyTop: '#0b1033', skyBottom: '#3b4fa8', ground: '#111a44' },
    `<rect x="160" y="150" width="480" height="30" fill="#8e9ad6"/>
     ${[200, 290, 380, 470, 560].map((x) => `<rect x="${x}" y="180" width="26" height="150" fill="#aab4e8"/>`).join('')}
     <polygon points="140,150 400,80 660,150" fill="#8e9ad6"/>
     <ellipse cx="400" cy="330" rx="170" ry="16" fill="#6fe3ff" opacity="0.45"/>`,
    true,
  ),
  vine: frame(
    { skyTop: '#16301f', skyBottom: '#6aa860', ground: '#1f3d24' },
    `<rect x="80" y="180" width="640" height="150" fill="#59644f"/>
     <path d="M300 330 V250 Q400 170 500 250 V330Z" fill="#101a12"/>
     ${[110, 230, 560, 660].map((x) => `<path d="M${x} 180 Q${x + 20} 250 ${x - 10} 330" stroke="#3fa34d" stroke-width="10" fill="none"/>`).join('')}
     ${[140, 260, 590, 690].map((x) => `<circle cx="${x}" cy="250" r="9" fill="#7be07f"/>`).join('')}`,
  ),
  'stone-heart': frame(
    { skyTop: '#2a2b30', skyBottom: '#7a7d86', ground: '#3a3b40' },
    `<rect x="170" y="140" width="460" height="190" fill="#5a5c64"/>
     ${tower(140, 70, 260, '#4b4d55')}${tower(590, 70, 260, '#4b4d55')}
     <rect x="360" y="230" width="80" height="100" fill="#15161a"/>
     <path d="M300 140 L320 200 L295 250 L330 330" stroke="#1d1e22" stroke-width="5" fill="none"/>
     <circle cx="400" cy="190" r="22" fill="#ff5a5a" opacity="0.8"/>`,
  ),
  marsh: frame(
    { skyTop: '#0f2b2b', skyBottom: '#7fb5ab', ground: '#1d3a34' },
    `<ellipse cx="400" cy="320" rx="420" ry="40" fill="#cfe9e2" opacity="0.35"/>
     ${[90, 180, 270, 520, 610, 700].map((x) => `<path d="M${x} 330 Q${x + 6} 270 ${x + 2} 230" stroke="#2c5a4c" stroke-width="5" fill="none"/>`).join('')}
     <circle cx="330" cy="270" r="9" fill="#e9ff9b"/><circle cx="470" cy="290" r="7" fill="#e9ff9b"/><circle cx="410" cy="240" r="6" fill="#e9ff9b"/>`,
  ),
  'still-crystal': frame(
    { skyTop: '#06203f', skyBottom: '#2e8fd0', ground: '#0a2c52' },
    `${[140, 260, 380, 500, 620].map((x, i) => `<polygon points="${x},330 ${x + 30},${180 - i * 14} ${x + 60},330" fill="#8de8ff" opacity="0.85"/>`).join('')}
     <polygon points="360,330 400,110 440,330" fill="#c8f4ff"/>
     <path d="M0 330 Q100 310 200 330 T400 330 T600 330 T800 330" stroke="#bff3ff" stroke-width="3" fill="none" opacity="0.6"/>`,
  ),
  'witch-pass': frame(
    { skyTop: '#0b0614', skyBottom: '#4a2a6a', ground: '#150b22' },
    `<circle cx="640" cy="100" r="46" fill="#f3e9ff" opacity="0.9"/>
     <polygon points="0,330 0,140 170,230 250,330" fill="#1c1030"/>
     <polygon points="800,330 800,120 630,230 550,330" fill="#1c1030"/>
     <ellipse cx="400" cy="320" rx="150" ry="26" fill="none" stroke="#b678ff" stroke-width="5"/>
     <ellipse cx="400" cy="320" rx="110" ry="18" fill="#2a1646"/>
     <path d="M0 350 Q200 320 400 350 T800 350" stroke="#cdb5ee" stroke-width="3" fill="none" opacity="0.35"/>`,
    true,
  ),
};

export const ART_KEYS = Object.keys(ART);

/** Sahne resmini SVG metni olarak döndürür. Bilinmeyen anahtarda hata verir. */
export function createSceneArt(key: string): string {
  const art = ART[key];
  if (!art) throw new Error(`Bilinmeyen sahne resmi: ${key}`);
  // Aynı sayfada birden çok SVG olursa gradyan kimlikleri çakışmasın (gizli bir SVG'nin gradyanı
  // diğerini bozabilir). Her resme kendi kimliğini ver.
  return art.replaceAll('id="sky"', `id="sky-${key}"`).replaceAll('url(#sky)', `url(#sky-${key})`);
}
