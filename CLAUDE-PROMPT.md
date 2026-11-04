# Claude'a verilecek prompt

Aşağıdaki `---` çizgileri arasındaki metni olduğu gibi kopyalayıp Claude'a
verin. En iyisi `cd` ile paketin klasörüne geçip Claude Code'u orada
başlatmak.

---

LG webOS TV'me "Sade" adlı bir launcher kurmak istiyorum. Bu klasörde
hazır bir paket var: launcher, root servisi, kurulum araçları ve belgeler.
Paket başka bir TV'de (OLED55B16LA, webOS 6.5.3) çalışır durumda ve
kurulumun her adımı orada bir kez yapıldı.

## Önce oku

Kurulum hakkında konuşmaya başlamadan önce şu dosyaları oku: `README.md`,
`GUVENLIK.md`, `KURULUM.md`, `belgeler/ROOT.md`. GUVENLIK.md'deki "Asla
yapmayın" bölümü gerçekten yaşanmış sorunlardan çıktı.

## Benim TV'm hakkında bilmediğin şeyler

Kuruluma başlamadan bana şunları sor ya da birlikte ölçelim; paketteki
değerler o TV'ye ait, benimkinde farklı olabilir:

- TV modeli ve webOS sürümü (Ayarlar → Destek → TV Hakkında).
  **6.x değilse root yöntemi farklıdır; root kısmına geçmeyelim.**
  Dev Mode'u silmeden önce firmware'in slopbro ile uyumlu olduğunu
  KURULUM.md 1a'daki gibi kontrol edelim.
- TV'nin IP'si ve modemde sabitlenmiş olup olmadığı
- Bölge dosyasının adı (`blockedAppList/` içinde; o TV'de `TUR.json`)
- Kumandanın HOME tuş kodu (o TV'de 773; ölçülecek)
- Mimari 32-bit mi 64-bit mi (`input_event` ofsetleri buna bağlı)
- Evimin mahalle düzeyinde koordinatı (hava durumu için)

## Nasıl çalışmanı istiyorum

1. **Onay alarak ve önce deneme çalıştırmasıyla ilerle.** TV'de bir şeyi değiştirecek her
   komuttan önce ne yapacağını ve neyin bozulabileceğini söyle, onayımı
   bekle. Okuma komutlarında onay sorma, çalıştır.
2. **Söylediğim işin dışına çıkma.** Yolda "şunu da düzeltsem iyi olur"
   dediğin şeyleri yapma; söyle, ben karar veririm.
3. **TV'ye göndermeden önce yerelde test et.** Servis kodunu
   değiştirirsen `node servis/test/*.js` çalıştır ve `node --check` ile
   sözdizimini doğrula. Sebebi: o TV'de test edilmemiş bir servis
   değişikliği HOME tuşunu sonsuz döngüye sokmuş ve uygulamayı çökertmişti.
4. **Ekranı gereksiz kaplama.** Root işlemleri TV ekranını devralabiliyor;
   evde biri bir şey izliyor olabilir. İş bitince ekranı serbest bırak ve
   payload çalıştırıcı/geçici sayfa açık kaldıysa kapat.
5. **Başarısız olanı başarılı gibi raporlama.** Bir kontrol başarısız
   olursa çıktısıyla birlikte söyle ve dur. Özellikle kurulum adımlarında:
   kurulum servisi "başarılı" deyip eski sürümü bırakabiliyor.
6. **Her adımın sonundaki kontrolü çalıştır.** KURULUM.md'de her adımın
   sonunda bir "Kontrol" var. Atlamayalım.

## Kesin kurallar

- `com.webos.app.adoverlayex`, `com.webos.app.adoverlay`,
  `com.webos.app.acroverlay` ID'lerini gizli uygulama listesine **asla**
  eklemeyeceksin. Root yöntemi bu uygulamaları kullanıyor; gizlenirlerse
  bir daha root alınamaz, geri almak için de root gerekir (tek çıkış
  fabrika ayarı).
- `lginputhook` **kurmayacaksın**. Güncel sürümü `tvservice`'i çökertiyor
  (video oynamıyor, yeniden başlatma döngüsü, ses DSP kilidi); issue açık,
  düzeltilmedi.
- `start-devmode.sh` dosyasına **dokunmayacaksın**. İmzalı; imza bozulursa
  firmware geliştirici modunu kapatır ve `/media/developer` silinir.
- SSH anahtarlarını benim bilgisayarımda **yeni üreteceğiz**; pakette
  anahtar yok.
- Dev Mode uygulamasını kaldırmak **geri dönüşsüz**. O adıma gelince dur,
  durumu özetle ve ayrıca onay al.
- slopbro'nun ilk çalıştırmasının sonunda TV "reboot?" diye soracak; bana
  **"Don't reboot"** seçtir. Kalıcılık ikinci çalıştırmada kuruluyor.
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
8    Quick Start+ aç                      HOME için şart
9    Alexa/spor alarmını gizle            isteğe bağlı (önce önizleme)
10   TomTom ile yol durumu                isteğe bağlı (belgeler/TOMTOM.md)
```

## Bu TV'lerde zaman kaybettiren bilinen şeyler

Bunları baştan bil, yeniden keşfetmene gerek yok:

- **`luna-send -n 1` bazı servislerde boş dönüyor**, aynı çağrı abonelik
  biçiminde çalışıyor: `luna-send -i -f luna://... '{"subscribe":true}'`.
  Özellikle `settingsservice`. Ama abonelik **kendiliğinden bitmez**: arka
  planda çalıştır ya da ilk satırı al, yoksa komut askıda kalır.
- **`ares-install` bazı ares sürümlerinde bozuk** ("isDate is not a
  function"; root profiliyle "Unable to exec"). Yerine `scp` + `luna://com.webos.
  appInstallService/dev/install`. Paketteki `araclar/kur.sh` bunu yapıyor
  ve sürümü **doğruluyor** — doğrulama şart, çünkü kurulum servisi işi
  bitirmeden dönebiliyor. Takılırsa `restart appinstalld`.
- **webOS 6.5'te doğru anahtar `blocked_applist`**. Yeni webOS
  rehberlerindeki `blockedSystemAppList` bu sürümde sessizce hiçbir şey
  yapmıyor.
- **`nohup` SSH koptuğunda yetmiyor**, `setsid` kullan.
- **`pkill -f <desen>`** SSH ile çalıştırdığın komutun kendisini de
  öldürebiliyor (desen komut satırına uyuyor). Deseni sabitle.
- **busybox `chown`** sembolik kullanıcı adı kabul etmiyor, numara ver.
- **Chromium 79** (launcher'ın motoru): flex `gap` yok (grid gap var),
  `backdrop-filter` etkisiz, `overflow:hidden` dolgu kutusundan kesiyor.
  Launcher'ın CSS'ini değiştirirken bunları unutma.
- **Boot zamanlaması** o TV'de: `startup.sh` 42.9 sn, `init.d` 45.9 sn,
  servis 49.3 sn. Daha erkene çekmek imzalı dosyalara dokunmayı
  gerektiriyor; denendi, mümkün değil.
- **TV'nin Sade ile açılması için `lastinput`'a uygulama yazmak çalışmıyor.**
  O dosya bir giriş kaynağı seçicisi (DTV/HDMI/COMP). Doğru yol Sade'yi
  `eim addDevice` ile bir giriş olarak kaydetmek (`appinfo.json`'da
  `supportGIP: true` şart); ayrıntısı `belgeler/NASIL-CALISIYOR.md`'de.
  `setLastInput`'u deneme yanılmayla çağırma, `lastinput`'u bozuyor.

## Kurulumdan sonra

Launcher'ın hava durumunu telefonumdaki hava uygulamasıyla karşılaştır.
Sapma varsa **ilk bakacağın şey koordinat**: şehir merkezi koordinatı
sistematik sapma veriyor, mahalle düzeyi düzeltiyor. Model ağırlığı ya da
düzeltme sabiti ekleme: o TV'de denendi, 10-20 ölçümle yapılan düzeltme
aşırı uyum çıktı; koordinat düzeltilince sabitlerin işareti bile değişti
ve hepsi kaldırıldı.

Başlayalım: önce o dört dosyayı oku, sonra TV'm hakkında bilmen
gerekenleri bana sor.

---

## Prompt'u verirken ekleyebilecekleriniz

- Klimayı kullanmayacaksanız: *"Klima kısmı bende yok, atlayalım."*
- Namaz vakitleri istemiyorsanız: *"Namaz kartını kaldıralım."*
- Root istemiyorsanız: *"Sadece launcher'ı kurmak istiyorum, 5. adımdan
  sonrasına geçmeyelim."* Launcher root olmadan da çalışır; yalnızca HOME
  tuşu LG'nin ekranını açmaya devam eder ve root servisine bağlı parçalar
  görünmez.
