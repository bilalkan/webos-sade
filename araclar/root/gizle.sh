#!/bin/bash
# Alexa ve spor alarmini (ve istediginiz baska uygulamalari) LG'nin KENDI
# gizli-uygulama listesine ekler. Sistem dosyasina dokunmaz; liste
# /var/preferences altinda, TV'nin kendi ayari.
#
# Varsayilan KURU CALISMA: yalnizca ne yazilacagini gosterir.
#   bash araclar/root/gizle.sh                 # onizleme
#   bash araclar/root/gizle.sh --uygula        # yaz + kilitle (sonra reboot)
#   bash araclar/root/gizle.sh --uygula ek.uygulama.id ...
#   bash araclar/root/gizle.sh --geri-al       # yedekten geri yukle
#
# Mevcut liste KORUNUR, yalnizca eklenir. Ilk yazmada orijinal
# /var/lib/webos-debloat/<BOLGE>.json.orig olarak yedeklenir.
# Bolge dosyasi otomatik bulunur; birden fazlaysa BOLGE=TUR.json verin.
#
# webOS 6.5'te dogru anahtar "blocked_applist". Baska rehberlerdeki
# blockedSystemAppList bu surumde sessizce hicbir sey yapmiyor.
set -u
D="$(cd "$(dirname "$0")/../.." && pwd)"
KIP=onizle
case "${1:-}" in --uygula) KIP=uygula; shift;; --geri-al) KIP=geri; shift;; esac
EKLER="amazon.alexa.view amazon.alexapr com.webos.app.sportsteamsettings $*"

# ROOT EXPLOIT'IN GIRIS NOKTALARI. Gizlenirlerse bir daha root alinamaz ve
# listeyi geri almak icin root gerekir -> tek cikis fabrika ayari.
YASAK="com.webos.app.adoverlayex com.webos.app.adoverlay com.webos.app.acroverlay com.webos.app.homeconnect"
for a in $EKLER; do
  case " $YASAK " in *" $a "*) echo "REDDEDILDI: $a gizlenemez (GUVENLIK.md 1a)" >&2; exit 1;; esac
  echo "$a" | grep -qE '^[A-Za-z0-9._-]{1,128}$' || { echo "gecersiz kimlik: $a" >&2; exit 1; }
done

bash "$D/araclar/root-ssh.sh" "KIP=$KIP EKLER='$EKLER' YASAK='$YASAK' BOLGE='${BOLGE:-}' sh -s" <<'TV'
set -u
DIR=/var/preferences/com.webos.applicationManager/blockedAppList
YED=/var/lib/webos-debloat
if [ -z "$BOLGE" ]; then
  set -- $(ls "$DIR" 2>/dev/null | grep '\.json$')
  [ $# -eq 1 ] || { echo "bolge dosyasi tek degil ($*). BOLGE=XXX.json verin." >&2; exit 1; }
  BOLGE=$1
fi
F="$DIR/$BOLGE"
[ -f "$F" ] || { echo "yok: $F" >&2; exit 1; }
echo "dosya  : $F"
echo "simdiki: $(cat "$F")"

if [ "$KIP" = geri ]; then
  [ -f "$YED/$BOLGE.orig" ] || { echo "yedek yok: $YED/$BOLGE.orig" >&2; exit 1; }
  chattr -i "$F" 2>/dev/null; cp "$YED/$BOLGE.orig" "$F"; chmod 644 "$F"
  echo "geri alindi: $(cat "$F")"; echo "Simdi TV'yi yeniden baslatin."; exit 0
fi

YENI=$(node -e '
  var fs = require("fs"), o = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  var l = o.blocked_applist || [];
  process.argv[2].split(" ").filter(Boolean).forEach(function (a) { if (l.indexOf(a) < 0) l.push(a); });
  o.blocked_applist = l; console.log(JSON.stringify(o));
' "$F" "$EKLER") || { echo "liste okunamadi" >&2; exit 1; }
for a in $YASAK; do
  echo "$YENI" | grep -q "\"$a\"" && { echo "DUR: $a listede — yazilmadi" >&2; exit 1; }
done
echo "yeni   : $YENI"
[ "$KIP" = uygula ] || { echo; echo "(onizleme — yazmak icin --uygula)"; exit 0; }

mkdir -p "$YED"
[ -f "$YED/$BOLGE.orig" ] || cp "$F" "$YED/$BOLGE.orig"
chattr -i "$F" 2>/dev/null
echo "$YENI" > "$F"; chmod 644 "$F"
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$F" || {
  cp "$YED/$BOLGE.orig" "$F"; echo "JSON bozuldu, yedek geri yuklendi" >&2; exit 1; }
# Kilitle: TV bir acilista listeyi sifirlayabiliyor
chattr +i "$F" 2>/dev/null && echo "kilitlendi (chattr +i)" || echo "kilitlenemedi"
echo "yazildi. Simdi TV'yi yeniden baslatin: bash araclar/root-ssh.sh reboot"
TV
