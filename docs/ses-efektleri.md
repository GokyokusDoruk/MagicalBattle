# Büyü ses efektleri

Kod: `client/src/audio/sfx/`. Bütün sesler **koddan üretilir** (WebAudio, hiç ses dosyası yok), bu yüzden telifsizdir ve indirme gerektirmez.

## Denemek için

Oyunun adresine `?lab=sound` ekle (örn. `https://magicalbattle.dorukplays.com/?lab=sound`). Her sesi tek tek dinle:

- **Dört element** için: büyü yükleniyor, fırlatma, vuruş (vuruş şiddeti kaydırıcıyla)
- **Kalkan:** kurulur, tam savunma, kısmi savunma, parçalanır
- **Vuruş sonrası:** başa vuruş "ting"i, büyü yapamadı, yenilgi
- **Element açılışı:** saldırı üstün, savunma üstün, etkisiz
- **Arayüz:** seçim, sıra, zafer, bozgun
- **Çizim sesi:** alttaki pede basılı tutup hareket ettir, kalem hızına göre ses değişir

Sağ alttaki 🔊 düğmesi sesi kapatıp açar. Savaş (`?lab=battle`), arena (`?lab=arena`) ve çizim (`?lab=draw`) sayfalarında da var. Tarayıcılar sesi **ilk dokunuştan sonra** açar; ses gelmezse bir yere dokunup tekrar dene.

## Sesler nasıl yapıldı

| Ses | Karakter |
|---|---|
| Ateş | Çıtırdayan gürültü, yükselen testere dişi, derin gümbürtü |
| Su | Kabarcık gibi yükselen sinüsler, akıcı gürültü, sıçrama |
| Toprak | Alçak titreşim, taş çarpması, ağır "güm" |
| Hava | Yükselen esinti (whoosh), keskin çatırtı |
| Kalkan | Üç notalık parlak çınlama; savunmada metalik "ping"; kırılınca cam gibi parçalanma |
| Başa vuruş | Yüksek, parlak "ting" ekstra |
| Büyü yapamadı | Alçalan, boğuk üfleme |
| Yenilgi | Alçalan, derin ton |
| Açılış | Üstünlükte yükselen üç nota, dezavantajda alçalan üç nota |
| Zafer / bozgun | Yükselen arpej / alçalan dört nota |

Vuruş sesi **hasara göre** ayarlanır: ağır vuruş daha yüksek ve daha derin çalar. Çizerken kalem hızlandıkça ses parlar ve yükselir, durunca kısılır; her elementin kendi tonu var.

## Seviye dengesi

Bütün sesler çevrimdışı üretilip ölçüldü (hiçbiri taşmıyor ya da sessiz değil, NaN yok). Seviyeler birbirine yaklaştırıldı: en yüksek yenilgi (−7,8 dB), vuruşlar −9...−11 dB, büyü sesleri −12...−16 dB, arayüz sesleri −17 dB. Fark 9,5 dB. Ana sese bir sıkıştırıcı konuldu, üst üste binen sesler bozulmaz.

## Performans ve güvenlik

- Aynı anda en fazla **28** ses katmanı çalar, fazlası yok sayılır (telefonda yığılma olmaz).
- Hiçbir ses 2 saniyeden uzun sürmez.
- Ses desteklenmeyen cihazda oyun sessiz çalışır, hata vermez.
- Ses tercihi **saklanmaz** (yalnızca o oturumda geçerli); yerelde hiçbir şey tutulmaz.

## Sesi değiştirmek

Tarifler `recipes.ts` içinde düz veri olarak: her ses birkaç katman (osilatör ya da gürültü, frekans kayması, filtre, yükseliş ve sönüş süresi). Bir sesi değiştirmek için ilgili katmanın sayılarını düzenle, `?lab=sound` sayfasından dinle. Seviye düzeltmeleri aynı dosyadaki `TRIM` tablosunda.

## Koddaki yapı

- `recipes.ts`: ses tarifleri (saf veri, testli).
- `engine.ts`: `SoundEngine`; tarifleri WebAudio ile çalar, sessize alma, ses seviyesi, ses sınırı, çizim sesi.
- `arenaSounds.ts`: arena olaylarını (büyü, kalkan, vuruş, yenilgi) seslere bağlar.
