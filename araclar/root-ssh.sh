#!/bin/bash
# TV'ye root SSH ile komut calistirir. Ekrani KAPLAMAZ.
# Kullanim: bash araclar/root-ssh.sh 'komut'
set -u
D="$(cd "$(dirname "$0")/.." && pwd)"
. "$D/ayarlar.sh"
TV_IP=$(bash "$D/araclar/tv-ip.sh") || exit 1
ssh -p 22 -i "$ROOT_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no \
    -o LogLevel=ERROR -o ConnectTimeout=15 "root@$TV_IP" "$@" 2>&1 \
  | grep -vE "store now|openssh\.com|^\*\* "
