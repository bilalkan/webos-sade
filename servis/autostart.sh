#!/bin/sh
# webosbrew init.d kancasi — SOGUK BOOT'ta run-parts ile calisir.
# Servisi arka plana alip hemen donuyor ki boot gecikmesin.
# Devre disi birakmak: /var/lib/webosbrew/init.d/50-sade linkini sil.
SVCDIR=/var/lib/webosbrew/sade
[ -f "$SVCDIR/service.js" ] || exit 0
[ -f /tmp/sade-svc.pid ] && kill -9 "$(cat /tmp/sade-svc.pid)" 2>/dev/null
export NODE_PATH=/usr/lib/node_modules:/usr/lib/nodejs
cd "$SVCDIR" || exit 0
# --boot KALDIRILDI: servis ~50. saniyede kalkiyor, o sirada kullanici
# coktan bir uygulamaya girmis oluyor. Sade'yi one almak onu KOPARIR.
# Yalnizca HOME tusunu dinliyoruz.
# RAM ornekleyici (Quick Start'in etkisini izlemek icin)
setsid /var/lib/webosbrew/sade/ram-izle.sh </dev/null >/dev/null 2>&1 &

nohup /usr/bin/node service.js --watch >/dev/null 2>&1 &

# HOME emniyet kemeri: servis sert cokerse disableHome'u geri aliyor
setsid /var/lib/webosbrew/sade/home-bekci.sh </dev/null >/dev/null 2>&1 &
exit 0
