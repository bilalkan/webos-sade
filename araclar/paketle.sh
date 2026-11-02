#!/bin/bash
# Launcher'i .ipk'ya paketler. ares-cli GEREKTIRMEZ.
#
# Neden var: ares-package bazi surumlerde "isDate is not a function" ile
# cokuyor ve kurulumun en basinda insani durduruyor.
#
# Neden `ar` kullanmiyor: macOS'un ar'i .ipk uretmek icin kullanilamaz —
# `ar rc` uc uyeyi de sessizce dusurup icinde yalnizca __.SYMDEF olan
# 96 baytlik bir arsiv birakiyor, hata da vermiyor. ar formati uye basina
# 60 baytlik bir metin basliktan olusuyor, elle yazmak daha guvenli.
#
# Kullanim: bash araclar/paketle.sh [cikti-dizini]
set -eu
D="$(cd "$(dirname "$0")/.." && pwd)"
CIKTI="${1:-$D/cikti}"
KAYNAK="$D/sade"

oku() { sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$KAYNAK/appinfo.json" | head -1; }
ID=$(oku id); SURUM=$(oku version)
[ -n "$ID" ] && [ -n "$SURUM" ] || { echo "appinfo.json'dan id/version okunamadi" >&2; exit 1; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/data/usr/palm/applications/$ID" \
         "$T/data/usr/palm/packages/$ID" "$T/control" "$CIKTI"

# -L: sembolik link varsa icerigini kopyala (TV'de link ise yaramaz)
cp -RL "$KAYNAK"/. "$T/data/usr/palm/applications/$ID/"
# macOS kalintilarini atma
find "$T/data" -name '.DS_Store' -o -name '._*' | while read -r f; do rm -f "$f"; done

# IZINLERI NORMALLESTIR. 25 Ekim: TV'den kopyalanan bir ikon 0755 olarak
# geldi, kurulum servisi paketi REDDETTI ("ipk verified failed", -5).
# Kaynak dosyanin izni ne olursa olsun pakete 644/755 giriyor.
find "$T/data" -type f -exec chmod 644 {} +
find "$T/data" -type d -exec chmod 755 {} +

cat > "$T/data/usr/palm/packages/$ID/packageinfo.json" <<PKG
{
  "id": "$ID",
  "version": "$SURUM",
  "app": "$ID"
}
PKG

BOY=$(( $(du -sk "$T/data" | cut -f1) * 1024 ))
cat > "$T/control/control" <<CTL
Package: $ID
Version: $SURUM
Section: misc
Priority: optional
Architecture: all
Installed-Size: $BOY
Maintainer: N/A <nobody@example.com>
Description: webOS application.
webOS-Package-Format-Version: 2
webOS-Packager-Version: paketle.sh
CTL

# COPYFILE_DISABLE: macOS tar'in ._ yan dosyalari gommesini engeller
# ONEMLI: girdi adlari "./usr/..." DEGIL "usr/..." olmali. macOS tar'i
# "." dizinini paketleyince her girdinin basina "./" koyuyor ve TV'nin
# kurulum servisi paketi REDDEDIYOR:
#   "reason": "ipk verified failed", "errorCode": -5
# (25 Ekim'de gercek TV'de olculdu.) Ust seviye dizini ACIKCA veriyoruz.
( cd "$T/control" && COPYFILE_DISABLE=1 tar --format=ustar -czf "$T/control.tar.gz" control )
( cd "$T/data"    && COPYFILE_DISABLE=1 tar --format=ustar -czf "$T/data.tar.gz" usr )

IPK="$CIKTI/${ID}_${SURUM}_all.ipk"
MT=$(date +%s)
printf '!<arch>\n' > "$IPK"
for uye in debian-binary control.tar.gz data.tar.gz; do
  [ "$uye" = debian-binary ] && printf '2.0\n' > "$T/debian-binary"
  n=$(wc -c < "$T/$uye" | tr -d ' ')
  # ar uye basligi: ad16 mtime12 uid6 gid6 kip8 boy10 + magic
  printf '%-16s%-12u%-6u%-6u%-8s%-10u`\n' "$uye" "$MT" 0 0 100644 "$n" >> "$IPK"
  cat "$T/$uye" >> "$IPK"
  [ $(( n % 2 )) -eq 1 ] && printf '\n' >> "$IPK"   # uyeler cift bayta hizalanir
done

echo "==> $IPK"
echo "    $(du -h "$IPK" | cut -f1) · $ID $SURUM"
