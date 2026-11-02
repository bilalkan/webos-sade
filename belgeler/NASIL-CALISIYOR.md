# Nasıl çalışıyor — mekanizma notları

Kurulum için gerekmez; bir şey bozulduğunda ya da değiştirmek
istediğinizde gerekir.

## Kalıcı root

Kalıcılık tek bir numaraya dayanıyor:

```
/var/luna/preferences/devmode_enabled   DOSYA iken  →  normal dev mode
                                        DİZİN iken  →  kalıcı root
```

Firmware geliştirici modunu kapatırken `rm -rf .../devmode_enabled`
çalıştırıyor. `-rf` dizini de siler — ama dizin olduğu sürece
`/media/developer`'ı silen kontrol geçiyor. Dev Mode uygulaması TV'de
kalırsa 50 saatlik oturum sayacı dolduğunda bu yolu siler, o yüzden
uygulama kaldırılıyor.

`start-devmode.sh` imzalı ve **ona dokunulmuyor** — bu rehberin tamamı
imza duvarına hiç çarpmadan ilerliyor. İmza doğrulaması `Verified OK`
verdiği için autoroot o dosyayı değiştirme yoluna hiç girmiyor.

Boot zinciri:
```
start-devmode.sh (imzalı, stok)
  └→ /var/lib/webosbrew/startup.sh        (HBChannel kurdu)
       └→ /var/lib/webosbrew/init.d/*     (run-parts, cold boot'ta)
            └→ 50-sade → servis/autostart.sh
```

`init.d` boot'ta ~45.9. saniyede çalışıyor. Daha erkene çekmek imzalı
bölgeyi değiştirmek demek, yani mümkün değil.

## HOME tuşu

İki parça birlikte çalışıyor:

**1. Tuşu yakalama.** Servis `/dev/input/event*` düğümlerini **salt-okunur**
açıyor (grab etmiyor, yani LG'nin kendi okuması bozulmuyor) ve HOME kodunu
bekliyor. Gördüğünde launcher'ı `applicationManager/launch` ile açıyor.

`input_event` yapısı 32-bit ARM'de 16 bayt:
```
offset  8  → type    (uint16)   1 = EV_KEY
offset 10  → code    (uint16)   HOME (bizde 773)
offset 12  → value   (int32)    1 = basıldı
```
64-bit sistemde yapı 24 bayt, ofsetler kayar.

Magic Remote bağlanınca **başka bir event düğümüne geçebiliyor** ve servis
50. saniyede açtığı fd'lerle kör kalıyor. Çözüm: 5 saniyede bir yeni aygıt
taraması + 30 saniyede bir hepsini kapatıp yeniden açma.

**2. LG'nin tuşu geri kapmasını engelleme.** Launcher öne geldikten *sonra*
servis `com.webos.surfacemanager.disableHome=true` yazıyor. Çıkışta
`false`'a çekiyor. Servis normal sinyalle öldürülmezse bu geri yazma olmaz
ve HOME tuşu hiçbir şey açmaz — GUVENLIK.md 4c'deki komut bunu düzeltiyor.

LG, HOME'u basıştan ~340 ms sonra **yeniden sahipleniyor**, bu yüzden servis
bir basışa 3 kez tepki veriyor (`TEPKI_HAKKI = 3`).

## Devre kesici — neden var ve eşiği neden böyle

Servis bir noktada `luna-send` çıktısını tampona ekleyip her yeni veri
parçasında **tamponun tamamını baştan tarıyordu**. Eski `appId` değerleri
tekrar tekrar eşleşiyor, her eşleşme yeni bir komut tetikliyordu:

```
LG Home → Sade → LG Home → Sade → … → uygulama çöküyor
```

Doğrusu tam JSON nesnelerini tampondan **söküp çıkarmak**
(`onplan-ayristirici.js`, 8 birim test).

Devre kesici eşiği (`tepki-mantigi.js`):
```
SINIR      = 6      tepki
SINIR_SURE = 1000   ms      → 1 saniyede 6'dan fazla ise
SUS_SURE   = 30000  ms        30 saniye sus
```
Gerçek bir döngü **aynı milisaniyede** tekrar ediyor; normal kullanımda
3 tepki ~340 ms arayla geliyor. Eşik bu ikisini ayırt ediyor. İlk denediğimiz
"10 saniyede 2" eşiği normal kullanımı kesiyordu — 3 kez arka arkaya
basınca servis susuyordu.

## Quick Start+ neden gerekli

`quickStartMode` kapalıyken TV beklemeden dönüşte **yeniden başlıyor**:
servis ölüyor, ~50. saniyede yeniden ayağa kalkıyor, o arada HOME çalışmıyor.
Ayrıca soğuk açılışta Magic Remote'un aygıt düğümünü devralma sorunu
yaşanıyor.

Açıkken TV soğuk açılış yapmıyor, servis beklemede yaşıyor, HOME ilk
andan çalışıyor.

Ölçüm (tek seferlik, temiz değil — ilki boot'tan 190 sn sonra, ikincisi
1404 sn sonra alındı):

```
                  kapalı    açık
MemAvailable      483 MB    475 MB
Swap kullanımı     97 MB    156 MB
```

Bir gece dayanıklılık testi (23→24 Ekim):

```
23 Eki 21:27   uptime 1544 sn    servis pid 6815
24 Eki 09:12   uptime 10420 sn   servis pid 6815   ← aynı pid
```

Duvar saati 11s44dk ilerlemişken uptime yalnızca 2s28dk arttı; aradaki
~9s17dk beklemede geçti ve sayaca yazılmadı. Süreç uyutuluyor, bu yüzden
log da yalnızca uyanık geçen süre kadar birikmiş.

Sürecin başlangıcı `/proc/<pid>/stat` 22. alanda **113 sn** (uptime
cinsinden) — yani servisi boot süreci başlatmış, elle başlatılmamış.

**Çıkarım:** soğuk açılış olmadı, süreç hiç ölmedi. Dayanağı aynı pid'in
12 saat boyunca korunması. Kesinleştirmek isterseniz tek bir komut yeter —
log'un ilk satırı beklemeden *önceki* bir zaman damgası taşıyorsa süreç
(ve `/tmp`) gerçekten hayatta kalmıştır:

```bash
bash araclar/root-ssh.sh 'head -2 /tmp/sade-svc.log'
```

`/tmp` tmpfs olduğu için yeniden başlatmada silinir; eski damga görünürse
tartışma biter.

## Hava durumu

Beş modelin **düz ortalaması** (Open-Meteo):
```
ecmwf_ifs025 · icon_seamless · meteofrance_seamless · ukmo_seamless · gfs_seamless
```

Model seçimi ve düzeltme sabiti denendi ve **kaldırıldı**. Sebebi: 10-20
ölçüm noktasına bakarak model alt kümesi seçmek aşırı uyum (overfitting)
üretiyor. Hedef konumu şehir merkezinden mahalleye çevirdiğimizde sistematik
sapma kendiliğinden sıfırlandı ve daha önce "en iyi" bulunan sabitlerin
**işareti bile değişti**. Beş modelin ortalaması her hedefte her tek
modelden iyiydi.

Yani: sapma görürseniz **koordinatı düzeltin**, sabit eklemeyin.

Namaz vakitleri: Aladhan API, `method=13` (Diyanet). `yapilandirma.js`
içinden değiştirilebilir.

## Gün dönümü

`gunDegistiMi()` 20 saniyede bir tarihi kontrol ediyor. Beklemeden dönüşte
de çalışıyor, yani TV bir gece kapalı kalıp açıldığında tarih/hava kartları
kendini yeniliyor. Gece yarısı geçişi `setTimeout` ile hesaplanmıyor —
beklemede duran bir zamanlayıcıya güvenilmiyor.

## Zaten önde olan uygulamayı tekrar açmayın

24 Ekim'de yaşandı. Launcher öndeyken HOME'a basıldı:

```
18:36:31.5  ac (home)                      ← servis Sade'yi açtı, Sade ZATEN öndeydi
18:36:31.8  on plan -> com.webos.app.home  ← LG ana ekranı da geldi
18:36:31.8  LG ana ekrani -> Sade one aliniyor
18:36:32.4  on plan -> (bos)               ← WebView kilitlendi
18:37:03.6  on plan -> com.bilal.sade      ← 31 sn sonra kendine geldi
```

Sebep: on planda **çalışan** bir web uygulamasını yeniden
`applicationManager/launch` ile açmak. WAM uygulamayı yeniden başlatıyor,
WebView kilitleniyor, ekran boş kalıyor.

Aynı tuzağı üç yer tetikliyordu:

| Tetikleyici | Ne zaman |
|---|---|
| HOME tuşu | Sade zaten öndeyken basılırsa |
| Uyanma algılama | 2,5 sn arayla 3 kez — Quick Start+ ile Sade zaten önde olduğu için **her uyanmada** |
| LG ana ekranına tepki | Burada Sade önde değil, sorunsuz |

Kural `servis/acilma-karari.js` içinde, 11 birim testi var: ön planı
**güvenilir biçimde** biliyorsak ve zaten bizim uygulamamızsa dokunma.
Ön plan aboneliği düşmüşse eski davranışa dönülüyor — HOME'un hiç
çalışmamasındansa fazladan bir `launch` yeğ.

## Ayarlar: odağa göre açıklama

Fikir [ammar027/lumen-webos](https://github.com/ammar027/lumen-webos)'un ayarlar
ekranından alındı (kendisi Preact + Vite; biz yalnızca fikri aldık, kodu değil).

Satırın ne yaptığını satırın içine sıkıştırmak yerine başlığın altındaki tek
satırda anlatıyoruz. Satırlar temiz kalıyor, açıklamaya da bol yer kalıyor.

Bizde özellikle bir şeyi çözdü: bir uygulama dock'ta **değilken** ok düğmeleri
görünür ama etkisiz bırakılıyor — satırların sütun sayısı değişmesin ve odak
satır değiştirince kaymasın diye. Kullanıcı bunun neden tıklanmadığını
bilemiyordu. Artık yazıyor:

```
sol ok, 1. sırada (soluk)  →  "YouTube zaten ilk sırada."
sağ ok                     →  "YouTube bir sağa taşınır — şu an 1. sırada."
Dock'ta düğmesi            →  "YouTube dock'tan çıkarılır. Tüm Uygulamalar'da kalır."
dock dışı uygulamanın oku  →  "Medya Oynatıcı dock'ta değil — önce ekle, sonra sıralayabilirsin."
Sıfırla                    →  "Dock'u varsayılan uygulamalara döndürür."
```

Uygulaması ucuz: `#ayar-aciklama` elemanı zaten vardı (sabit metinliydi),
`odakCiz()` de odaklanan elemanı zaten hesaplıyordu. Tek yapılan, o elemandan
`data-is` / `data-app` okuyup metni üretmek (`ayarAciklamasi()`).

**Alınmayan fikirler ve nedenleri:** Preact/Vite bileşen yapısı (biz build'siz
çalışıyoruz), liste sanallaştırma (bizim liste onlarca satır, binlerce değil),
`mask-image` ile kenar soldurma (lumen'in kendi yamaları bunu geri almış —
Chromium'u listeyi her karede ekran dışı yüzeye çizmeye zorluyor).

## HOME tuşu: LG ile yarışmak yerine filtreyi kapatmak

İlk yöntemimiz LG ile **yarışıyordu**: HOME'a basılınca hem biz hem LG
uygulama açıyorduk, kim kazanacağı zamanlamaya bağlıydı. Launcher zaten
öndeyken kazanan olmuyordu — LG ekranı gelip gidiyor, uygulama çöküyordu.

Doğru mekanizma LG'nin **kendi kaynağında** bulundu (webOS 6.5.3):

```js
// /usr/lib/qt5/qml/KeyFilters/systemUi.js
var HOME_APP_ID = "com.webos.app.home";          // SABİT KODLU

function launchHomeApp(key) {
    if (!access.ribbon || ... || settingsService.disableHome || ...) {
        pmLog.info("HOME_IGNORED", {... "disableHome": ...});
        return;                                   // ← çıkış kapısı
    }
    applicationManager.launch("com.webos.app.home", ...);
}
```

```qml
// .../WebOSCompositor/controllers/StarfishViewStateController.qml
property bool disableHome: Settings.subscribe("com.webos.service.config",
    "getConfigs", {"configNames":["com.webos.surfacemanager.disableHome"]})
```

Yani ayar **configd**'de ve **abonelikle** okunuyor — değişiklik anında
etki ediyor, reboot gerekmiyor:

```bash
luna-send -n 1 -f luna://com.webos.service.config/setConfigs \
  '{"configs":{"com.webos.surfacemanager.disableHome":true}}'
```

`true` iken LG kendi ana ekranını hiç açmıyor, tuş tamamen servise kalıyor.
Yarış ortadan kalkıyor.

### Emniyet: HOME asla kalıcı olarak ölmez

Üç katman:

| Katman | Ne zaman |
|---|---|
| Servis çıkış kancası | Düzgün kapanışta (SIGTERM) `false` yazıyor |
| `home-bekci.sh` | Servis **sert** çökerse 60 sn içinde `false` yazıp çıkıyor |
| configd'nin kendisi | Değer `configd_db.json`'da **yok**, yalnızca bellekte — reboot sıfırlıyor |

Üçüncüsü en önemlisi: ayar kalıcı olmadığı için en kötü senaryoda bir
yeniden başlatma HOME'u LG'ye geri veriyor.

### `defaultApps.home` neden çalışmıyor

Bazı projeler HOME devralmak için şunu öneriyor:

```bash
setSystemSettings '{"category":"general","settings":{"defaultApps":{"home":"<appId>"}}}'
```

webOS 6.5.3'te **denendi ve çalışmadı.** Yazma `returnValue: true` dönüyor,
okuma değeri doğruluyor, `/usr/sbin/sam` anahtara canlı abone — ama HOME
tuşunun davranışı değişmiyor. Sebebi yukarıda: `systemUi.js` içinde
`HOME_APP_ID` sabit kodlu, ayardan okunmuyor.

## Açılışta doğrudan launcher — `eim addDevice`

TV'yi kendi ana ekranınızla açmak mümkün, ama yolu sezgisel değil.

**Yanlış yol:** `/var/lib/eim/lastinput` dosyasına uygulama kimliği yazmak.
O dosya bir **giriş kaynağı** seçicisi; `eim` ikilisi yalnızca DTV / HDMI /
COMP tiplerini kabul ediyor. Bir uygulama giriş kaynağı değil, bu yüzden
oraya yazmak çalışmıyor.

**Doğru yol:** launcher'ı bir giriş olarak **kaydettirmek.** TV'de zaten her
girişin bir `appId`'si var — HDMI 1 aslında `com.webos.app.hdmi1` adlı bir
uygulama.

```bash
luna-send -n 1 -f luna://com.webos.service.eim/addDevice \
  '{"appId":"com.bilal.sade","pigImage":"","mvpdIcon":"",
    "label":"Sade","description":"Sade ana ekran"}'
```

Sonuç: `id = MVPD_IP-com.bilal.sade` adlı bir giriş. INPUT menüsünde
görünüyor, seçilince açılıyor, ve TV onu son giriş olarak hatırlıyor.

### Şart: `appinfo.json` içinde `supportGIP`

```json
"supportGIP": true
```

**Bu bayrak olmadan `addDevice` `returnValue: true` dönüyor ama hiçbir şey
eklemiyor.** `eim` ikilisindeki dize sırası nedenini gösteriyor:

```
Getting All launch point list done
appInfo
supportGIP
[%s] supportGIP : %s
```

Yani servis uygulamanın manifestine bakıp bu bayrağı arıyor.

### Zorunlu alanlar

Servis eksik alanı kendisi söylüyor:

```
addDevice {}  →  {"errorCode":"EIM.101","errorText":"No match field: [pigImage]"}
```

Zorunlu olanlar yalnızca `pigImage` ve `appId`. `mvpdIcon` boş geçilse bile
servis `appinfo.json`'dan ikonları kendisi dolduruyor.

### Geri alma — kullanmadan önce kanıtlandı

```bash
luna-send -n 1 -f luna://com.webos.service.eim/deleteDevice '{"appId":"com.bilal.sade"}'
```

Sil → `getAllInputStatus` ile yok olduğunu gör → tekrar ekle → geri geldiğini
gör. Bu tur **eklemeden önce** yapıldı; geri dönüşü doğrulanmamış bir
değişikliği kalıcılaştırmak doğru değil.

### Kalıcılık

Kayıt `/var/lib/eim/eim_mvpd_db.json` dosyasına yazılıyor, yani reboot'u
aşıyor. Soğuk açılışta doğrulandı: `/tmp` silinmişken giriş kaydı ve
`lastinput` yerindeydi, ön planda launcher vardı.

### ⚠️ İki tuzak

**1. `returnValue: true` "yapıldı" demek değil.** Hem boş `appId` ile, hem
`supportGIP` yokken `true` döndü ve ikisinde de hiçbir şey olmadı. Her adımı
`getAllInputStatus` ile geri okuyarak doğrulayın.

**2. `setLastInput` bir YAZICI.** `addDevice`'ın şemasını "eksik parametreyle
çağır, servis söylesin" yöntemiyle keşfetmek güvenliydi (boş değeri yok
sayıyor). Aynı yöntemi `setLastInput`'ta denemek `lastinput`'u bozdu —
`type` ve `appId` boşaldı. Yazıcı metotlarda parametreyi `strings` ile
ikiliden okuyun, deneme yanılma yapmayın. Ve önce yedek alın:

```bash
bash araclar/root-ssh.sh 'cat /var/lib/eim/lastinput' > lastinput-yedek.json
bash araclar/root-ssh.sh 'cat /var/lib/eim/eim_mvpd_db.json' > mvpd-db-yedek.json
```
