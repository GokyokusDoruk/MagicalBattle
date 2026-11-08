/**
 * Hikâyedeki 16 ahlak seçimi (bölüm başına 2), docs/hikaye.md bölüm 5.
 * Her seçim iyi (+) ya da kötü (-) yönde ağırlığı kadar puan değiştirir; tarafsız seçenek yoktur.
 */

export type Side = 'good' | 'bad';

export interface ChoiceLine {
  speaker: string;
  text: string;
}

export interface ChoiceOption {
  label: string;
  /** Puana etkisi (5-15, işaret yönden gelir) */
  weight: number;
  /** Seçimden sonra gösterilen tepki */
  result: ChoiceLine[];
}

export interface MoralChoiceDef {
  id: string;
  chapter: number;
  title: string;
  /** Durumu anlatan satırlar */
  intro: ChoiceLine[];
  good: ChoiceOption;
  bad: ChoiceOption;
}

const A = 'Anlatıcı';

export const MORAL_CHOICES: readonly MoralChoiceDef[] = [
  {
    id: 'c1-isciler',
    chapter: 1,
    title: 'Esir köle işçiler',
    intro: [
      { speaker: A, text: 'İşçi kampında zincirli yüzlerce esir var. Nöbetçiler dağıldı, anahtarlar elinde.' },
      { speaker: 'Elysia', text: 'Hepsini bırakırsak yavaşlarız. Ama içlerinde çok güçlü olanlar var, ordunu büyütebilirsin.' },
    ],
    good: { label: 'Hepsini kurtar', weight: 12, result: [{ speaker: A, text: 'Zincirler tek tek düştü. İşçiler sana el sallayarak surların gölgesinde kayboldu.' }] },
    bad: { label: 'En güçlülerini ordun için al', weight: 12, result: [{ speaker: A, text: 'En güçlüleri seçtin, kalanlar zincirlerinde kaldı. Bakışlarını hissettin.' }] },
  },
  {
    id: 'c1-nobetci',
    chapter: 1,
    title: 'Yaralı Ignis nöbetçisi',
    intro: [{ speaker: A, text: 'Lav bacasının dibinde yaralı bir nöbetçi inliyor. Yaşayıp seni ele verebilir.' }],
    good: { label: 'Şifacıya götür', weight: 8, result: [{ speaker: A, text: 'Nöbetçiyi sırtlayıp şifacıya taşıdın. Gözlerinde şaşkınlık vardı.' }] },
    bad: { label: 'Susturmak için bırak', weight: 8, result: [{ speaker: A, text: 'Arkana bakmadan yürüdün. İnleme sesi bir süre peşinden geldi.' }] },
  },
  {
    id: 'c2-koyluler',
    chapter: 2,
    title: 'Ambargodaki köylüler',
    intro: [
      { speaker: A, text: 'Kervan yolu açıldı, erzak geldi. Köylüler aç. Ama kıtlıkta erzak altın değerinde.' },
    ],
    good: { label: 'Erzakı paylaştır', weight: 10, result: [{ speaker: A, text: 'Çuvallar kapı kapı dağıtıldı. Çocuklar ilk kez günlerdir güldü.' }] },
    bad: { label: 'Fazlasını sat', weight: 6, result: [{ speaker: A, text: 'Kesen kese doldu. Köyün sessizliği ağırdı.' }] },
  },
  {
    id: 'c2-kervanci',
    chapter: 2,
    title: 'Yakalanan kervancı',
    intro: [{ speaker: A, text: 'Malakor için çalışan bir kervancı yakalandı. Arabasında değerli mallar var.' }],
    good: { label: 'Serbest bırak', weight: 6, result: [{ speaker: A, text: 'Kervancı teşekkür etmeden hızla uzaklaştı. Belki bir gün hatırlar.' }] },
    bad: { label: 'Eşyasına el koy', weight: 10, result: [{ speaker: A, text: 'Mallar senin oldu, kervancı yaya döndü. Köylüler bunu gördü.' }] },
  },
  {
    id: 'c3-bekci',
    chapter: 3,
    title: 'Teslim olan tapınak bekçisi',
    intro: [{ speaker: A, text: 'Tapınak bekçisi dizlerinin üstüne çöktü: "Yeter, teslim oluyorum."' }],
    good: { label: 'Merhamet göster', weight: 8, result: [{ speaker: A, text: 'Bekçinin silahını aldın ama canına dokunmadın. Fısıldadı: "Sana borçluyum."' }] },
    bad: { label: 'Haberi ağzından almak için sıkıştır', weight: 12, result: [{ speaker: A, text: 'Bekçi konuştu ama gözleri yaşlıydı. Öğrendiklerin değerliydi, bedeli ağırdı.' }] },
  },
  {
    id: 'c3-emanet',
    chapter: 3,
    title: 'Tapınağın kutsal emaneti',
    intro: [{ speaker: A, text: 'Tapınağın kalbinde, havayı titreten kadim bir emanet duruyor. Gücü tarif edilemez.' }],
    good: { label: 'Yerinde bırak', weight: 12, result: [{ speaker: A, text: 'Emanete dokunmadan geri çekildin. Rüzgâr bir an hafifçe sesinin tonunu değiştirdi.' }] },
    bad: { label: 'Gücünü al', weight: 12, result: [{ speaker: A, text: 'Emanet avucunda eridi. İçine akan güç tatlıydı, ardında bir boşluk bıraktı.' }] },
  },
  {
    id: 'c4-sirlar',
    chapter: 4,
    title: 'Soyluların sırları',
    intro: [{ speaker: A, text: 'Üç soylunun gizli borçları ve sırları elinde. Onları kullanabilirsin.' }],
    good: { label: 'Yalnız Malakor’dan kopmaları için kullan', weight: 14, result: [{ speaker: A, text: 'Sırları yalnızca zincirlerini kırmak için kullandın. Soylular sana borçlu kaldı.' }] },
    bad: { label: 'Onları ezmek için kullan', weight: 10, result: [{ speaker: A, text: 'Soylular senin kuklan oldu. Korkuyla eğilen başlar sadakat değildir.' }] },
  },
  {
    id: 'c4-aile',
    chapter: 4,
    title: 'Soylu şampiyonun ailesi',
    intro: [{ speaker: A, text: 'Soylu şampiyonun ailesi saraydan kaçmaya çalışırken yakalandı. Şampiyon seni dinlemiyor.' }],
    good: { label: 'Zarar verme', weight: 10, result: [{ speaker: A, text: 'Aileyi güvenle bıraktın. Şampiyon uzun süre sana baktı, hiçbir şey demedi.' }] },
    bad: { label: 'Rehin al', weight: 14, result: [{ speaker: A, text: 'Şampiyonun bakışı taş kesildi. Artık seni yenmek için her şeyi yapar.' }] },
  },
  {
    id: 'c5-isciler',
    chapter: 5,
    title: 'Kale işçileri deprem sırasında',
    intro: [{ speaker: A, text: 'Sarsıntı başlamak üzere. Kale temelinde hâlâ yüzlerce işçi var.' }],
    good: { label: 'Önce onları tahliye et', weight: 12, result: [{ speaker: A, text: 'Son işçi dışarı çıkana kadar sarsıntıyı erteledin. Kale ancak ondan sonra sallandı.' }] },
    bad: { label: 'Sabotajı aksatma, devam et', weight: 6, result: [{ speaker: A, text: 'Taşlar düştü. Toz bulutunun içinden gelen çığlıkları duymamaya çalıştın.' }] },
  },
  {
    id: 'c5-kaelen',
    chapter: 5,
    title: 'Kaelen’in son isteği',
    intro: [
      { speaker: 'General Kaelen', text: 'Yenildim. Tek bir şey istiyorum: Surların altındaki gömütün korunmasını. Söz ver.' },
    ],
    good: { label: 'Yerine getir', weight: 6, result: [{ speaker: 'General Kaelen', text: 'Taş gibi sert yüzü bir an yumuşadı. "Elysia... doğu geçidindeki zindanda," diye fısıldadı.' }] },
    bad: { label: 'Reddet', weight: 10, result: [{ speaker: 'General Kaelen', text: 'Kaelen susup gözlerini kapadı. Elysia’nın yerini yine de ele verdi, ama sesi soğuktu.' }] },
  },
  {
    id: 'c6-morga',
    chapter: 6,
    title: 'Cadı Morga yenilince',
    intro: [{ speaker: A, text: 'Morga yere serildi. Sisin gücü ona bağlı; ister bağışla, ister gücünü al.' }],
    good: { label: 'Bağışla', weight: 10, result: [{ speaker: 'Cadı Morga', text: '"Beni yenip bağışlayan ilk Bekçi..." Gizli yolu gösterdi.' }] },
    bad: { label: 'Gücünü al', weight: 8, result: [{ speaker: A, text: 'Morga’nın gücü sana aktı. Gözleri sönerken yolu yine de gösterdi.' }] },
  },
  {
    id: 'c6-koyluler',
    chapter: 6,
    title: 'Sisten çıkan bataklık köylüleri',
    intro: [{ speaker: A, text: 'Sis çekiliyor ama zemin batıyor. Herkesi birden çıkaramazsın.' }],
    good: { label: 'Hepsini koru', weight: 8, result: [{ speaker: A, text: 'Herkes çıkana kadar bataklığın içinde kaldın. Köylüler seni alkışladı.' }] },
    bad: { label: 'Önce yolu aç, geride kalanlar kalsın', weight: 10, result: [{ speaker: A, text: 'Yolu açtın, ama geride kalanların sesi bir süre kulaklarında çınladı.' }] },
  },
  {
    id: 'c7-zihin',
    chapter: 7,
    title: 'Morwenna’nın zihin kontrolü',
    intro: [{ speaker: A, text: 'Zihin kontrolünü kıracak büyü Morwenna’ya da zarar verebilir. Kırmazsan Elysia da kontrolde kalır.' }],
    good: { label: 'Kır ve riske gir', weight: 15, result: [{ speaker: A, text: 'Büyü patladı. Morwenna sendeledi, Elysia gözünü açtı: "Sen... geldin."' }] },
    bad: { label: 'Kırmadan Elysia’yı çek', weight: 9, result: [{ speaker: A, text: 'Elysia’yı çektin, ama gözlerinde bir bulanıklık kaldı. Morwenna güldü.' }] },
  },
  {
    id: 'c7-mahkumlar',
    chapter: 7,
    title: 'Zindandaki mahkûmlar',
    intro: [{ speaker: A, text: 'Zindanda yüzlerce mahkûm var. Hepsini çıkarmak vakit kaybettirir.' }],
    good: { label: 'Hepsini serbest bırak', weight: 9, result: [{ speaker: A, text: 'Hücreler tek tek açıldı. Gün ışığına çıkanlar gözlerini kıstı.' }] },
    bad: { label: 'Yalnız işine yarayanları al', weight: 12, result: [{ speaker: A, text: 'Gerekenleri seçtin. Geride bıraktıkların sana sessizce baktı.' }] },
  },
  {
    id: 'c8-temsilciler',
    chapter: 8,
    title: 'Özgürleşen şehirlerin temsilcileri',
    intro: [{ speaker: A, text: 'Dört şehrin temsilcileri Sis Geçidi’nde toplandı. Malakor’a karşı bir orduya ihtiyaç var.' }],
    good: { label: 'Gönüllü destek iste', weight: 12, result: [{ speaker: A, text: 'Gönüllüler tek tek öne çıktı. Küçük ama kararlı bir ordu kuruldu.' }] },
    bad: { label: 'Zorla ordu kur', weight: 14, result: [{ speaker: A, text: 'Emirler verildi. Ordu büyüdü, ama gözlerdeki korku sadakat değildi.' }] },
  },
  {
    id: 'c8-teklif',
    chapter: 8,
    title: 'Malakor’un teslim teklifi',
    intro: [
      { speaker: 'Malakor', text: 'Gücünü benimle paylaş, birlikte diyarı yönetelim. Reddedersen yok olursun.' },
    ],
    good: { label: 'Reddet', weight: 14, result: [{ speaker: 'Malakor', text: 'Sakince gülümsedi. "Öyleyse bu gece son geceniz."' }] },
    bad: { label: 'Kabul et ve gücü paylaş', weight: 12, result: [{ speaker: 'Malakor', text: '"Akıllı seçim..." dedi. Gölge bir an içine işledi.' }] },
  },
];

const BY_ID = new Map(MORAL_CHOICES.map((c) => [c.id, c]));

export const getChoice = (id: string): MoralChoiceDef | undefined => BY_ID.get(id);

export const choicesForChapter = (chapter: number): MoralChoiceDef[] => MORAL_CHOICES.filter((c) => c.chapter === chapter);

export const MIN_WEIGHT = 5;
export const MAX_WEIGHT = 15;
