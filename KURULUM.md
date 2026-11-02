# Kurulum

Tahmini süre 2–3 saat. Acele etmeyin, her adımın sonundaki **kontrolü**
çalıştırın. Bir kontrol patlarsa **durun** — sonraki adım durumu kötüleştirir.

Önce [GUVENLIK.md](GUVENLIK.md) okunmalı.

Bu belge **Sade 2.19.1** içindir (sürüm: `sade/appinfo.json`).

## Hangi yoldan gideceksiniz?

| Durumunuz | Yapılacaklar |
|---|---|
| TV'de root yok, sıfırdan başlıyorsunuz | Aşağıdaki **1–9** adımlarını sırayla |
| TV zaten root'lu, root SSH çalışıyor | **Kısa yol** (hemen altta) |
| Sade'nin eski bir sürümü zaten kurulu | En alttaki **Güncelleme** bölümü |

Trafik ve güzergâh widget'ları isteğe bağlı; isterseniz kurulumdan sonra
**10. adım**.

### Kısa yol — TV zaten root'lu

Root SSH anahtarınız `~/.ssh/lgtv_root_ed25519` değilse `ayarlar.yerel.sh`
içinde `ROOT_KEY`'i yazın.

```bash
cp ayarlar.yerel.ornek.sh ayarlar.yerel.sh
nano ayarlar.yerel.sh           # TV_IP, TV_MAC (ROOT_KEY gerekirse)
nano sade/yapilandirma.js       # enlem / boylam / şehir
bash araclar/root-ssh.sh 'id'   # "uid=0(root)" görmelisiniz
bash araclar/paketle.sh
bash araclar/kur.sh cikti/com.bilal.sade_*_all.ipk   # "OK — kurulu: 2.19.1"
```

Bu kadarıyla Sade uygulama listesinde görünür ve elle açılır. HOME
tuşunun Sade'yi açması için **6, 7 ve 8. adımlar** gerekir (tuş kodu,
servis, Quick Start+). Uygulama ikonlarının TV'den gelmesi ve klima/TV
widget'ları da 7. adımdaki servise bağlı.

## Gerekenler

- Mac veya Linux: `node`, `python3`, `ssh`, `scp`, `ssh-keygen`
- TV ile aynı ağda olmalısınız
- **TV'ye router'dan sabit IP** (DHCP rezervasyonu) önerilir. Şart değil:
  araçlar TV'yi MAC adresinden de buluyor (`araclar/tv-ip.sh`).
- TV'de LG hesabı ile giriş yapılmış olmalı (Dev Mode için)

## Sıranın mantığı

```
1-3  hazırlık ve ön kontroller      ← geri dönüşü var
4    launcher'ı kur ve DENE          ← Dev Mode hâlâ sağken
5    Dev Mode'u kaldır + root        ← GERİ DÖNÜŞSÜZ eşik burada
6-8  HOME tuşu servisi
9    Alexa/spor alarmı gizle
```

Launcher'ı **5. adımdan önce** kuruyoruz. Sebebi: Dev Mode gidince eski
kurulum yolu kapanır, yerine root SSH gelir. Launcher'ın çalıştığını daha
kolay yoldan görmüş olmak, sonra iki kapının arasında kalmamak demek.

---

## 1 — Ön kontroller (TV'ye hiç dokunmadan)

### 1a. TV'niz root'lanabilir mi? — Dev Mode'u SİLMEDEN ÖNCE bakın

5. adımda Dev Mode uygulamasını kaldırmak **geri dönüşsüz**. Ondan önce
root zincirinin sizin TV'nizde çalışma ihtimalini öğrenin, yoksa silip
sonra root alamadan kalırsınız.

- **webOS sürümü:** Ayarlar → Destek → TV Hakkında. Bu rehber **webOS 6.x**
  içindir. Başka ana sürümde (5, 7, 11…) root exploit'i farklıdır; aşağısı
  sizin için geçerli değil.
- **Rootlanabilirlik:** [cani.rootmy.tv](https://cani.rootmy.tv/) TV
  modelinize ve firmware'inize göre bilinen bir yöntem olup olmadığını söyler.
- **Exploit uyumu:** root [slopbro](https://github.com/throwaway96/slopbro)
  ile alınıyor; kendi README'sinde hangi sürüm/firmware'lerde çalıştığı
  (ve yamalanmış sürümler) yazıyor. Firmware'iniz oradaki aralığın dışındaysa
  **5. adıma hiç başlamayın.**

Bizde çalışan donanım: OLED55B16LA · webOS 6.5.3 · firmware 03.53.45.

### 1b. Dev Mode'u açın ve bağlanın

TV'de **LG Content Store**'dan *Developer Mode* uygulamasını kurun (LG
hesabıyla giriş gerekir), açın, **Dev Mode'u ON** yapıp TV'yi yeniden
başlatın. Uygulamayı yeniden açık tutun — aşağıda ekrandaki parolayı
kullanacaksınız.

Mac/Linux'ta webOS CLI'yi kurup TV'yi tanıtın:

```bash
npm install -g @webosose/ares-cli
ares-setup-device        # add → ad: tv, IP: <TV_IP>, port: 9922,
                         # kullanıcı: prisoner (parola yok)
ares-setup-device --list
```

SSH anahtarını TV'den **siz çekiyorsunuz** (anahtar TV'de üretiliyor, Mac'te
siz üretmiyorsunuz):

```bash
ares-novacom --device tv --getkey
# Parola istenince Dev Mode uygulamasının sol altındaki 6 haneli
# parolayı girin (büyük/küçük harfe duyarlı).
ares-device --system-info --device tv   # model, SDK sürümü dönerse bağlantı tamam
```

> Dev Mode oturumu süreli (uygulamada *Remain Session*). Bitmeden **EXTEND**
> ile uzatın; ağ bağlıyken yapın. Oturum biterse ya da TV ağsızken 10 kez
> yeniden başlarsa Dev Mode kapanır ve kurduğunuz test uygulamaları silinir —
> bu yüzden 5. adıma kadar fazla oyalanmayın.

### 1c. Üç ön kontrol

`ares-shell` ile TV'de komut çalıştırıp bakın (doğrudan `ssh -p 9922
prisoner@<TV_IP>` de olur, anahtar `ares-novacom` ile yüklendiyse):

```bash
# a) devmode_enabled şu an DOSYA olmalı (root sonrası dizine dönecek)
ares-shell -d tv -r 'ls -ld /var/luna/preferences/devmode_enabled'

# b) imza doğrulaması — "Verified OK" GÖRMELİSİNİZ
ares-shell -d tv -r '
  D=/media/cryptofs/apps/usr/palm/services/com.palmdts.devmode.service
  openssl dgst -sha512 \
    -verify /usr/palm/services/com.palm.service.devmode/pub.pem \
    -signature $D/start-devmode.sig $D/start-devmode.sh'

# c) bölge dosyanızın adı (bizde TUR.json)
ares-shell -d tv -r 'ls /var/preferences/com.webos.applicationManager/blockedAppList/'
```

> **`Verified OK` görmüyorsanız DURUN.** O zaman kalıcılık yöntemi
> değişiyor ve bu rehber geçerli değil.

## 2 — Ayarları yazın

```bash
cp ayarlar.yerel.ornek.sh ayarlar.yerel.sh
nano ayarlar.yerel.sh       # TV_IP ve TV_MAC'i yazın
nano sade/yapilandirma.js   # enlem / boylam / şehir
```

Kişisel değerler `ayarlar.yerel.sh`'a gider. Bu dosya `.gitignore`'da, git'e
ve paylaştığınız pakete girmez. `ayarlar.sh` varsayılanları ve
açıklamaları taşıyor; oradaki bir değeri değiştirmek isterseniz satırı
yerel dosyaya kopyalayın.

Geri kalanı **isteğe bağlı** ve varsayılanları güvenli:

- `yapilandirma.js` — ana ekranın ilk yerleşimi, uygulama listesi, dock,
  tema. Boş bırakırsanız Sade TV'de yüklü uygulamalardan ve evinizdeki LG
  cihazlarından kendisi kurar. Evde klima yoksa klimanın yerine ekran süresi
  gelir; hiçbir şey boş satır bırakmaz.
- `ayarlar.sh`'taki `ONYUKLEME_KAPALI`, `SUREKLI_KAPAT`, `KAPATMA_DISI` —
  servisin TV'ye ne kadar karışacağı. Varsayılan: **hiçbir şeye dokunmaz.**
  Önyüklemeyi kapatmak RAM kazandırır ama uygulama ilk açılışta biraz geç
  gelir; HDMI girişlerinden yalnızca boş olanları yazın.

Konum için **mahalle seviyesinde** koordinat kullanın, şehir merkezi değil.
Bizde sahil ile iç kesim arasındaki gece sıcaklığı farkı 1 dereceydi ve
şehir merkezi koordinatı sürekli sapma veriyordu. [openstreetmap.org](https://www.openstreetmap.org)
üzerinde evinize sağ tıklayıp "show address" ile alabilirsiniz.

## 3 — Yedek alın

```bash
mkdir -p ~/lgtv-yedek && cd ~/lgtv-yedek
ssh-keygen -t ed25519 -f ~/.ssh/lgtv_root_ed25519 -N ''   # root anahtarı

# TV'den yedeklenecekler. Her kopya için başarılı/başarısız yazdırır —
# bir dosya 'prisoner' kullanıcısına kapalıysa onu görürsünüz, sessizce
# atlanmaz. blockedAppList önemli olan; lastinput her TV'de okunamayabilir.
for f in /var/preferences/com.webos.applicationManager/blockedAppList \
         /var/lib/eim/lastinput ; do
  if ares-shell -d tv -r "cat \"$f\" >/dev/null 2>&1 || ls \"$f\" >/dev/null 2>&1"; then
    scp -r -P 9922 prisoner@<TV_IP>:"$f" . && echo "yedeklendi: $f" || echo "ALINAMADI: $f"
  else
    echo "ERISILEMEDI (atlandi): $f"
  fi
done

# Bu paketin kendisini de yedeğe koyun (ayarlarınız ve yapilandirma.js ile).
# <paket-klasörü> = webos-sade'yi klonladığınız/çıkardığınız dizin.
cp -r <paket-klasörü> ./sade-paketi
ls -R
```

## 4 — Launcher'ı kurun (Dev Mode hâlâ sağken)

```bash
bash araclar/paketle.sh                    # .ipk üretir, ares gerektirmez
ares-install -d tv cikti/com.bilal.sade_*.ipk   # tv: 1b'de tanıttığınız cihaz
```

`paketle.sh` paketi `ares-package` olmadan üretiyor, çünkü bazı ares
sürümleri "isDate is not a function" ile çöküyor ve sizi daha ilk adımda
durduruyor. Ürettiği `.ipk`'nın iç ağacı ve ar çerçevelemesi `ares-package`
çıktısıyla **birebir aynı** (karşılaştırıldı). ares kuruluysa onu da
kullanabilirsiniz: `ares-package sade -o cikti`

> **Kontrol:** TV'nin uygulama listesinde "Sade" görünüyor. Açın. Hava
> durumu ve saat geliyor, kumanda okları ile dock'ta gezinebiliyorsunuz.
> Buraya kadar hiçbir geri dönüşsüz şey yapmadınız.

`ares-install` "isDate is not a function" ile çökerse ares sürümü bozuk —
5. adımdan sonra `araclar/kur.sh` bu işi root üzerinden yapacak, şimdilik
launcher'ı atlayıp devam edebilirsiniz.

---

## 5 — Dev Mode'u kaldır + kalıcı root  ⚠️ GERİ DÖNÜŞSÜZ

### 5a. Dev Mode uygulamasını TV'den kaldırın

TV'nin uygulama listesinden silin. **Root'tan önce.**

Sebebi: Dev Mode servisi 50 saatlik oturum sayacını yönetiyor ve oturum
bitince `rm -rf /var/luna/preferences/devmode_enabled` yapıyor. Kalıcılık
tam o yolun **dizin** olmasına dayanıyor; `-rf` dizini de siler. Uygulama
TV'de kalırsa kalıcılığı geri alabilecek tek bileşen o oluyor, ve dizin
gidince sonraki açılış `/media/developer`'ı siler — launcher'la birlikte.

Exploit'in yazarı da aynısını söylüyor: *"Do not install the LG Dev Mode
app while rooted."*

> **Kontrol:** `nc -z <TV_IP> 9922` artık başarısız (reboot sonrası kesin).

### 5b. Root ve kalıcılık

Ayrı belgede, adım adım: **[belgeler/ROOT.md](belgeler/ROOT.md)**.

Özeti: slopbro iki kez çalışıyor. Önce kendi `autoroot.sh`'ıyla (root +
Homebrew Channel; sonunda **"Don't reboot"**), sonra bu paketin
`araclar/root/kalicilik.sh`'ıyla (sizin SSH anahtarınız, sshd, güncelleme
bloğu, `/autostart` kaydı). Sonunda `araclar/root/dogrula.sh` kapısı,
reboot ve tekrar kapı.

> **Kapı geçmeden 6. adıma geçmeyin.**

Launcher'ı 4. adımda kuramadıysanız şimdi kurun:
```bash
bash araclar/paketle.sh && bash araclar/kur.sh cikti/com.bilal.sade_*.ipk
```

---

## 6 — HOME tuş kodunuzu ölçün

Bizde **773**, ama kumandaya göre değişebilir. Ölçün:

```bash
bash araclar/root-ssh.sh '
for d in /dev/input/event*; do
  node -e "
    var fs=require(\"fs\"), fd=fs.openSync(\"$d\",\"r\"), b=Buffer.alloc(16);
    setInterval(function(){ try{
      fs.readSync(fd,b,0,16,null);
      var t=b.readUInt16LE(8), c=b.readUInt16LE(10), v=b.readInt32LE(12);
      if(t===1&&v===1) console.log(\"$d kod=\"+c);
    }catch(e){} },50);
  " &
done
sleep 20; kill %1 2>/dev/null' &
# 20 saniye içinde kumandadan HOME tuşuna basın
```

Çıkan kodu `ayarlar.yerel.sh`'a `HOME_KODU=...` olarak yazın.

> `type@8 code@10 value@12` ofsetleri **32-bit ARM** için. TV'niz 64-bit ise
> `input_event` yapısı 24 bayt ve ofsetler kayar.

## 7 — Servisi kurun

```bash
for t in servis/test/*.js; do node "$t" || break; done
bash araclar/servis-kur.sh
```

Testler TV olmadan çalışır ve **hepsi geçmeli**. `servis-kur.sh`
ayarlardan `servis-ayar.json`'u üretir ve ekrana basar; kurmadan önce
okuyun. Geçmezse kurmayın —
bu testler bizde uygulamayı çökerten bir sonsuz döngüyü yakalamak için
yazıldı (bölüm "Neden bu testler var", aşağıda).

> **Kontrol:** HOME tuşuna **bir kez** basın. Sade açılmalı.
> Bir daha basın, bir daha açmalı. LG Home ile Sade arasında gidip gelme
> olursa **hemen** `pkill -f "node service.js"` yapın ve bize yazın.

## 8 — Quick Start+ açın — HOME tuşunun asıl çözümü bu

```bash
bash araclar/root-ssh.sh 'luna-send -n 1 -f \
  luna://com.webos.settingsservice/setSystemSettings \
  "{\"category\":\"option\",\"settings\":{\"quickStartMode\":\"on\"}}"'
```

Bu ayar kapalıyken TV beklemeden dönüşte **yeniden başlıyor**: servis ölüyor,
yeniden ~50. saniyede ayağa kalkıyor, o arada HOME çalışmıyor. Açıkken TV
hiç soğuk açılış yapmıyor, servis beklemede hayatta kalıyor, HOME ilk andan
çalışıyor.

Bizde bir gece (~9 saat bekleme) tuttu — servis aynı pid ile sabaha çıktı.
Bedeli: ölçümümüzde ~8 MB daha az boş RAM, swap kullanımı 97 → 156 MB.
Tek ölçüm, kesin konuşmuyoruz.

TV menüsünden de açılabilir: Ayarlar → Genel → Enerji Tasarrufu →
Hızlı Başlangıç+.

## 9 — Alexa + spor alarmını gizleyin (isteğe bağlı)

LG'nin kendi gizli uygulama listesine ekleniyor; sistem dosyasına
dokunulmuyor. Betik varsayılan olarak **yalnızca önizleme** yapar:

```bash
bash araclar/root/gizle.sh              # önce bakın: dosya, şimdiki liste, yeni liste
bash araclar/root/gizle.sh --uygula     # yaz + kilitle
bash araclar/root-ssh.sh reboot
```

Mevcut liste korunur, yalnızca `amazon.alexa.view`, `amazon.alexapr`,
`com.webos.app.sportsteamsettings` eklenir. Başka bir uygulamayı da
gizlemek isterseniz kimliğini sona yazın. İlk yazmada orijinal
`/var/lib/webos-debloat/<BÖLGE>.json.orig` olarak yedeklenir, geri almak
için `--geri-al`.

Betik GUVENLIK.md 1a'daki kimlikleri (`adoverlay*`, `acroverlay`,
`homeconnect`) **reddeder**. Root exploit'i bunların üzerinden giriyor.

> **Kontrol:** reboot sonrası
> `bash araclar/root-ssh.sh 'luna-send -i luna://com.webos.applicationManager/listLaunchPoints "{\"subscribe\":true}"' | head -1`
> Alexa ve Sports Alert listede olmamalı, **kullandığınız her uygulama
> listede olmalı**. Her birini bir kez açarak deneyin. INPUT tuşunu da.

webOS 6.5'te doğru anahtar `blocked_applist` (dosya `blockedAppList/`
altında). webOS 26 rehberlerindeki `blockedSystemAppList` yolu bu sürümde
**sessizce hiçbir şey yapmıyor**, uyguladığınızı sanırsınız.

## 10 — Yol durumu ve trafik haritası (isteğe bağlı)

İstanbul trafik endeksi widget'ı (`trafik`) anahtarsız çalışır. Kendi
güzergâhlarınızın canlı süresi (`yol`, `yolGenis`), köprü/tünel kapanmaları,
kontrol noktalı görünüm (`durak`, `durakGenis`) ve tam ekran harita
**TomTom** ister. Anahtar ücretsiz ve kendiniz alıyorsunuz:
**[belgeler/TOMTOM.md](belgeler/TOMTOM.md)** (hesap, anahtarı Mac'te deneme,
güzergâh dosyası, kurulum).

Anahtar ya da güzergâh dosyası yoksa bu widget'lar galeride hiç görünmez.

---

## İlk açılış — ana ekranı düzenleme

Ana ekranda üç bölge var: solda ve sağda 3'er satır, saatin altında
1 satırlık **orta alan**. Menüdeki **Widget** sekmesine gidin, bir widget
seçip OK'a basın. Çıkan sayfada "Sola / Ortaya / Sağa ekle" ya da
"… yerine" seçeneklerini göreceksiniz. Hava ve namaz vakitlerinin 2 satırlık
büyük ve 1 satırlık küçük hâli var. 2 satırlık widget'lar ve TV widget'ı
orta alana konamaz. Yerleşim TV'de saklanır, güncellemede kaybolmaz.

---

## Günlük kullanım

```bash
bash araclar/root-ssh.sh 'komut'                 # TV'ye komut
bash araclar/paketle.sh                          # launcher'ı paketle
bash araclar/kur.sh cikti/com.bilal.sade_*.ipk   # kur + sürümü doğrula
```

Denetim Merkezi'ndeki **Güç** karoları (Yeniden başlat · Tam kapat) ikinci
basışta çalışır; ilk basış "Emin misin?" diye sorar. Tam kapat, Quick Start+'ı
geçici olarak kapatıp LG'nin kendi kapatmasını kullanır (kumandayla açılır);
sonraki açılışta servis Quick Start+'ı geri açar.

`kur.sh` sürüm doğrulaması yapıyor çünkü kurulum servisi takılabiliyor ve
"başarılı" diyip eski sürümü bırakabiliyor. Takılırsa:
```bash
bash araclar/root-ssh.sh 'restart appinstalld'
```

## Güncelleme (eski Sade sürümünden)

Yerleşiminiz, dock'unuz ve temanız TV'de saklanıyor; güncelleme bunlara
dokunmaz.

```bash
# 1) ayarlar.yerel.sh ve sade/yapilandirma.js'i yeni pakete taşıyın.
#    (2.19.1'den eskiyse ayarlar.yerel.sh yoktu: değerlerinizi eski
#    ayarlar.sh'tan yeni ayarlar.yerel.sh'a yazın.) git kullanıyorsanız
#    git pull yeter, yerel dosya etkilenmez.
# 2) Uygulama
bash araclar/paketle.sh
bash araclar/kur.sh cikti/com.bilal.sade_*_all.ipk
# 3) Servis (servis dosyaları da değiştiyse — eski bir sürümden
#    geliyorsanız evet). Önce testler:
for t in servis/test/*.js; do node "$t" || break; done
bash araclar/servis-kur.sh
```

`kur.sh` uygulamayı başlatmaz, TV'de o an ne izleniyorsa önde kalır;
yeni sürüm bir sonraki HOME basışında açılır.

> **Kontrol:** `kur.sh` "OK — kurulu: 2.19.1" yazmalı. Yazmıyorsa:
> `bash araclar/root-ssh.sh 'restart appinstalld'` ve tekrar deneyin.

## Neden bu testler var

Servis bir noktada `luna-send` çıktısını bir tampona ekleyip **her yeni
veri parçasında tamponun tamamını baştan tarıyordu.** Eski `appId`
değerleri tekrar tekrar eşleşip her biri yeni bir komut tetikliyordu:
LG Home açılıyor, Sade açılıyor, LG Home açılıyor… ve uygulama çöküyordu.

Doğrusu tam JSON nesnelerini tampondan **söküp çıkarmak** (tüketmek).
`servis/test/ayristirici-testi.js` tam bunu test ediyor.

İkinci test (`tepki-testi.js`) devre kesiciyi doğruluyor. LG, HOME'u
yaklaşık 340 ms sonra yeniden sahipleniyor, bu yüzden servis bir basışa
3 kez tepki veriyor. Gerçek bir döngü ise **aynı milisaniyede** tekrar
ediyor — eşik bu ikisini ayırt edecek şekilde ayarlı (1 saniyede 6'dan
fazla → 30 saniye sus). Daha sıkı bir eşik normal kullanımı kesiyor.

## Sık karşılaşılan şeyler

| Belirti | Sebep |
|---|---|
| HOME'a basınca hiçbir şey olmuyor | `disableHome` `true` kalmış. GUVENLIK.md 4c. |
| Servis HOME'u görmüyor | Magic Remote sonradan başka bir `event*` düğümüne geçiyor. Servis 5 sn'de yeni aygıt tarıyor, 30 sn'de hepsini kapatıp açıyor — 30 sn bekleyin. |
| Launcher açılışta gelmiyor | Gelmiyor, gelemez. README "Ne vermiyor". |
| `luna-send -n 1` boş dönüyor | Bazı servisler yalnızca abonelik biçimine cevap veriyor: `-i ... "{\"subscribe\":true}"`. |
| Hava durumu Apple Weather'dan sapıyor | Koordinatınız mahalle seviyesinde mi? Şehir merkezi sistematik sapma veriyor. |
| Araçlar aniden TV'yi bulamıyor | DHCP kirası kaymıştır. `araclar/tv-ip.sh` MAC'ten bulur; `ayarlar.yerel.sh`'taki `TV_MAC` doğru mu? TV hem kablo hem Wi-Fi'deyse iki MAC'i de yazın. |
| Klima/cihaz widget'ları kayboldu | `homeconnect` bulut oturumunu kaybetmiştir (IP değişimi tipik sebep). Servisi yeniden başlat: `bash araclar/root-ssh.sh 'kill $(pgrep -f com.webos.service.homeconnect)'` |
| Launcher öndeyken HOME'a basınca donuyordu | Düzeltildi — zaten önde olan uygulama tekrar `launch` edilmiyor (`servis/acilma-karari.js`). |
