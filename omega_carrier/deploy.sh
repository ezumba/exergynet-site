#!/usr/bin/env bash
# Deploy Omega Carrier to Instance Beta (98.86.112.85)
# Run from WSL2: bash omega_carrier/deploy.sh
set -e

HOST="98.86.112.85"
SSH_KEY="${SSH_KEY:-~/.ssh/exergynet.pem}"
REMOTE_DIR="/home/ubuntu/omega_carrier"

echo "=== Omega Carrier Deploy → $HOST ==="

# 1. Sync files
rsync -avz --delete \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  "$(dirname "$0")/" \
  "ubuntu@$HOST:$REMOTE_DIR/"

# 2. Install deps & set up venv
ssh -i "$SSH_KEY" "ubuntu@$HOST" bash << 'REMOTE'
set -e
cd /home/ubuntu/omega_carrier

if [ ! -d venv ]; then
  python3 -m venv venv
  echo "[omega] venv created"
fi

source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "[omega] dependencies installed"

# Create .env if missing
if [ ! -f .env ]; then
  cat > .env << 'ENV'
PORTAL_URL=https://portal.exergynet.org
APEX_URL=https://explorer-api.exergynet.org
MCP_PORT=8765
MCP_HOST=0.0.0.0
ENV
  echo "[omega] .env created (no secrets needed — tokens are per-call)"
fi

# Install and start systemd service
sudo cp omega_carrier.service /etc/systemd/system/omega_carrier.service
sudo systemctl daemon-reload
sudo systemctl enable omega_carrier
sudo systemctl restart omega_carrier
sleep 2
sudo systemctl status omega_carrier --no-pager
REMOTE

echo ""
echo "=== DEPLOYED ==="
echo "SSE endpoint: http://$HOST:8765/sse"
echo "Logs:         ssh -i $SSH_KEY ubuntu@$HOST journalctl -u omega_carrier -f"
