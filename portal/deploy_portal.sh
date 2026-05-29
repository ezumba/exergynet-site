#!/bin/bash
# ExergyNet Developer Portal — Full Deploy
# Run on: 18.209.174.113 (Apex Router) or your chosen portal host
# Pre-req: Node 18+, npm, bun

set -e

PORTAL_DIR="$HOME/exergynet-portal"
API_URL="${EXERGYNET_API_URL:-https://api.exergynet.org}"
WC_PROJECT_ID="${WC_PROJECT_ID:-your_walletconnect_project_id}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-change_me}"

echo "=== ExergyNet Portal Deploy ==="
echo "Portal dir: $PORTAL_DIR"
echo "API: $API_URL"

# ── 1. Bootstrap Next.js if not exists ────────────────────────────────────────
if [ ! -d "$PORTAL_DIR" ]; then
  echo "[1] Creating Next.js app..."
  npx create-next-app@latest "$PORTAL_DIR" \
    --typescript --tailwind --app --src-dir \
    --no-git --no-eslint \
    --import-alias "@/*" <<< ""
fi

cd "$PORTAL_DIR"

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo "[2] Installing dependencies..."
npm install \
  @rainbow-me/rainbowkit@^2.2.0 \
  wagmi@^2.12.17 \
  viem@^2.21.19 \
  @tanstack/react-query@^5.56.2 \
  recharts@^2.12.7 \
  --legacy-peer-deps

# ── 3. Write .env.local ────────────────────────────────────────────────────────
echo "[3] Writing .env.local..."
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$WC_PROJECT_ID
NEXT_PUBLIC_WEBHOOK_SECRET=$WEBHOOK_SECRET
EOF

echo "[3] Environment configured."

# ── 4. Remind: copy portal source files ───────────────────────────────────────
echo ""
echo "[4] Copy these files from your local machine:"
echo "    src/app/page.tsx"
echo "    src/app/layout.tsx"
echo "    src/app/globals.css"
echo "    src/app/providers.tsx"
echo "    src/app/dashboard/page.tsx"
echo "    src/app/dashboard/layout.tsx"
echo "    src/app/dashboard/billing/page.tsx"
echo "    src/app/dashboard/keys/page.tsx"
echo "    src/app/dashboard/analytics/page.tsx"
echo "    src/app/dashboard/playground/page.tsx"
echo "    src/app/dashboard/settlements/page.tsx"
echo "    src/components/Sidebar.tsx"
echo "    src/lib/api.ts"
echo ""

# ── 5. Build ──────────────────────────────────────────────────────────────────
echo "[5] Building..."
npm run build

# ── 6. PM2 start ─────────────────────────────────────────────────────────────
echo "[6] Starting with PM2..."
if command -v pm2 &> /dev/null; then
  pm2 stop exergynet-portal 2>/dev/null || true
  pm2 start "npm start -- -p 4000" --name exergynet-portal
  pm2 save
  echo "[6] PM2: exergynet-portal running on port 4000"
else
  echo "[6] PM2 not found. Start manually: npm start -- -p 4000"
fi

echo ""
echo "=== Deploy complete ==="
echo "Add to Caddyfile:"
echo ""
echo "  exergynet.org {"
echo "    reverse_proxy localhost:4000"
echo "  }"
echo ""
echo "Then: sudo systemctl reload caddy"
