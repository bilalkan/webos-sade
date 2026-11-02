#!/bin/bash
# Launcher'i TV'ye kurar ve surumu DOGRULAR.
#
# Neden ares-install degil: guncel ares-cli "isDate is not a function" ile
# cokuyor. Bu yol TV'nin kendi kurulum servisini cagiriyor.
# Kurulum servisi takilirsa: araclar/root-ssh.sh 'restart appinstalld'
#
# Kullanim: bash araclar/kur.sh cikti/<paket>.ipk
set -u
IPK="${1:?ipk yolu gerekli}"
D="$(cd "$(dirname "$0")/.." && pwd)"
. "$D/ayarlar.sh"
TV_IP=$(bash "$D/araclar/tv-ip.sh") || exit 1
OPT=(-i "$ROOT_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no
     -o LogLevel=ERROR -o ConnectTimeout=15)
AD=$(basename "$IPK")
HEDEF="/media/developer/temp/$AD"
BEKLENEN=$(echo "$AD" | sed 's/.*_\([0-9][0-9.]*\)_all\.ipk/\1/')
# Uygulama kimligi de dosya adindan: <id>_<surum>_all.ipk
# (sabit kodlu "com.bilal.sade" test paketlerini dogrulayamiyordu)
UYG_ID=$(echo "$AD" | sed 's/_[0-9][0-9.]*_all\.ipk$//')

echo "==> kopyalaniyor: $AD"
# /media/developer/temp yoksa scp basarisiz olur (ilk kurulumda tipik)
ssh -p 22 "${OPT[@]}" "root@$TV_IP" 'mkdir -p /media/developer/temp' 2>/dev/null
scp -P 22 "${OPT[@]}" "$IPK" "root@$TV_IP:$HEDEF" || { echo "kopyalama basarisiz" >&2; exit 1; }

echo "==> kuruluyor"
# 26 Ekim: uygulama ondeyken kurulum onu kapatiyor ve yerine LG'nin ana
# ekrani geliyor (HOME basilmadigi icin servis duzeltmiyor). Kurulumdan
# once ondekini okuyup, kurulan uygulamaysa sonunda geri aciyoruz.
ONDEKI=$(ssh -p 22 "${OPT[@]}" "root@$TV_IP" \
  'luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo "{}" </dev/null' 2>/dev/null \
  | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p' | head -1)
# ONEMLI: abonelik ACIK KALMALI. Onceden `luna-send-pub -n 8` kullaniyorduk;
# 8 durum mesajindan sonra cikiyor, kurulum o sirada "service installing"
# asamasinda oluyor ve abone kaybolunca servis kurulumu IPTAL EDIYOR.
# 25 Ekim: 1.9.4 bu yuzden iki kez "BASARISIZ" dedi, elle (abonelik acik)
# calistirinca ayni paket sorunsuz kuruldu.
ssh -p 22 "${OPT[@]}" "root@$TV" \
  "rm -f /tmp/kur-durum.json
   luna-send-pub -i -f luna://com.webos.appInstallService/dev/install \
     '{\"id\":\"com.ares.defaultName\",\"ipkUrl\":\"$HEDEF\",\"subscribe\":true}' \
     > /tmp/kur-durum.json 2>&1 &
   P=\$!
   # 'installed' gorunce erken cik, yoksa en fazla 90 sn bekle
   for i in \$(seq 1 45); do
     sleep 2
     grep -q '\"installed\"' /tmp/kur-durum.json 2>/dev/null && break
     grep -q 'install failed' /tmp/kur-durum.json 2>/dev/null && break
   done
   kill \$P 2>/dev/null
   grep -oE '\"state\": \"[^\"]*\"|\"reason\": \"[^\"]*\"' /tmp/kur-durum.json | tail -3" 2>/dev/null

echo "==> dogrulaniyor (beklenen: $BEKLENEN)"
G=""
for i in $(seq 1 25); do
  G=$(ssh -p 22 "${OPT[@]}" "root@$TV_IP" \
    "cat /media/developer/apps/usr/palm/applications/$UYG_ID/appinfo.json 2>/dev/null \
     | tr -d '\n ' | sed 's/.*\"version\":\"\([^\"]*\)\".*/\1/'" 2>/dev/null)
  [ "$G" = "$BEKLENEN" ] && break
  sleep 3
done
ssh -p 22 "${OPT[@]}" "root@$TV_IP" "rm -f '$HEDEF'" 2>/dev/null
[ "$G" = "$BEKLENEN" ] || { echo "==> BASARISIZ — kurulu: '${G:-okunamadi}'" >&2; exit 1; }
echo "==> OK — kurulu: $G"
if [ "$ONDEKI" = "$UYG_ID" ]; then
  ssh -p 22 "${OPT[@]}" "root@$TV_IP" \
    "luna-send -n 1 luna://com.webos.applicationManager/launch '{\"id\":\"$UYG_ID\"}' </dev/null" >/dev/null 2>&1 \
    && echo "==> kurulumdan once ondeydi, yeniden acildi"
fi
