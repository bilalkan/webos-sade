# Claude'a verilecek prompt

Aşağıdaki `---` çizgileri arasındaki metni olduğu gibi kopyalayıp Claude'a
verin. Paketin klasörünü de açık tutun (`cd` ile o klasöre geçip Claude
Code'u orada başlatmak en iyisi).

---

LG webOS TV'me "Sade" adlı bir launcher kurmak istiyorum. Bu klasörde
hazır bir paket var: launcher, root servisi, kurulum araçları ve belgeler.
Paket başka bir TV'de (OLED55B16LA, webOS 6.5.3) çalışır durumda ve
kurulumun her adımı orada bir kez yapıldı.

## Önce oku

Bu dosyaları kurulum hakkında konuşmaya başlamadan önce oku:
`README.md`, `GUVENLIK.md`, `KURULUM.md`, `belgeler/ROOT.md`. İkinci dosyadaki "Asla
yapmayın" bölümü uydurma değil, gerçekten çarpılmış duvarlar.

## Benim TV'm hakkında bilmediğin şeyler

Kuruluma başlamadan bana şunları sor ya da birlikte ölçelim — paketteki
değerler o TV'ye ait, benim TV'mde farklı olabilir:

- TV modeli ve webOS sürümü (Ayarlar → Destek → TV Hakkında).
  **6.x değilse root zinciri farklıdır, oradan devam etmeyelim.**
- TV'nin IP'si ve router'da sabitlenmiş olup olmadığı
- Bölge dosyasının adı (`blockedAppList/` içinde; o TV'de `TUR.json`)
- Kumandanın HOME tuş kodu (o TV'de 773 — ölçülecek)
- Mimari 32-bit mi 64-bit mi (`input_event` ofsetleri buna bağlı)
- Evimin mahalle seviyesinde koordinatı (hava durumu için)

## Nasıl çalışmanı istiyorum

1. **Teyit ederek ve dry-run'lı git.** TV'de bir şeyi değiştirecek her
   komuttan önce ne yapacağını ve neyin bozulabileceğini söyle, onayımı
   bekle. Okuma komutlarında onay sorma, çalıştır.
2. **Sana söylediğim işin dışına çıkma.** Yolda "şunu da düzeltsem iyi
   olur" dediğin şeyleri yap**ma**, söyle, ben karar veririm.
3. **TV'ye göndermeden önce yerelde test et.** Servis kodunu
   değiştirirsen `node servis/test/*.js` çalıştır ve `node --check` ile
   sözdizimini doğrula. Bu kuralın sebebi: o TV'de test edilmemiş bir
   servis değişikliği HOME tuşunu sonsuz döngüye soktu ve uygulamayı
   çökertti.
4. **Ekranı gereksiz kaplama.** Root işlemleri TV ekranını devralabiliyor;
   evde biri bir şey izliyor olabilir. İş bitince ekranı serbest bırak ve
   payload çalıştırıcı/geçici sayfa açık kaldıysa kapat.
5. **Başarısız olanı başarılı gibi raporlama.** Bir kontrol patlarsa
   çıktısıyla birlikte söyle ve dur. Özellikle kurulum adımlarında:
   kurulum servisi "başarılı" deyip eski sürümü bırakabiliyor.
6. **Her fazın sonundaki kontrolü çalıştır.** KURULUM.md'de her adımın
   sonunda bir "Kontrol" var. Atlamayalım.

## Kesin kurallar

- `com.webos.app.adoverlayex`, `com.webos.app.adoverlay`,
  `com.webos.app.acroverlay` ID'lerini gizli uygulama listesine **asla**
  eklemeyeceksin. Root exploit'i bu uygulamalardan giriyor; gizlenirse
  bir daha root alınamaz ve geri almak için root gerekir → fabrika ayarı.
- `lginputhook` **kurmayacaksın**. Güncel sürümü `tvservice`'i çökertiyor
  (video gitmiyor, reboot döngüsü, ses DSP kilidi), issue açık, düzeltme yok.
- `start-devmode.sh` dosyasına **dokunmayacaksın**. İmzalı; imza bozulursa
  firmware geliştirici modunu kapatır ve `/media/developer` silinir.
- SSH anahtarlarını **ben üreteceğim / benim için üreteceksin**, pakette
  gelen bir anahtar kullanmayacağız. Pakette anahtar yok, olmamalı.
- Dev Mode uygulamasını kaldırmak **geri dönüşsüz** eşik. O adıma gelince
  dur, bana durumu özetle, ayrıca onay al.
- slopbro'nun ilk koşusunun sonunda TV "reboot?" diye soracak: bana
  **"Don't reboot"** dedirt. Kalıcılık ikinci koşuda kuruluyor.
- Kişisel değerleri (IP, MAC, HOME kodu) `ayarlar.yerel.sh`'a yaz,
  `ayarlar.sh`'a değil. TomTom anahtarımı sohbete yapıştırmamı isteme;
  dosyaya ben yazarım. Anahtarı hiçbir çıktıda gösterme.

## Kurulum sırası

KURULUM.md'deki sırayı takip et. Özeti:

```
1-3  ön kontroller, ayarlar, yedek        geri dönüşü var
4    launcher'ı kur ve çalıştığını gör    Dev Mode hâlâ sağken
5    Dev Mode'u kaldır + kalıcı root      ⚠ GERİ DÖNÜŞSÜZ (belgeler/ROOT.md)
6    HOME tuş kodunu ölç
7    servisi kur (testler önce geçmeli)
8    Quick Start+ aç                      HOME'un asıl çözümü
9    Alexa/spor alarmını gizle            isteğe bağlı (önce önizleme)
10   TomTom ile yol durumu                isteğe bağlı (belgeler/TOMTOM.md)
```

## Bu TV'lerde zaman kaybettiren bilinenler

Bunları baştan bil, tekrar keşfetmene gerek yok:

- **`luna-send -n 1` bazı servislerde boş dönüyor**, aynı çağrı abonelik
  biçiminde çalışıyor: `luna-send -i -f luna://... '{"subscribe":true}'`.
  Özellikle `settingsservice`. Ama abonelik **çıkmaz** — arka planda
  çalıştır ya da ilk satırı al, yoksa komut askıda kalır.
- **`ares-install` bu firmware'de bozuk** ("isDate is not a function",
  root profiliyle "Unable to exec"). Yerine `scp` + `luna://com.webos.
  appInstallService/dev/install`. Paketteki `araclar/kur.sh` bunu yapıyor
  ve sürümü **doğruluyor** — doğrulama şart, çünkü kurulum servisi işi
  bitirmeden dönebiliyor. Takılırsa `restart appinstalld`.
- **webOS 6.5'te doğru anahtar `blocked_applist`**. webOS 26 rehberlerindeki
  `blockedSystemAppList` yolu bu sürümde sessizce hiçbir şey yapmıyor.
- **`nohup` SSH koptuğunda sürmüyor**, `setsid` kullan.
- **`pkill -f <desen>`** SSH ile çalıştırdığın komutun kendisini de
  öldürebiliyor (desen komut satırına uyuyor). Deseni sabitle.
- **busybox `chown`** sembolik kullanıcı adı kabul etmiyor, numara ver.
- **Chromium 79** (launcher'ın motoru): flex `gap` yok (grid gap var),
  `backdrop-filter` etkisiz, `overflow:hidden` padding box'tan kesiyor.
  Launcher'ın CSS'ini değiştirirken bunları unutma.
- **Boot zamanlaması** o TV'de: `startup.sh` 42.9 sn, `init.d` 45.9 sn,
  servis 49.3 sn. Daha erkeye çekmek imzalı bölgeye dokunmayı gerektiriyor,
  denendi, mümkün değil.
- **TV doğrudan launcher ile açılamıyor.** `/var/lib/eim/lastinput` bir
  giriş kaynağı seçicisi, geçerli type'lar yalnızca DTV/HDMI/COMP.
  Araştırıldı ve elendi — bana "bunu yapabiliriz" demeyelim.

## Kurulumdan sonra

Launcher'ın hava durumunu Apple Weather / yerel bir kaynakla karşılaştır.
Sapma varsa **ilk bakacağın şey koordinat**: şehir merkezi koordinatı
sistematik sapma veriyor, mahalle seviyesi düzeltiyor. Model ağırlığı veya
düzeltme sabiti ekleme — o TV'de denendi, 10-20 ölçüm noktasında yapılan
düzeltme aşırı uyum (overfitting) çıktı, koordinat düzeltilince sabitlerin
işareti bile değişti ve hepsi kaldırıldı.

Başlayalım: önce o üç dosyayı oku, sonra TV'm hakkında bilmen gerekenleri
bana sor.

---

## Prompt'u verirken ekleyebilecekleriniz

- Klimayı kullanmayacaksanız: *"Klima kısmı bende yok, atlayalım."*
- Namaz vakitleri istemiyorsanız: *"Namaz kartını kaldıralım."*
- Root'a girmek istemiyorsanız: *"Sadece launcher'ı kurmak istiyorum,
  5. adımdan sonrasına girmeyelim."* — launcher root olmadan da çalışır,
  sadece HOME tuşu LG'nin ekranını açmaya devam eder.
