#!/bin/bash
# TV'nin GUNCEL IP'sini bulur ve basar.
#
# Neden var: 24 Ekim'de TV'nin DHCP kirasi kaydi (.113 -> .115) ve butun
# araclar koptu. Ayrica homeconnect servisi o anda bulut oturumunu
# kaybedip bos cihaz listesi dondurmeye basladi.
#
# Once bilinen IP'yi dener (hizli yol), tutmazsa MAC'ten arar.
set -u
D="$(cd "$(dirname "$0")/.." && pwd)"
. "$D/ayarlar.sh"
MAC_BEK="${TV_MAC:?ayarlar.sh icinde TV_MAC bos}"
ONBELLEK="${TMPDIR:-/tmp}/lgtv-ip"

# MAC'leri karsilastirilabilir hale getir: kucuk harf, oktetlerdeki bastaki
# sifirlar atilmis (macOS arp "0a" yerine "a" basiyor).
norm() { echo "$1" | tr 'A-Z' 'a-z' | tr ':' '\n' | sed 's/^0\([0-9a-f]\)$/\1/' | paste -sd: - ; }
# TV kablo + Wi-Fi ile ayni aga bagliysa iki MAC olur: TV_MAC bosluklu liste olabilir
HEDEFLER=""; for m in $MAC_BEK; do HEDEFLER="$HEDEFLER $(norm "$m")"; done

ara() { arp -an 2>/dev/null | while read -r satir; do
          m=$(echo "$satir" | grep -oE '([0-9a-fA-F]{1,2}:){5}[0-9a-fA-F]{1,2}')
          [ -n "$m" ] || continue
          case " $HEDEFLER " in *" $(norm "$m") "*) ;; *) continue;; esac
          echo "$satir" | grep -oE '\(([0-9]{1,3}\.){3}[0-9]{1,3}\)' | tr -d '()'
        done; }

# macOS nc: -w baglanmayi SINIRLAMIYOR (olu adreste ~75 sn asili kaldi), -G sinirliyor
if [ "$(uname)" = Darwin ]; then canli() { nc -z -G 2 -w 2 "$1" 22 2>/dev/null; }
else canli() { nc -z -w 2 "$1" 22 2>/dev/null; }; fi
# arp'ta ayni MAC iki IP'yle durabiliyor (eski kira + yeni kira); ilkini
# alip birakinca TV "bulunamadi". Butun adaylari dene, canli olani al.
canliAday() { for a in $(ara); do canli "$a" && { echo "$a"; return 0; }; done; return 1; }

# 1) onbellekteki / verilen IP
for aday in "${1:-}" "$(cat "$ONBELLEK" 2>/dev/null)" "${TV_IP:-}"; do
  [ -n "$aday" ] && canli "$aday" && { echo "$aday"; exit 0; }
done

# 2) arp tablosunda MAC
IP=$(canliAday)
[ -n "$IP" ] && { echo "$IP" > "$ONBELLEK"; echo "$IP"; exit 0; }

# 3) agi tara, sonra arp'a tekrar bak
AG=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
[ -n "$AG" ] || { echo "ag arayuzu bulunamadi" >&2; exit 1; }
ONEK=$(echo "$AG" | cut -d. -f1-3)
echo "TV aranıyor ($ONEK.0/24)..." >&2
for i in $(seq 1 254); do (ping -c1 -W 300 "$ONEK.$i" >/dev/null 2>&1 &); done
sleep 6
IP=$(canliAday)
[ -n "$IP" ] && { echo "$IP" > "$ONBELLEK"; echo "$IP"; exit 0; }
echo "TV bulunamadi (MAC $MAC_BEK). TV acik mi, ayni agda mi?" >&2
exit 1
