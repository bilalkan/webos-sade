#!/bin/bash
# slopbro'nun ikinci kosusu icin kalicilik klasorunu hazirlar.
#
# slopbro (AGPL-3.0, throwaway96) bu pakette DAGITILMIYOR. Kendiniz
# klonlayin; bu betik onu degistirmez, yanina bir kopya acar ve kopyadaki
# wwwroot/autoroot.sh'i kalicilik.sh ile degistirir.
#
# Kullanim: bash araclar/root/hazirla.sh <slopbro-klasoru> [acik-anahtar.pub]
set -eu
D="$(cd "$(dirname "$0")" && pwd)"
SB="${1:?slopbro klasoru gerekli (git clone https://github.com/throwaway96/slopbro)}"
PUB="${2:-$HOME/.ssh/lgtv_root_ed25519.pub}"
SB="$(cd "$SB" && pwd)"
HEDEF="$SB-kalicilik"

[ -f "$SB/slopbro.py" ] && [ -d "$SB/wwwroot" ] || { echo "$SB bir slopbro klasoru degil" >&2; exit 1; }
[ -f "$PUB" ] || { echo "acik anahtar yok: $PUB (ssh-keygen -t ed25519 -f ${PUB%.pub} -N '')" >&2; exit 1; }
ANAHTAR=$(head -1 "$PUB")
# Tek satir, tek tirnak yok, bilinen bir anahtar turu — kalicilik.sh'a tirnak icinde giriyor
case "$ANAHTAR" in ssh-ed25519\ *|ssh-rsa\ *|ecdsa-sha2-*) ;; *) echo "$PUB bir SSH acik anahtari gibi gorunmuyor" >&2; exit 1;; esac
case "$ANAHTAR" in *"'"*) echo "anahtarda tek tirnak var, kullanilamaz" >&2; exit 1;; esac

rm -rf "$HEDEF"
mkdir -p "$HEDEF"
cp "$SB/slopbro.py" "$HEDEF/"
cp -R "$SB/wwwroot" "$HEDEF/wwwroot"
# Esleme anahtari (<TV_IP>.key) varsa tasi: TV ikinci kez eslesme sormasin
cp "$SB"/*.key "$HEDEF/" 2>/dev/null || true
awk -v k="$ANAHTAR" '{ gsub(/__ROOT_ANAHTARI__/, k); print }' "$D/kalicilik.sh" > "$HEDEF/wwwroot/autoroot.sh"
grep -q "__ROOT_ANAHTARI__" "$HEDEF/wwwroot/autoroot.sh" && { echo "anahtar yerlestirilemedi" >&2; exit 1; }

echo "==> hazir: $HEDEF"
echo "    autoroot.sh = kalicilik.sh, anahtar: $(echo "$ANAHTAR" | awk '{print $1" ..."$NF}')"
echo "    slopbro.py sha256: $(shasum -a 256 "$HEDEF/slopbro.py" 2>/dev/null | cut -c1-16 || sha256sum "$HEDEF/slopbro.py" | cut -c1-16)…"
echo
echo "Sonraki adim (belgeler/ROOT.md, Asama B):"
echo "  cd \"$HEDEF\" && python3 -I slopbro.py --webos-version 6 --local-ip <MAC_IP> <TV_IP>"
