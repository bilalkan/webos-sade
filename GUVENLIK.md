# Güvenlik, riskler ve geri alma

**Kuruluma başlamadan bunu sonuna kadar okuyun.** Aşağıdaki uyarıların her
biri bizim gerçekten yaşadığımız bir sorundan geliyor.

---

## 1. Asla yapmayın

### 1a. Reklam katmanı uygulamalarını gizli uygulama listesine EKLEMEYİN

```
com.webos.app.adoverlayex     ← ASLA
com.webos.app.adoverlay       ← ASLA
com.webos.app.acroverlay      ← ASLA
```

Bunlar reklam uygulamaları, gizlemek mantıklı görünüyor. **Ama root yöntemi
tam da bu uygulamaları kullanıyor.** Gizlerseniz bir daha root alamazsınız;
gizli uygulama listesini geri almak için de root gerekir. Tek çıkış yolu
fabrika ayarlarına dönmektir.

`com.webos.app.homeconnect` de eklenmemeli (ThinQ cihaz bağlantısı).

### 1b. `lginputhook` KURMAYIN

HOME tuşunu yakalamak için önerilen bir araç. Güncel sürümü `tvservice`
sürecini çökertiyor: **video oynatmama, yeniden başlatma döngüsü, ses DSP
kilidi.** İki ayrı modelde görülmüş, GitHub issue'su açık ve düzeltilmemiş;
hangi sürece enjekte edileceği de seçilemiyor. Kurtarmak için Micom reset
gerekiyor.

Bu paket HOME tuşunu `/dev/input` okuyarak yakalıyor; enjeksiyon yok.

### 1c. `start-devmode.sh` dosyasına dokunmayın

İmzalı. İmza bozulursa firmware geliştirici modunu kapatır ve
`/media/developer` launcher'ınızla birlikte **silinir**. Kurulumdan önce
imzayı doğrulayın; `Verified OK` görmelisiniz (KURULUM.md 1. adım).

---

## 2. Geri dönüşsüz olan tek adım

**LG Dev Mode uygulamasını kaldırmak.**

Kaldırdıktan sonra 9922 portundaki SSH kapanır ve launcher'ı kurmanın ya da
güncellemenin tek yolu root SSH olur. Yani:

> Dev Mode'u kaldırmadan önce root SSH'in çalıştığından emin olun.
> Sırayı karıştırırsanız TV'ye erişimin iki yolu da kapanır.

Bizde bu neredeyse oluyordu: kurulum betiğimiz 9922 üzerinden `scp`
yapıyordu ve Dev Mode gidince işe yaramaz hâle geldi. KURULUM.md'deki sıra
bu yüzden böyle.

Diğer her şey geri alınabilir (bölüm 4).

---

## 3. Ne kaybediyorsunuz

| Kayıp | Ayrıntı |
|---|---|
| Geliştirici modu | Kalıcı olarak. Uygulama kurmak root SSH ile yapılır. |
| Yazılım güncellemeleri | `webosbrew_block_updates` ile kapalı. Güncelleme root'u siler. |
| Garanti | Resmî olmayan değişiklik. |
| Netflix/Disney+ | **Kaybedilmiyor.** Bizde root sonrası sorunsuz çalıştı, DRM etkilenmedi. |

## 3b. Ağ güvenliği: bunu atlamayın

Root kurulumu TV'de **sshd'yi açık bırakır**; ev ağınızdaki her cihaz
TV'ye bağlanmayı deneyebilir.

- Kurulumda **mutlaka kendi SSH anahtarınızı** üretin, paylaşılan bir
  anahtar kullanmayın. Bu pakette anahtar **yok**.
  `araclar/root/hazirla.sh` TV'ye yalnızca sizin **açık** anahtarınızı
  (`.pub`) yazar.
- Kişisel değerler (IP, MAC, TomTom anahtarı) `ayarlar.yerel.sh`'ta durur
  ve `.gitignore`'dadır. Paketi başkasına verirken o dosyayı vermeyin.
  slopbro'nun eşleştirme anahtarı (`<TV_IP>.key`) da kişiseldir.
- Homebrew Channel'ın varsayılan şifresi (`alpine`) geçerli kalmasın:
  anahtar kurulduktan sonra şifreyle girişin kapalı olduğunu doğrulayın.
- Modemde TV'ye **port yönlendirmesi yapmayın**; TV internete açık olmasın.
- Telnet kapalı kalsın (`webosbrew_telnet_disabled`).

### Servisin açtığı yerel köprü (port 9123)

Root servisi, TV'nin **kendi içinde** `127.0.0.1:9123` üzerinde küçük bir HTTP
ucu açar. Gerekçesi: TV, geliştirici olarak kurulan uygulamalara yalnızca
`public` yetki grubunu veriyor; `settingsservice`, uygulama listesi, sistem
durumu gibi bilgiler onlara kapalı. Servis root olduğu için bunları okuyup
köprü üzerinden Sade'ye verir.

Bu, **root sürecinde açılan bir ağ ucu**; bu yüzden bilerek dar tutuldu:

- yalnızca `127.0.0.1`'i dinler, **yerel ağdan erişilemez** (doğrulayın:
  başka bir makineden `curl http://TV_IP:9123/sistem` **bağlanamamalı**)
- **anahtar ister.** Servis ilk açılışta rastgele bir anahtar üretip
  saklar (0600) ve Sade'nin klasörüne yazar. Sade onu `file://` ile okur;
  TV'de açılan bir web sayfası (`http(s)`) okuyamaz, bu yüzden köprüyü
  kullanamaz. Anahtar her kurulumda farklıdır, kodda yazılı değildir. `Host` başlığı da `127.0.0.1:9123` olmalı (DNS rebinding'e karşı).
- sabit bir uç listesi vardır (parlaklık, sistem, uygulamalar, ikon, ekran
  süresi, uyku, film modu, güç, piyasa, trafik, güzergâh, harita karosu).
  Genel bir komut ucu **değildir**; başka her yol `{"hata":"bilinmeyen uc"}` döner.
- kabuk kullanmaz (`execFile` ve dizi argüman); dışarıdan gelen her değer
  ya bir aralığa sıkıştırılır, ya sabit bir listeden seçilir, ya da sıkı bir
  desenle doğrulanır (uygulama kimliği: `[A-Za-z0-9._-]`)
- `Access-Control-Allow-Origin` başlığı göndermez

Kalan risk: TV'de kurulu **başka bir web uygulaması** da `file://` okuyabilir.
Bunlar sizin kurduğunuz uygulamalardır.

Köprüyü istemiyorsanız `servis/service.js` içinde `kopruBaslat()` çağrısını
silin. Sade köprüyü bulamayınca ona bağlı parçaları (menü çubuğu, TV durumu,
yol durumu…) gizler, gerisi çalışır.

---

## 4. Geri alma

### 4a. Root'u geri alma
```bash
# SSH anahtarını kaldır
bash araclar/root-ssh.sh 'rm -f /home/root/.ssh/authorized_keys'
# sshd'yi kapat, güncelleme bloğunu kaldır
bash araclar/root-ssh.sh 'rm -f /var/luna/preferences/webosbrew_sshd_enabled \
                                /var/luna/preferences/webosbrew_block_updates'
```

### 4b. Gizli uygulama listesini geri alma
`araclar/root/gizle.sh` ilk yazmada orijinali
`/var/lib/webos-debloat/<BÖLGE>.json.orig` olarak yedekler:
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

### 4c. HOME devralmasını geri alma: adımları BİRLİKTE yapın
```bash
bash araclar/root-ssh.sh '
  rm -f /var/lib/webosbrew/init.d/50-sade          # 1 boot kancası
  pkill -f "node service.js"                       # 2 servis (çıkışta disableHome=false yazar)
  luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
    "{\"category\":\"option\",\"settings\":{\"quickStartMode\":\"off\"}}"   # 3 isterseniz
  '
```
Servisi `pkill -9` ile değil normal sinyalle durdurun: kapanırken
`disableHome=false` yazması gerekiyor, yoksa HOME tuşu hiçbir şey açmaz.
Böyle olursa:
```bash
bash araclar/root-ssh.sh 'luna-send -n 1 -f luna://com.webos.service.config/setConfigs \
  "{\"configs\":{\"com.webos.surfacemanager.disableHome\":false}}"'
```

### 4d. Açılış kilitlenirse
Homebrew Channel'ın kurtarma modu var: TV açılırken **kumandadan 1-2-3-4**
tuşlarına basın, açılış kancaları atlanır.

### 4e. Son çare
Fabrika ayarlarına dönün: Ayarlar → Genel → Sıfırla. Root ve launcher gider,
TV kurtulur.

---

## 5. Kurulum öncesi yedek: bunu atlamayın

Kuruluma başlamadan önce 91 dosyalık bir yedek aldık ve iyi ki almışız:
root işlemi bir kez yarıda çöktü; elimizde orijinal dosyaların sha256'ları
olduğu için hangi dosyanın sağlam kaldığını doğrulayabildik.

Yedeklenmesi gerekenler:
```
- launcher kaynağı ve kurulabilir .ipk  (Dev Mode gidince kolay kurulum yolu kapanır)
- ürettiğiniz SSH anahtarları
- /var/preferences/com.webos.applicationManager/blockedAppList/<BÖLGE>.json
- /var/lib/eim/lastinput
- slopbro dosyalarının sha256'ları
```

---

## 6. Doğrulanmamış olanlar

- **Quick Start+ ne kadar dayanıyor?** LG bunu belgelememiş. Bizde bir
  gecelik (~9 saat) beklemede servis aynı süreçle ayakta kaldı; daha uzun
  süre ölçülmedi. Dayanmazsa en kötü durum eski davranıştır: soğuk açılış,
  servis ~50. saniyede açılır, HOME ilk basışta gecikebilir.
- **HOME tuş kodu** bizim kumandada 773. Başka kumandada farklı olabilir;
  kurulumda ölçülür (KURULUM.md 6. adım).
- **Bölge dosyasının adı** bizde `TUR.json`, sizde farklı olabilir.
- **webOS 6.5.3 dışı sürümler** test edilmedi.
- **`araclar/paketle.sh`** TV'de doğrulandı: ürettiği `.ipk` ayrı bir
  uygulama kimliğiyle kurulup silindi. (İlk sürümü `ipk verified failed`
  hatası veriyordu, çünkü macOS `tar`'ı girdileri `./usr/...` diye
  yazıyordu; düzeltildi.)
