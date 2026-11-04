# Kalıcı root — adım adım

Bu belge KURULUM.md'nin **5. adımının** ayrıntısıdır. Anlatılan yöntem bir
LG OLED55B16LA'da (webOS 6.5.3, firmware 03.53.45) baştan sona uygulandı ve
yeniden başlatma sonrası doğrulandı. Başka sürümlerde aynı çalışacağının
garantisi yok.

Başlamadan:

- [GUVENLIK.md](../GUVENLIK.md) okunmuş olmalı.
- KURULUM.md **1–4** bitmiş olmalı: imza kontrolü `Verified OK` verdi,
  yedek alındı, launcher Dev Mode ile kurulup denendi, firmware'in
  slopbro ile uyumlu olduğu kontrol edildi (1a).
- İşlem TV'nin ekranını birkaç dakika kaplar; evde kimse bir şey
  izlemiyorken yapın.

## Neden iki aşamalı

```
Aşama A  slopbro + kendi autoroot.sh'ı    devmode_enabled DOSYA → DİZİN
                                          Homebrew Channel 0.7.3 kurulur
         ── burada reboot ETMEYİN ──      kalıcılık henüz YOK
Aşama B  slopbro + bu paketin              sizin SSH anahtarınız
         kalicilik.sh'ı                    sshd / güncelleme bloğu / telnet kapalı
                                          startup.sh + init.d
                                          /autostart kaydı   ← zorunlu adım
Kontrol  dogrula.sh, reboot, dogrula.sh
```

[slopbro](https://github.com/throwaway96/slopbro)'nun kendi `autoroot.sh`'ı
TV'yi rootluyor ve Homebrew Channel'ı kuruyor, ama **kalıcılık kaydını
yapmıyor**. Bizde A'dan hemen sonra `/var/lib/webosbrew` yoktu, bayraklar
boştu, 22 portu kapalıydı; o anda yeniden başlatılsaydı root gidecekti.
Aşama B bu eksiği kapatıyor. Yaptığı iş,
[hbertsch/lgtv-webos-root-launcher](https://github.com/hbertsch/lgtv-webos-root-launcher)'ın
`phase1-bootstrap.sh`'ının yaptığıyla aynı.

slopbro bu pakette **dağıtılmıyor** (AGPL-3.0). Kendiniz klonluyorsunuz;
paket onu değiştirmiyor, yanında bir kopyasını açıyor.

---

## 0 — Dev Mode uygulamasını kaldırın  ⚠️ geri dönüşsüz

KURULUM.md 5a'daki gerekçeyle, TV'nin uygulama listesinden **LG Dev Mode**'u
root'tan **önce** silin.

Bundan sonra 9922 portu ve `ares-install` yolu kapanır; root kurulana kadar
TV'ye yalnızca slopbro ile erişilir.

> **Kontrol:** `nc -z -w 3 <TV_IP> 9922 || echo kapali` → `kapali`

## A — slopbro ile root

```bash
git clone https://github.com/throwaway96/slopbro ~/slopbro
cd ~/slopbro
shasum -a 256 slopbro.py
```

Bizim kullandığımız sürüm:

```
slopbro.py   1a64f7050b3682ab1ac50a3e2998946a93c07abba0dffca0c4b8afc77403d75f
autoroot.sh  16bedff5ee8f8c754e6e302e3251dfc904f6aa7ca71c0b0483f7e5fc6bbb3611
```

Sizinki farklıysa slopbro güncellenmiş demektir. Bu kendi başına kötü değil,
ama değişikliklere bir göz atın: aşağıdaki davranış (özellikle yeniden
başlatma sorusu) değişmiş olabilir.

Mac'in IP'sini bulun ve çalıştırın:

```bash
ipconfig getifaddr en0            # Linux: hostname -I
python3 -I slopbro.py --webos-version 6 --local-ip <MAC_IP> <TV_IP>
```

1. TV'de eşleştirme isteği çıkar; **kabul edin**. slopbro eşleştirme
   anahtarını klasöre `<TV_IP>.key` olarak yazar. Bu dosya kişiseldir,
   paylaşmayın.
2. TV slopbro'nun sayfasını açar ve sayfa `autoroot.sh`'ı root olarak
   çalıştırır. Bu birkaç dakika sürebilir.
3. Sonunda TV'de *"Rooting complete … Would you like to reboot now?"*
   mesajı çıkar.

> **"Don't reboot" seçin.** Kalıcılık kaydı henüz yok; şimdi yeniden
> başlatırsanız root gider ve A'yı tekrarlamanız gerekir.

Mesaj geldikten sonra slopbro'yu Ctrl+C ile kapatın.

## B — kalıcılık

Root SSH anahtarınızı üretin. **Kendi anahtarınız** olmalı; pakette anahtar
yok.

```bash
# KURULUM.md 3. adımda ürettiyseniz atlayın
ssh-keygen -t ed25519 -f ~/.ssh/lgtv_root_ed25519 -N ''
```

Kalıcılık klasörünü hazırlayın. Aşağıdaki komut slopbro'yu
`~/slopbro-kalicilik`'e kopyalar ve kopyadaki `wwwroot/autoroot.sh`'ın yerine
bu paketin `araclar/root/kalicilik.sh`'ını koyar. İçine **açık**
anahtarınız yazılır:

```bash
bash araclar/root/hazirla.sh ~/slopbro            # ~/.ssh/lgtv_root_ed25519.pub
```

Çalıştırmadan önce okuyun; kısa bir betik ve TV'de root olarak çalışacak:

```bash
less ~/slopbro-kalicilik/wwwroot/autoroot.sh
```

Sonra slopbro'yu **kopyadan** tekrar çalıştırın:

```bash
cd ~/slopbro-kalicilik
python3 -I slopbro.py --webos-version 6 --local-ip <MAC_IP> <TV_IP>
```

Bu sefer yeniden başlatma sorusu çıkmaz: betik sessizce biter ve günlüğünü
TV'de `/tmp/kalicilik.log`'a yazar. Bir dakika bekleyip slopbro'yu Ctrl+C ile,
sayfayı kumandadan GERİ ile kapatın.

Betiğin yaptıkları:

| | |
|---|---|
| `/home/root/.ssh/authorized_keys` | sizin açık anahtarınız (0600) |
| `webosbrew_sshd_enabled` | açılışta sshd (port 22, yalnızca anahtarla) |
| `webosbrew_block_updates` | yazılım güncellemesi kapalı: güncelleme root'u siler |
| `webosbrew_telnet_disabled` | telnet kapalı |
| `/var/lib/webosbrew/startup.sh` + `init.d/` | açılış kancası (Sade servisi buraya bağlanacak) |
| `luna://org.webosbrew.hbchannel.service/autostart` | **zorunlu adım.** Atlanırsa kalıcılık kurulmaz |

> `/autostart` çağrısının alternatifi, TV'de Homebrew Channel uygulamasını
> bir kez açmaktır. Betik çağrıyı zaten yapıyor; yine de kontrol geçmezse
> ilk denenecek şey bu.

## Kontrol: hepsi geçmeden devam etmeyin

```bash
nano ayarlar.yerel.sh               # TV_IP, TV_MAC yazılı olmalı
bash araclar/root/dogrula.sh
```

`dogrula.sh` yalnızca okur. 22 portu henüz açılmadıysa (sshd açılışta
başlar) bağlanamaz. O zaman TV'yi bir kez yeniden başlatın: devmode_enabled
artık dizin olduğu için `/media/developer` silinmez. Kalıcılık kurulamamışsa
en kötü ihtimalle root gider ve B'yi tekrarlarsınız.

```bash
bash araclar/root-ssh.sh reboot     # SSH varsa; yoksa TV'yi kumandadan kapatıp açın
# ~60 sn bekleyin
bash araclar/root/dogrula.sh        # hepsi "ok", sonda GECTI
bash araclar/root-ssh.sh 'cat /tmp/kalicilik.log 2>/dev/null; id'
```

**Asıl test yeniden başlatma sonrasıdır.** `GECTI` ve `uid=0(root)`
görüyorsanız kalıcı root tamam.

Son olarak `init.d`'nin açılışta gerçekten çalıştığını doğrulayın; Sade
servisi buna bağlı:

```bash
bash araclar/root-ssh.sh 'printf "#!/bin/sh\ndate > /tmp/initd-kanit\n" \
  > /var/lib/webosbrew/init.d/99-kanit && chmod 755 $_ && reboot'
# ~60 sn bekleyin
bash araclar/root-ssh.sh 'cat /tmp/initd-kanit && rm /var/lib/webosbrew/init.d/99-kanit'
```

Dosya varsa çalışıyor. İçindeki tarih yanlış görünebilir, çünkü TV'nin
saati açılıştan sonra bir süre yanlış oluyor; dosyanın var olması yeterli.

Sonra KURULUM.md **6. adımdan** devam edin.

---

## Ters giderse

| Belirti | Sebep / yapılacak |
|---|---|
| Eşleştirme isteği hiç çıkmıyor | Mac ile TV aynı ağda mı? Misafir ağı ve AP izolasyonu SSAP'ı keser. `--local-ip` doğru mu? |
| Hiçbir şey olmuyor | Firmware'iniz slopbro ile uyumlu olmayabilir. `--debug` ile çalıştırıp çıktıyı okuyun, slopbro'nun README'sine ve issue'larına bakın. |
| A'dan sonra yanlışlıkla yeniden başlattınız | Root gitti. A'yı tekrarlayın (devmode_enabled zaten dizinse betik bunu söyler), sonra B. Bu yol bizde denenmedi. |
| `dogrula.sh`: bayraklar / startup.sh HATA | B çalışmamış; TV'de `/tmp/kalicilik.log` da yoktur. B'yi tekrarlayın. |
| Yeniden başlatma sonrası root yok, 22 kapalı | `/autostart` kaydı tutmamış. A'yı tekrarlayın (geçici root için), TV'de Homebrew Channel'ı bir kez açın, B'yi tekrarlayın. |
| Açılış kilitleniyor | Homebrew Channel kurtarma modu: TV açılırken kumandadan **1-2-3-4**; açılış kancaları atlanır. GUVENLIK.md 4d. |

Kesin kurallar ([GUVENLIK.md](../GUVENLIK.md) bölüm 1):

- `com.webos.app.adoverlayex`, `adoverlay`, `acroverlay` uygulamalarını
  **asla** gizlemeyin; slopbro bunları kullanıyor.
- `start-devmode.sh`'a dokunmayın.
- Rootluyken LG Dev Mode uygulamasını tekrar kurmayın. slopbro'nun yazarı
  da aynı uyarıyı yapıyor: *"Do not install the LG Dev Mode app while
  rooted."*

## Kaynaklar

- [throwaway96/slopbro](https://github.com/throwaway96/slopbro): webOS root
  yöntemi (AGPL-3.0)
- [webosbrew/webos-homebrew-channel](https://github.com/webosbrew/webos-homebrew-channel):
  kalıcılık, `startup.sh`, kurtarma modu
- [hbertsch/lgtv-webos-root-launcher](https://github.com/hbertsch/lgtv-webos-root-launcher):
  aynı firmware'de (OLED55B19LA, 03.53.45) yapılmış uçtan uca örnek
