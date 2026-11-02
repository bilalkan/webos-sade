#!/bin/bash
# Sade servisini GUVENLI sekilde yeniden baslatir.
#
# 24 EKIM DERSI: sureci "*service.js*" cmdline deseniyle aramak, komutu
# calistiran kabugun kendisini de esliyor — servis yerine kabugu oldurup
# "yeniden baslatildi" sanmistim. Burada once PID DOSYASI, o yoksa
# cmdline'in BASIYLA tam eslesme kullaniliyor.
set -u
D="$(cd "$(dirname "$0")" && pwd)"
R() { bash "$D/root-ssh.sh" "$@"; }

R '
BUL() {
  if [ -f /tmp/sade-svc.pid ]; then
    P=$(cat /tmp/sade-svc.pid)
    [ -d "/proc/$P" ] && { echo "$P"; return; }
  fi
  for p in /proc/[0-9]*; do
    c=$(tr "\0" " " < $p/cmdline 2>/dev/null)
    case "$c" in "/usr/bin/node service.js"*) echo "${p#/proc/}"; return;; esac
  done
}
ESKI=$(BUL)
echo "eski pid: ${ESKI:-yok}"
[ -n "$ESKI" ] && { kill "$ESKI"; sleep 3; }
cd /var/lib/webosbrew/sade || exit 1
export NODE_PATH=/usr/lib/node_modules:/usr/lib/nodejs
setsid /usr/bin/node service.js --watch </dev/null >>/tmp/sade-svc.log 2>&1 &
sleep 4
YENI=$(BUL)
echo "yeni pid: ${YENI:-BASLAMADI}"
[ -n "$YENI" ] && [ "$YENI" != "$ESKI" ] && echo "OK" || echo "DIKKAT: pid degismedi"
echo "--- log son 4 satir ---"
tail -4 /tmp/sade-svc.log
'
