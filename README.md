# Sade — LG webOS için sade bir ana ekran

LG OLED TV'nin reklam dolu ana ekranı yerine kendi başlattığınız, hızlı,
sadece sizin kullandığınız uygulamaları gösteren bir launcher. Yanında
istediğiniz widget'lar: hava durumu, namaz vakitleri, LG ThinQ cihazlarınız,
TV'nin kendi durumu ve daha fazlası.

HOME tuşuna bastığınızda LG'nin ekranı değil bu ekran açılır.

**Sürüm 2.19.1** · Kurulum: **[KURULUM.md](KURULUM.md)** (sıfırdan root,
zaten root'lu TV için kısa yol ve eski sürümden güncelleme orada).

```bash
git clone https://github.com/bilalkan/webos-sade && cd webos-sade
```

![Sade ana ekranı: hava durumu, saat, namaz vakitleri, yol durumu, TV durumu ve dock](belgeler/ekran.jpg)

*Gerçek TV ekranı (LG OLED55B16LA). Yerleşim, widget'lar ve dock kumandayla değiştirilebilir.*

## Ne veriyor

| | |
|---|---|
| **Kendi ana ekranı** | HOME tuşu LG Home yerine burayı açıyor |
| **Widget galerisi** | Ana ekranda sol ve sağ 3'er satır, saatin altında 1 satırlık orta alan; hangi widget nerede, kumandayla siz seçiyorsunuz. Hava ve namazın 2 satırlık büyük ve 1 satırlık küçük hâli var |
| **Hava durumu** | 5 modelin ortalaması (Open-Meteo), saatlik + 7 gün |
| **Namaz vakitleri** | Diyanet hesabı, bir sonraki vakte geri sayım |
| **LG ThinQ cihazları** | Klima (aç/kapa, sıcaklık, mod), çamaşır, buzdolabı, bulaşık. Evinizde olmayanın widget'ı hiç görünmez, yer de kaplamaz |
| **TV durumu** | RAM, CPU, açık uygulamalar; arka planı tek tuşla kapatma |
| **Ekran süresi · Uyku · Film modu** | Bugün TV'de ne kadar, neye bakıldı; uyku zamanlayıcı; tek tuşla sinema görüntü/ses modu |
| **Piyasalar · Trafik** | Altın, gümüş, döviz, BIST 100; İstanbul trafik endeksi (Türkiye'ye / İstanbul'a özel) |
| **Yol durumu** | Seçtiğiniz güzergâhlarda canlı trafikle süre ve gecikme, tam ekran harita; köprü/tünel kapanınca (maraton, bakım) "Kapalı" yazar. TomTom, kendi ücretsiz anahtarınızla; isteğe bağlı ([belgeler/TOMTOM.md](belgeler/TOMTOM.md)) |
| **Menü çubuğu** | Saat, hava, ses, Bluetooth, Wi-Fi, parlaklık, Denetim Merkezi — hepsi çalışır |
| **Güç** | Denetim Merkezi'nden yeniden başlat ya da tam kapat. Quick Start+ açıkken TV hiç soğuk açılmıyor, saatler içinde bellek ve takas birikiyor; tam kapatma Quick Start+'ı bir kerelik kapatıp sonraki açılışta geri açar (kök servis gerekir) |
| **Uygulamalar** | TV'de yüklü olanlar kendiliğinden gelir (simgeleri TV'nin kendisinden); dock'u siz düzenlersiniz |
| **Tema** | Açık, koyu ya da gün doğumu/batımına göre otomatik |
| **Alexa + spor alarmı** | Ana ekrandan kaldırılabiliyor |
| **Açılışta doğrudan** | TV açılınca canlı TV yerine bu ekran gelebiliyor |

Menü çubuğu, TV durumu, ekran süresi, uyku, film modu, piyasalar, trafik, yol
durumu ve yüklü uygulama listesi **kök servisle** çalışır (KURULUM adım 7). Servis
yoksa bu parçalar gizlenir; yanıltıcı düğme gösterilmez.

## Ne vermiyor — baştan bilin

- **Açılış ~25 saniye sürüyor** (yalnızca gerçek reboot/elektrik kesintisinde).
  TV'nin kendi web motoru `WebAppMgr` 21. saniyede başlıyor, uygulama 25'te
  doğuyor; uygulamanın kendi payı yarım saniyeden az (ölçüldü). Daha erkeye
  çekmek imzalı `start-devmode.sh`'a dokunmayı gerektiriyor — o kapı kapalı.
  Günlük kullanımda Quick Start+ sayesinde TV sıcak dönüyor ve Sade neredeyse
  anında geliyor; yavaş yol nadir olan yol.
- **Geliştirici modunu kaybediyorsunuz.** Kalıcı root için LG Dev Mode
  uygulamasını kaldırmak gerekiyor. Sonrasında uygulama kurma/güncelleme
  yalnızca root SSH üzerinden olur — bu paketteki `araclar/kur.sh` onu yapar.
- **Yazılım güncellemeleri bloklanıyor.** Root'un hayatta kalma şartı bu.
- **Garanti.** Resmî olmayan değişiklik yapıyorsunuz.
- **Bazı widget'lar bölgeye özel.** Namaz vakitleri Diyanet hesabıyla gelir
  (yapilandirma.js'ten değişir); piyasalar Türkiye, trafik yalnızca İstanbul
  içindir. Piyasa verisinin kaynağı (finans.truncgil.com) resmî değildir.

## Nereden başlanır

1. **[GUVENLIK.md](GUVENLIK.md)** — önce bunu okuyun. Hangi adım geri
   dönüşsüz, ne kaybediyorsunuz, nasıl geri alınır.
2. **[KURULUM.md](KURULUM.md)** — adım adım kurulum.
   - **[belgeler/ROOT.md](belgeler/ROOT.md)** — kalıcı root, adım adım
     (5. adımın ayrıntısı)
   - **[belgeler/TOMTOM.md](belgeler/TOMTOM.md)** — trafik için ücretsiz
     anahtarı alma ve kurma (isteğe bağlı)
3. **[CLAUDE-PROMPT.md](CLAUDE-PROMPT.md)** — kurulumu Claude'a yaptırmak
   isterseniz bu dosyanın içeriğini ona verin.

## Doğrulandığı donanım

```
LG OLED55B16LA · webOS 6.5.3 · firmware 03.53.45 · Chromium 79 · ARM 32-bit
```

Salt-okur uyumluluk ölçümü (Sade'nin kullandığı 16 luna ucunun hepsi root'ta
çalışıyor; Sade 2.x bu TV'de henüz denenmedi):

```
LG 55NANO766QA · webOS 7.6.0 (TV Lite) · firmware 04.60.91 · Chromium 87
node 12 · aarch64 çekirdek, 32-bit kullanıcı alanı · 1,2 GB RAM · SlopBro root
```

Launcher her webOS 5+ TV'de çalışmalı (sadece web uygulaması). Root ve HOME
tuşu kısmı webOS 6.x için yazıldı; başka sürümde exploit zinciri farklı olur.
webOS'u lisansla kullanan başka markaların TV'leri (webOS Hub) hiç denenmedi.

## Paketin içindekiler

```
ayarlar.yerel.ornek.sh  ← KOPYALAYIP DÜZENLEYİN: cp ... ayarlar.yerel.sh
                          (IP, MAC, HOME kodu, TomTom anahtarı — git'e girmez)
ayarlar.sh              varsayılanlar ve açıklamalar; servisin TV'ye ne kadar
                          karışacağı (varsayılan: hiç)
sade/                   launcher — webOS uygulaması
  yapilandirma.js       ← konum, namaz yöntemi; istersen ilk yerleşim,
                          uygulama listesi, dock, tema
servis/                 HOME tuşunu yakalayan ve köprüyü sunan root servisi
  test/                 birim testler (node ile çalışır, TV gerekmez)
araclar/
  tv-ip.sh              TV'yi MAC'ten bulur (IP kaysa da çalışır)
  paketle.sh            launcher'ı .ipk yap (ares gerekmez)
  root-ssh.sh           TV'ye komut çalıştır
  kur.sh                launcher'ı kur + sürümü doğrula
  servis-kur.sh         servisi kur + boot kancasını bağla
  servis-yeniden.sh     servisi güvenle yeniden başlat
  root/
    hazirla.sh          slopbro'nun kalıcılık koşusunu hazırlar (anahtarınızla)
    kalicilik.sh        TV'de root olarak çalışan kalıcılık betiği
    dogrula.sh          kalıcı root kapısı (yalnızca okur)
    gizle.sh            Alexa / spor alarmını gizle (önizlemeli)
belgeler/
  ROOT.md               kalıcı root, adım adım
  TOMTOM.md             trafik anahtarı
  NASIL-CALISIYOR.md    mekanizma notları
  guzergah-ornek.json   örnek güzergâhlar (İstanbul, altı Boğaz geçişi)
  ekran.jpg             README'deki ekran görüntüsü
```

## Lisans ve kaynaklar

Bu paketteki kod MIT ([LICENSE](LICENSE)). slopbro pakette yok, kendiniz
klonluyorsunuz. Dayandığı işler:

- [webosbrew/Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel) — kalıcılık altyapısı
- [throwaway96/slopbro](https://github.com/throwaway96/slopbro) — webOS 6 root exploit'i
- [hbertsch/lgtv-webos-root-launcher](https://github.com/hbertsch/lgtv-webos-root-launcher) — HOME tuşu devralma yöntemi
- [Open-Meteo](https://open-meteo.com/) · [Aladhan](https://aladhan.com/prayer-times-api) — hava ve namaz verisi
- [finans.truncgil.com](https://finans.truncgil.com/) (resmî değil) · [İBB](https://api.ibb.gov.tr/) — piyasa ve trafik verisi
- [TomTom](https://developer.tomtom.com/) Routing · Traffic Incidents · Map Display — yol süresi, kapanmalar, harita (kendi ücretsiz anahtarınızla)

Uygulama simgeleri pakette dağıtılmıyor; TV'nin kendi kayıtlarından okunuyor.
