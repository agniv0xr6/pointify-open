#!/usr/bin/env bash
# Pointify - local POS server.
#
#   Run with:   bash start.sh
#   (not ./start.sh - this folder lives on a FAT/exFAT card, which cannot
#    store the executable bit.)
#
#   Extra options:
#     HOST=0.0.0.0 bash start.sh   listen on the LAN too (needed to open
#                                  the app from a phone/another device)
#     PORT=3000   bash start.sh    use a different port
#
# Binds to 127.0.0.1 only by default, so it is never reachable from other
# devices until you ask for it.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "  Node.js is not installed."; exit 1; }

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"

echo ""
echo "  POINTIFY is starting"
echo "  ---------------------"
echo "    This device :  http://127.0.0.1:${PORT}/app.html"
if [ "$HOST" = "0.0.0.0" ]; then
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -z "$IP" ]; then IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}'); fi
  if [ -n "$IP" ]; then
    echo "    Phone/tablet:  http://${IP}:${PORT}/app.html"
    echo "                    (same Wi-Fi as this computer)"
  else
    echo "    Phone/tablet:  http://<this-computer-ip>:${PORT}/app.html"
  fi
  echo ""
  echo "    Listening on the LAN - anyone on this network can reach the till."
else
  echo "    Phone/tablet:  not reachable (server is bound to this machine only)"
  echo "                    To open it from another device, stop this and run:"
  echo "                        HOST=0.0.0.0 bash start.sh"
fi
echo ""
echo "  Press Ctrl+C to stop."
echo ""
exec node server.js
