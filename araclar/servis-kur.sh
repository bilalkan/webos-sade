#!/bin/bash
# HOME tusu servisini TV'ye kurar ve boot kancasini baglar.
# ONCE ayarlar.sh icindeki HOME_KODU'nu olcup yaz (bkz. KURULUM.md adim 6).
set -u
D="$(cd "$(dirname "$0")/.." && pwd)"
. "$D/ayarlar.sh"
TV_IP=$(bash "$D/araclar/tv-ip.sh") || exit 1
OPT=(-i "$ROOT_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no
     -o LogLevel=ERROR -o ConnectTimeout=15)
R() { ssh -p 22 "${OPT[@]}" "root@$TV_IP" "$@" 2>&1 | grep -vE "store now|openssh\.com|^\*\* "; }

echo "==> servis dizini"
R 'mkdir -p /var/lib/webosbrew/sade'

echo "==> servis ayarlari (ayarlar.sh -> servis-ayar.json)"
# Kod degistirilmiyor: servis acilista servis-ayar.json'u okuyor. Dosya
# yoksa varsayilan "dokunma". Kimlikler servis tarafinda da beyaz listeden
# geciyor; burada yalnizca bicim denetleniyor.
TMP=$(mktemp -d)
node -e '
  var l = function (s) { return String(s || "").split(/\s+/).filter(Boolean); };
  var a = process.argv;
  var o = { uygulama: a[1], homeKodu: Number(a[2]),
            onyuklemeKapali: l(a[3]), surekliKapat: l(a[4]), kapatmaDisi: l(a[5]) };
  var kotu = [].concat(o.onyuklemeKapali, o.surekliKapat, o.kapatmaDisi, [o.uygulama])
               .filter(function (x) { return !/^[A-Za-z0-9._-]{1,128}$/.test(x); });
  if (kotu.length || !(o.homeKodu > 0)) { console.error("ayarlar.sh hatali: " + kotu.join(" ")); process.exit(1); }
  var gd = a[6];
  if (gd) {
    var g = JSON.parse(require("fs").readFileSync(gd, "utf8"));
    o.guzergahBaslik = g.baslik || null;
    o.guzergahlar = (g.guzergahlar || []).slice(0, 6);
  }
  console.log(JSON.stringify(o, null, 2));
' "$APP_ID" "$HOME_KODU" "${ONYUKLEME_KAPALI:-}" "${SUREKLI_KAPAT:-}" "${KAPATMA_DISI-airplay}" \
  "${GUZERGAH_DOSYASI:-}" > "$TMP/servis-ayar.json" || { rm -rf "$TMP"; exit 1; }
cat "$TMP/servis-ayar.json"

echo "==> dosyalar kopyalaniyor"
node -e "new Function(require('fs').readFileSync('$D/servis/service.js','utf8'))" || {
  echo "service.js bozuk, durduruldu" >&2; exit 1; }
scp -P 22 "${OPT[@]}" "$D/servis/service.js" "$TMP/servis-ayar.json" \
    "$D/servis/autostart.sh" "$D/servis/ram-izle.sh" \
    "$D/servis/onplan-ayristirici.js" "$D/servis/tepki-mantigi.js" \
    "$D/servis/acilma-karari.js" "$D/servis/homeconnect-sagligi.js" \
    "$D/servis/ekran-suresi.js" "$D/servis/kapanma.js" "$D/servis/home-bekci.sh" \
    "root@$TV_IP:/var/lib/webosbrew/sade/" >/dev/null || exit 1
rm -rf "$TMP"

if [ -n "${TOMTOM_ANAHTAR:-}" ]; then
  echo "==> TomTom anahtari (yalnizca root okuyabilir)"
  # Anahtar komut satirina girmesin diye stdin'den yaziliyor.
  printf %s "$TOMTOM_ANAHTAR" | R 'umask 077; cat > /var/lib/webosbrew/sade/tomtom-anahtar'
fi

echo "==> izinler ve boot kancasi"
R 'chmod 755 /var/lib/webosbrew/sade/*.sh
   chmod 644 /var/lib/webosbrew/sade/*.js
   mkdir -p /var/lib/webosbrew/init.d
   ln -sf /var/lib/webosbrew/sade/autostart.sh /var/lib/webosbrew/init.d/50-sade
   ls -l /var/lib/webosbrew/init.d/'

echo "==> servis baslatiliyor"
R ': > /tmp/sade-svc.log; sh /var/lib/webosbrew/sade/autostart.sh'
sleep 4
R 'cat /tmp/sade-svc.log'
