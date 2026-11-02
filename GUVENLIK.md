# Güvenlik, riskler ve geri alma

**Kuruluma başlamadan bunu sonuna kadar okuyun.** Aşağıdaki uyarıların her
biri bizim gerçekten çarptığımız bir duvardan geliyor.

---

## 1. Asla yapmayın

### 1a. Reklam katmanı uygulamalarını gizli uygulama listesine EKLEMEYİN

```
com.webos.app.adoverlayex     ← ASLA
com.webos.app.adoverlay       ← ASLA
com.webos.app.acroverlay      ← ASLA
```

Bunlar reklam uygulamaları, gizlemek mantıklı görünüyor. **Ama root
exploit'i tam bu uygulamaların üzerinden giriyor.** Gizlerseniz bir daha
root alamazsınız — ve gizli uygulama listesini geri almak için root
gerekiyor. Çıkış yolu yalnızca fabrika ayarlarına dönmek olur.

`com.webos.app.homeconnect` de eklenmemeli (ThinQ cihaz bağlantısı).

### 1b. `lginputhook` KURMAYIN

HOME tuşunu yakalamak için önerilen bir araç. Güncel sürümü `tvservice`
sürecini çökertiyor: **video oynatmama, reboot döngüsü, ses DSP kilidi** —
iki ayrı modelde doğrulanmış, GitHub issue'su açık, düzeltmesi yok, hangi
sürece enjekte edileceği de seçilemiyor. Micom reset gerektiriyor.

Bu paket HOME tuşunu `/dev/input` okuyarak çözüyor — enjeksiyon yok.

### 1c. `start-devmode.sh` dosyasına dokunmayın

İmzalı. İmza bozulursa firmware geliştirici modunu kapatır ve
`/media/developer` **silinir** — launcher'ınızla birlikte. Kurulumdan önce
imzayı doğrulayın, `Verified OK` görmeniz gerekiyor (KURULUM.md adım 1).

---

## 2. Geri dönüşsüz olan tek adım

**LG Dev Mode uygulamasını kaldırmak.**

Kaldırdıktan sonra 9922 portundaki SSH kapanır. Launcher'ı kurmanın/
güncellemenin tek yolu root SSH olur. Yani:

> Dev Mode'u kaldırmadan önce root SSH'in çalıştığından emin olun.
> Sırayı karıştırırsanız iki kapı birden kapanır.

Bizde bu neredeyse ters gitti — kurulum scriptimiz 9922 üzerinden `scp`
yapıyordu, Dev Mode gidince araç elimizde kalıyordu. KURULUM.md'deki sıra
bu yüzden böyle.

Diğer her şey geri alınabilir (bölüm 4).

---

## 3. Ne kaybediyorsunuz

| Kayıp | Ayrıntı |
|---|---|
| Geliştirici modu | Kalıcı olarak. Uygulama kurmak root SSH ile. |
| Yazılım güncellemeleri | `webosbrew_block_updates` ile bloklu. Güncelleme root'u siler. |
| Garanti | Resmî olmayan değişiklik. |
| Netflix/Disney+ | **Kaybedilmiyor** — bizde root sonrası sorunsuz çalıştı. DRM etkilenmiyor. |

## 3b. Ağ güvenliği — bunu atlamayın

Root kurulumu TV'de **sshd'yi açık bırakıyor.** Yani ev ağınızdaki her
cihaz TV'ye bağlanmayı deneyebilir.

- Kurulumda **mutlaka kendi SSH anahtarınızı** üretin. Paylaşılan bir
  anahtar kullanmayın; bu pakette anahtar **yok**, olmaması gerekiyor.
  `araclar/root/hazirla.sh` TV'ye yalnızca sizin **açık** anahtarınızı
  (`.pub`) yazar.
- Kişisel değerler (IP, MAC, TomTom anahtarı) `ayarlar.yerel.sh`'ta durur
  ve `.gitignore`'dadır. Paketi başkasına verirken o dosyayı vermeyin.
  slopbro'nun eşleştirme anahtarı (`<TV_IP>.key`) da kişiseldir.
- Homebrew Channel varsayılan `alpine` şifresine düşmesin — anahtar
  kurulduktan sonra şifreyle girişin kapalı olduğunu doğrulayın.
- TV'yi internete açık port yönlendirmesi arkasına **koymayın**.
- Telnet kapalı kalsın (`webosbrew_telnet_disabled`).

### Servisin açtığı yerel köprü (port 9123)

Root servis, TV'nin **kendi içinde** `127.0.0.1:9123` üzerinde küçük bir HTTP
ucu açıyor. Gerekçesi: geliştirici olarak kurulan uygulamalara TV yalnızca
`public` yetki grubunu veriyor; `settingsservice`, uygulama listesi, sistem
durumu gibi şeyler onlara kapalı. Servis root olduğu için okuyabiliyor ve
Sade'ye bu köprüden veriyor.

Bu bir **root sürecinde açılan ağ ucu**, o yüzden kasıtlı olarak dar tutuldu:

- yalnızca `127.0.0.1`'e bağlanıyor, **LAN'dan erişilemez** (doğrulayın:
  başka bir makineden `curl http://TV_IP:9123/sistem` **bağlanamamalı**)
- **anahtar istiyor.** Servis ilk açılışta rastgele bir anahtar üretip
  saklar (0600) ve Sade'nin klasörüne yazar. Sade onu `file://` ile okur;
  TV'de açılan bir web sayfası (`http(s)`) okuyamaz, dolayısıyla köprüyü
  kullanamaz. `Host` başlığı da `127.0.0.1:9123` olmalı (DNS rebinding'e karşı).
- sabit bir uç listesi var (parlaklık, sistem, uygulamalar, ikon, ekran
  süresi, uyku, film modu, güç, piyasa, trafik, güzergâh, harita karosu).
  Genel bir komut ucu **değil**; başka her yol `{"hata":"bilinmeyen uc"}` döner.
- kabuk kullanmıyor (`execFile` + dizi argüman); dışarıdan gelen her değer
  ya sayıya kıstırılıyor, ya sabit bir listeden seçiliyor, ya da sıkı bir
  desenle doğrulanıyor (uygulama kimliği: `[A-Za-z0-9._-]`)
- `Access-Control-Allow-Origin` başlığı yok

Kalan risk: TV'de kurulu **başka bir web uygulaması** da `file://` okuyabiliyor
olabilir. Bunlar sizin kurduğunuz uygulamalar.

İstemiyorsanız `servis/service.js` içinde `kopruBaslat()` çağrısını silin;
uygulama köprüyü bulamayınca ona bağlı parçaları (menü çubuğu, TV durumu,
yol durumu…) gizler, gerisi çalışır.

---

## 4. Geri alma

### 4a. Root'u geri al
```bash
# SSH anahtarını kaldır
bash araclar/root-ssh.sh 'rm -f /home/root/.ssh/authorized_keys'
# sshd'yi kapat, güncelleme bloğunu kaldır
bash araclar/root-ssh.sh 'rm -f /var/luna/preferences/webosbrew_sshd_enabled \
                                /var/luna/preferences/webosbrew_block_updates'
```

### 4b. Gizli uygulama listesini geri al
`araclar/root/gizle.sh` ilk yazmada orijinali
`/var/lib/webos-debloat/<BÖLGE>.json.orig` olarak yedekliyor:
```bash
bash araclar/root/gizle.sh --geri-al
bash araclar/root-ssh.sh reboot
```
Elle yapmak isterseniz (`TUR` yerine kendi bölgenizi yazın):
```bash
bash araclar/root-ssh.sh '
  R=/var/preferences/com.webos.applicationManager/blockedAppList
  chattr -i $R/TUR.json
  cp /var/lib/webos-debloat/TUR.json.orig $R/TUR.json'
```

### 4c. HOME devralmasını geri al — dört adımı BİRLİKTE yapın
```bash
bash araclar/root-ssh.sh '
  rm -f /var/lib/webosbrew/init.d/50-sade          # 1 boot kancası
  pkill -f "node service.js"                       # 2 servis (çıkışta disableHome=false yazar)
  luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
    "{\"category\":\"option\",\"settings\":{\"quickStartMode\":\"off\"}}"   # 3 isterseniz
  '
```
Servisi `pkill -9` ile değil normal sinyalle öldürün — `disableHome=false`
yazması gerekiyor. Yoksa HOME tuşu hiçbir şey açmaz. Böyle olursa:
```bash
bash araclar/root-ssh.sh 'luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
  "{\"category\":\"option\",\"settings\":{\"disableHome\":\"false\"}}"'
```

### 4d. Boot kilitlenirse
Homebrew Channel'ın failsafe'i var: TV açılırken **kumandadan 1-2-3-4**
tuşlarına basın, kancalar atlanır.

### 4e. Son çare
Fabrika ayarlarına dönüş. Ayarlar → Genel → Sıfırla. Root ve launcher gider,
TV kurtulur.

---

## 5. Kurulum öncesi yedek — bunu atlamayın

Biz kuruluma girmeden önce 91 dosyalık bir yedek aldık ve iyi ki aldık:
root exploit'i bir kez çöktü, elimizde orijinal dosyaların sha256'ları
olduğu için hangi dosyanın sağlam kaldığını doğrulayabildik.

Yedeklenmesi gerekenler:
```
- launcher kaynağı + kurulabilir .ipk  (Dev Mode gidince eski kurulum yolu kapanır)
- ürettiğiniz SSH anahtarları
- /var/preferences/com.webos.applicationManager/blockedAppList/<BÖLGE>.json
- /var/lib/eim/lastinput
- exploit scriptlerinin sha256'ları
```

---

## 6. Doğrulanmamış bırakılanlar

Dürüst olmak gerekirse bu listeyi de taşıyoruz:

- **Quick Start+ ne kadar tutuyor?** LG belgelemiş değil. Bizde bir gece
  (~9 saat bekleme) tuttu — servis aynı pid'le hayatta kaldı. Daha uzun
  süre ölçülmedi. Tutmazsa en kötü senaryo eski davranış: soğuk açılış,
  servis ~50. saniyede ayakta, HOME ilk basışta gecikebilir.
- **HOME tuş kodu** bizim kumandada 773. Başka kumandada farklı olabilir,
  kurulumda ölçülüyor (KURULUM.md adım 6).
- **Bölge dosyası adı** bizde `TUR.json`. Sizde farklı olacak.
- **webOS 6.5.3 dışı sürümler** test edilmedi.
- **`araclar/paketle.sh`** artık TV'de doğrulandı (25 Ekim): ürettiği
  `.ipk` ayrı bir app id ile kurulup silindi, kurulum servisi kabul etti.
  İlk sürümü reddediliyordu (`ipk verified failed`, `errorCode -5`) çünkü
  macOS `tar`'ı girdileri `./usr/...` diye yazıyordu; artık üst dizin
  açıkça veriliyor ve girdiler `usr/...` biçiminde.
