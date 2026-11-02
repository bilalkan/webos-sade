#!/bin/bash
# Kalici root GIT/DUR kapisi. Hepsi "ok" demeden sonraki adima gecmeyin.
# Reboot'tan once VE sonra calistirin; asil test reboot sonrasi.
# Yalnizca okur, TV'de hicbir seyi degistirmez.
set -u
D="$(cd "$(dirname "$0")/../.." && pwd)"
. "$D/ayarlar.sh"
TV_IP=$(bash "$D/araclar/tv-ip.sh") || exit 1

bash "$D/araclar/root-ssh.sh" '
k() { if eval "$2" >/dev/null 2>&1; then echo "  ok    $1"; else echo "  HATA  $1"; H=1; fi; }
H=0
k "root (uid 0)"                       "[ \"\$(id -u)\" = 0 ]"
k "devmode_enabled DIZIN"              "[ -d /var/luna/preferences/devmode_enabled ]"
k "/media/developer yerinde"           "[ -d /media/developer ]"
k "bayraklar (sshd, update, telnet)"   "[ -f /var/luna/preferences/webosbrew_sshd_enabled ] && [ -f /var/luna/preferences/webosbrew_block_updates ] && [ -f /var/luna/preferences/webosbrew_telnet_disabled ]"
k "startup.sh"                         "[ -x /var/lib/webosbrew/startup.sh ]"
k "init.d"                             "[ -d /var/lib/webosbrew/init.d ]"
k "authorized_keys"                    "[ -s /home/root/.ssh/authorized_keys ]"
k "Dev Mode uygulamasi YOK"            "[ ! -d /media/cryptofs/apps/usr/palm/applications/com.palmdts.devmode ]"
[ "$H" = 0 ] && echo "GECTI" || echo "KALDI — devam etmeyin"
'
if nc -z -w 3 "$TV_IP" 23 2>/dev/null; then echo "  HATA  telnet (23) ACIK"; else echo "  ok    telnet kapali"; fi
