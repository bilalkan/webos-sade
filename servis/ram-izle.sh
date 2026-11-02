#!/bin/sh
# 5 dakikada bir bellek ornegi alir. Tek olcum yaniltici oluyor — Quick Start'in
# RAM'e etkisini anlamak icin zaman icindeki EGRI lazim.
L=/var/lib/webosbrew/sade/ram.log
while true; do
  A=$(awk '/^MemAvailable/{printf "%.0f", $2/1024}' /proc/meminfo)
  S=$(awk '/^SwapTotal/{t=$2} /^SwapFree/{f=$2} END{printf "%.0f", (t-f)/1024}' /proc/meminfo)
  U=$(cut -d' ' -f1 /proc/uptime | cut -d. -f1)
  echo "$(date +%Y-%m-%dT%H:%M) uptime=${U}s avail=${A}MB swap=${S}MB" >> "$L"
  tail -800 "$L" > "$L.tmp" 2>/dev/null && mv "$L.tmp" "$L"
  sleep 300
done
