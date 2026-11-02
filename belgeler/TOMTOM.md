# TomTom anahtarı — yol durumu ve trafik haritası için

Bu kısım isteğe bağlı. Anahtar yoksa **Yol durumu**, **Duraklar** ve tam
ekran trafik haritası galeride hiç görünmez, Sade'nin geri kalanı aynen
çalışır. İstanbul trafik endeksi widget'ı (`trafik`) anahtarsız çalışır.

Pakette anahtar **yok** ve olmamalı. Herkes kendi ücretsiz anahtarını alır.

## Sade anahtarla ne yapıyor

| İstek | Ne zaman | Günde en fazla |
|---|---|---|
| Routing API: canlı trafikle süre ve rota çizgisi | 5 dk'da bir, güzergâh başına 1 | 6 güzergâhla 1.728 |
| Traffic Incidents API: köprü/tünel kapalı mı | 5 dk'da bir, tek istek | 288 |
| Map Display + Traffic Flow karoları | yalnızca tam ekran harita açıkken | kullanıma bağlı |

Ücretsiz katman günde 2.500 istek ve 50.000 harita karosu veriyor
(yazıldığı tarihte; güncel sınırlar TomTom'un fiyat sayfasında). Kota
aşılırsa istek reddedilir ve widget son iyi veriyi gösterir. **Kart bilgisi
istenmez, ücret çekilmez.**

İstekler TV'deki root servisinden gidiyor, uygulamadan değil. Anahtar
uygulamanın klasörüne, pakete ya da ekrana hiç girmiyor.

## 1 — Hesap ve anahtar

1. [developer.tomtom.com](https://developer.tomtom.com/)'a gidin →
   **Register** (ücretsiz). E-posta adresinizi doğrulayın.
2. Giriş yapınca **Dashboard** (ya da *My Dashboard*) → **Keys**. Hesapla
   birlikte bir anahtar kendiliğinden oluşur. Yoksa **Create key** deyin,
   adını `sade` gibi bir şey koyun.
3. Anahtarın izinli ürünlerinde en az şunlar açık olsun: **Routing API**,
   **Traffic API**, **Map Display API**. Yeni anahtarlarda bunlar
   genellikle varsayılan olarak açıktır.
4. Anahtarı kopyalayın. 32 karakterlik harf-rakam dizisi.

> Panelin görünüşü zamanla değişiyor. Adlar birebir tutmazsa *API Keys*
> başlığını arayın.

## 2 — Anahtarı Mac'te deneyin (TV'ye dokunmadan)

Anahtarı komut satırına yazmayın, kabuk geçmişine girer. Gizli okuyun:

```bash
read -rs K && echo "uzunluk: ${#K}"
curl -s -o /dev/null -w "routing: %{http_code}\n" \
  "https://api.tomtom.com/routing/1/calculateRoute/41.0082,28.9784:41.0422,29.0083/json?traffic=true&key=$K"
curl -s -o /dev/null -w "incidents: %{http_code}\n" \
  "https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=28.97,41.00,29.01,41.05&key=$K"
unset K
```

İkisi de `200` dönmeli. `403` alırsanız o ürün anahtarda kapalı, `401`
ise anahtar yanlış kopyalanmış.

## 3 — Güzergâhlarınızı yazın

```bash
cp belgeler/guzergah-ornek.json ~/guzergahlarim.json
nano ~/guzergahlarim.json
```

Örnek dosya İstanbul'da bir kavşaktan altı Boğaz geçişine giden
güzergâhlar. Her alanın açıklaması dosyanın sonundaki `_aciklama`'da.
Özetle:

- `ad`: `"E-5 · 15 Temmuz"`. ` · ` işaretinin solu tabelaya, sağı hedef
  adına gider. E-5/D-xxx mavi, TEM/O-x yeşil, gerisi gri tabela olur.
- `nereden` / `nereye`: `[enlem, boylam]`. Hedefi **köprünün girişinden
  önce, gidiş yönü şeridinin üstünde** seçin. Köprünün karşısını hedef
  verirseniz TomTom'un en hızlı bulduğu köprüden geçer, hangisi olduğu
  belli olmaz. Şeritteki bir noktadan başka köprüye gidilemez. Noktayı
  [openstreetmap.org](https://www.openstreetmap.org)'da tek yönlü yol
  çizgisinin üstünden alın: karşı şerit 15–35 m ötede olabiliyor.
- `kopru`: köprünün ya da tünelin kendisi. Kapanmalar (maraton, bakım)
  bu noktanın yakınındaki "yol kapalı" olaylarından anlaşılır, kartta
  **Kapalı** yazar.
- `kacin`: TomTom'un girmemesini istediğiniz dikdörtgenler. TomTom bunu
  **yumuşak** uyguluyor, yoğun trafikte yine girebilir. Hedefi doğru
  seçmek daha güvenilir.
- `duraklar`: "Duraklar" görünümü için yol sırasıyla kontrol noktaları.

Rotanın gerçekten istediğiniz yoldan geçtiğini kurduktan sonra haritada
gözle kontrol edin.

## 4 — Kurun

Anahtarı ve dosya yolunu **`ayarlar.yerel.sh`**'a yazın. Bu dosya
`.gitignore`'da, git'e ve paylaştığınız pakete girmez:

```bash
cp -n ayarlar.yerel.ornek.sh ayarlar.yerel.sh
nano ayarlar.yerel.sh
#   TOMTOM_ANAHTAR="..."
#   GUZERGAH_DOSYASI="$HOME/guzergahlarim.json"
bash araclar/servis-kur.sh
```

`servis-kur.sh` anahtarı komut satırına koymadan, stdin üzerinden TV'de
`/var/lib/webosbrew/sade/tomtom-anahtar` dosyasına yazar. Dosyayı yalnızca
root okuyabilir (0600).

> **Kontrol:** Widget sekmesinde "Yol durumu" ve "Duraklar" görünür. Kartın
> üstünde OK'a basınca tam ekran harita açılır. Sol/sağ ok görünümler
> arasında gezer, GERİ kapatır.
>
> Görünmüyorsa: `bash araclar/root-ssh.sh 'grep -i -E "tomtom|guzergah|kapali" /tmp/sade-svc.log | tail'`

## Anahtarı değiştirmek / kaldırmak

```bash
# değiştir: ayarlar.yerel.sh'ta TOMTOM_ANAHTAR'ı güncelleyip
bash araclar/servis-kur.sh
# kaldır:
bash araclar/root-ssh.sh 'rm -f /var/lib/webosbrew/sade/tomtom-anahtar'
bash araclar/servis-yeniden.sh
```

Anahtar sızdıysa TomTom panelinden silip yenisini oluşturun.
