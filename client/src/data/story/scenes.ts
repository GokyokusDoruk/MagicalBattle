import type { StoryScene } from '../../story/types';

/**
 * Her bölümün ana görev sahnesi. Şimdilik kısa giriş sahneleri; tam diyaloglar ve
 * ahlak seçimleri Task 18'de, boss savaşları Task 19'da eklenecek (docs/hikaye.md).
 */
export const CHAPTER_SCENES: Readonly<Record<number, StoryScene>> = {
  1: {
    id: 'b1-ignis',
    image: 'ignis',
    lines: [
      { speaker: 'Anlatıcı', text: "Ignis'in kara surları ufukta yükseliyordu. Kapılar, Gölge Hükümdarı'nın emriyle halka kapatılmıştı." },
      { speaker: 'Elysia', text: 'Kapılar kapalı. Ama işçi kampındaki isyan başladı. Lav bacalarına ulaşırsak sur ateşsiz kalır.' },
      { speaker: 'Anlatıcı', text: 'Bacaların basıncı bozuldu. Surun ateş savunması çöktü ve Ignis kapısı yavaşça açıldı.' },
    ],
  },
  2: {
    id: 'b2-ash',
    image: 'ash',
    lines: [
      { speaker: 'Anlatıcı', text: "Ash Kanyon'a erzak girmiyordu. Malakor'un askerleri kervan yolunu tutmuştu." },
      { speaker: 'Anlatıcı', text: 'Yaşlı demirci, beş aynı asayı birleştirip daha güçlüsünü yapmayı sana öğretti. Kervan yolu açıldı.' },
    ],
  },
  3: {
    id: 'b3-abyss',
    image: 'abyss',
    lines: [
      { speaker: 'Anlatıcı', text: 'Abyss Tapınağı, bulutların altında sessizce bekliyordu.' },
      { speaker: 'Elysia', text: 'Bu sefer yalnız değilsin. Rüzgâr benimle. Birlikte geçeriz.' },
      { speaker: 'Anlatıcı', text: 'Tapınak bekçisi yenildi. Abyss kapıları açıldı.' },
    ],
  },
  4: {
    id: 'b4-vine',
    image: 'vine',
    lines: [
      { speaker: 'Anlatıcı', text: "Vine Surları'nın soyluları Malakor'a borçluydu. Her birinin gizli bir sırrı vardı." },
      { speaker: 'Anlatıcı', text: 'Sırlar ortaya döküldü, soylular saf değiştirdi. Ama o gece Elysia yakalandı.' },
    ],
  },
  5: {
    id: 'b5-stone-heart',
    image: 'stone-heart',
    lines: [
      { speaker: 'Anlatıcı', text: 'Stone Heart Kalesi taştan bir yürek gibi atıyordu.' },
      { speaker: 'Kaelen', text: 'Kale yıkılmaz. Ne kadar uğraşırsan uğraş.' },
      { speaker: 'Anlatıcı', text: "Temeldeki taş çekirdekler sarsıldı. Kaelen düşerken Elysia'nın nerede tutulduğunu söyledi." },
    ],
  },
  6: {
    id: 'b6-marsh',
    image: 'marsh',
    lines: [
      { speaker: 'Anlatıcı', text: 'Sisli Bataklık, yutan bir sis perdesine gömülmüştü.' },
      { speaker: 'Morga', text: 'Önce beni geçeceksin, çırak. Sonra sana gizli yolu göstereceğim.' },
      { speaker: 'Anlatıcı', text: "Sis dağıldı. Morga yolu gösterdi: Still Crystal'a giden gizli geçit." },
    ],
  },
  7: {
    id: 'b7-still-crystal',
    image: 'still-crystal',
    lines: [
      { speaker: 'Anlatıcı', text: "Still Crystal'ın su altı zindanında Elysia zincirliydi." },
      { speaker: 'Morwenna', text: 'Ona bak. Artık senin değil, benim sözümü dinliyor.' },
      { speaker: 'Elysia', text: 'Sesin... tanıyorum. Beni duyuyorsan, çizmeye devam et!' },
      { speaker: 'Anlatıcı', text: 'Zihin kontrolü kırıldı. Elysia özgürdü ve Still Crystal kapıları açıldı.' },
    ],
  },
  8: {
    id: 'b8-witch-pass',
    image: 'witch-pass',
    lines: [
      { speaker: 'Anlatıcı', text: 'Cadı Sis Geçidi, özgürleşen şehirlerin ışıklarıyla doluydu.' },
      { speaker: 'Malakor', text: 'Buraya kadar geldin. Dört elementin de efendisi olmak seni korumayacak.' },
      { speaker: 'Anlatıcı', text: 'Son savaş başlıyordu. Elmora\'nın kaderi bu geçitte belli olacaktı.' },
    ],
  },
};
