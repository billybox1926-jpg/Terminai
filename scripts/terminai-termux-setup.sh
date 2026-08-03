#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo "[terminai-termux] Installing hermes-agent in proot Ubuntu..."

pkg update -y
pkg install -y proot-distro termux-tools

if ! proot-distro list 2>/dev/null | grep -q 'ubuntu'; then
  echo "ERROR: 'ubuntu' distro alias not found in proot-distro. Run: proot-distro list"
  exit 1
fi

proot-distro install ubuntu
proot-distro login ubuntu -- bash -lc '
  set -e
  apt update -y
  apt install -y python3 python3-pip python3-venv python3-dev build-essential libffi-dev libssl-dev git curl

  cd ~
  rm -rf hermes-agent
  git clone https://github.com/billybox1926-jpg/hermes-agent.git
  cd hermes-agent
  python3 -m venv venv
  source venv/bin/activate
  pip install --upgrade pip setuptools wheel
  pip install -e ".[termux]"

  echo "[inside proot] hermes-agent installed in ~/hermes-agent"
  echo "[inside proot] Usage: source ~/hermes-agent/venv/bin/activate && hermes"
'

echo "[terminai-termux] proot-distro install complete."
