#!/bin/sh
# HOME emniyet kemeri.
#
# Servis `com.webos.surfacemanager.disableHome=true` yaziyor; o sirada LG
# kendi ana ekranini HIC acmiyor, tus tamamen servise kaliyor. Servis
# DUZGUN kapanirsa kendi false'a cekiyor. Ama SERT cokerse (SIGKILL, OOM)
# bunu yapamaz ve HOME sessiz kalir.
#
# Quick Start+ acik oldugu icin TV gunlerce yeniden baslamiyor, yani
# "reboot zaten duzeltir" demek yetmiyor. Bu bekci servisin pid'ini
# izliyor; servis gidip de 60 sn icinde geri gelmezse HOME'u LG'ye
# geri veriyor ve cikiyor.
PIDF=/tmp/sade-svc.pid
GEC=0
while :; do
  sleep 20
  P=$(cat "$PIDF" 2>/dev/null)
  if [ -n "$P" ] && [ -d "/proc/$P" ]; then
    GEC=0
    continue
  fi
  GEC=$((GEC + 20))
  [ "$GEC" -lt 60 ] && continue
  luna-send -n 1 -f luna://com.webos.service.config/setConfigs \
    '{"configs":{"com.webos.surfacemanager.disableHome":false}}' >/dev/null 2>&1
  echo "[$(date -Iseconds)] servis yok -> disableHome=false, HOME LG'ye birakildi" \
    >> /tmp/sade-svc.log 2>/dev/null
  exit 0
done
