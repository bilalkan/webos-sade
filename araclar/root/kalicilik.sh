#!/bin/sh
# KALICILIK — slopbro'nun ikinci kosusunda TV'de ROOT olarak calisir.
# hazirla.sh bu dosyayi slopbro'nun wwwroot/autoroot.sh'inin yerine koyar
# ve anahtar yer tutucusunun yerine SIZIN acik anahtarinizi yazar.
#
# Neden ikinci kosu: slopbro'nun kendi autoroot.sh'i devmode_enabled'i
# dizine ceviriyor ve Homebrew Channel'i kuruyor, ama kalicilik kaydini
# kurmuyor (bizde sonrasinda /var/lib/webosbrew yoktu, bayraklar 0, port 22
# kapaliydi). O anda reboot edilseydi root giderdi. Bu betik
# hbertsch/lgtv-webos-root-launcher'in phase1-bootstrap.sh'inin yaptigini
# yapiyor. Sondaki /autostart cagrisi ZORUNLU — atlanirsa kalicilik yok.
set -e
LOG=/tmp/kalicilik.log
: > "$LOG"
say() { echo "$1" >> "$LOG"; }

say "=== baslangic: uid=$(id -u) ==="

HBC=/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service
[ -d "$HBC" ] || { say "!! Homebrew Channel kurulu degil ($HBC). Once slopbro'nun kendi autoroot.sh'i calismali."; exit 1; }

say ""
say "=== 1) root SSH anahtari ==="
mkdir -p /home/root/.ssh && chmod 700 /home/root/.ssh
echo '__ROOT_ANAHTARI__' > /home/root/.ssh/authorized_keys
chmod 600 /home/root/.ssh/authorized_keys
say "authorized_keys: $(wc -c < /home/root/.ssh/authorized_keys) bayt"

say ""
say "=== 2) webosbrew bayraklari ==="
: > /var/luna/preferences/webosbrew_sshd_enabled
: > /var/luna/preferences/webosbrew_block_updates
: > /var/luna/preferences/webosbrew_telnet_disabled
say "bayraklar: $(ls /var/luna/preferences/ | grep webosbrew_ | tr '\n' ' ')"

say ""
say "=== 3) startup.sh + init.d ==="
mkdir -p /var/lib/webosbrew/init.d
if [ -f "$HBC/startup.sh" ]; then
  cp "$HBC/startup.sh" /var/lib/webosbrew/startup.sh
  chmod 755 /var/lib/webosbrew/startup.sh
  say "startup.sh kopyalandi: $(wc -c < /var/lib/webosbrew/startup.sh) bayt"
else
  say "!! Homebrew Channel'da startup.sh YOK: $HBC"
  ls "$HBC" >> "$LOG" 2>&1
fi

say ""
say "=== 4) ZORUNLU ADIM: /autostart ==="
luna-send -w 3000 -n 1 -a org.webosbrew.hbchannel \
  luna://org.webosbrew.hbchannel.service/autostart '{"reason":"activity"}' >> "$LOG" 2>&1 || \
  say "!! autostart cagrisi hata verdi"

say ""
say "=== 5) dogrulama ==="
say "devmode_enabled : $(ls -ld /var/luna/preferences/devmode_enabled | cut -c1-10)  (d ile baslamali)"
say "startup.sh      : $(ls -l /var/lib/webosbrew/startup.sh 2>/dev/null | awk '{print $5" bayt"}')"
say "init.d          : $(ls -d /var/lib/webosbrew/init.d 2>/dev/null || echo YOK)"
say "bayraklar       : $(ls /var/luna/preferences/ | grep -c webosbrew_)  (3 olmali)"

say ""
say "BITTI"
chmod 644 "$LOG"
