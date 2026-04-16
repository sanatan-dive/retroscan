#!/bin/bash
# RetroScan AI — Start all services for phone testing
# Kills existing servers, starts backend + frontend + ngrok, prints URL

set -e

cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "═══════════════════════════════════════════"
echo "  RetroScan AI — Starting all services"
echo "═══════════════════════════════════════════"

# ─── Kill existing processes ───────────────────
echo "🧹 Cleaning up old processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill ngrok 2>/dev/null || true
sleep 1

# ─── Start Backend ─────────────────────────────
echo "🐍 Starting FastAPI backend on :8000..."
cd "$ROOT/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/retroscan-backend.log 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

# Wait for backend
echo -n "   Waiting for backend..."
for i in {1..30}; do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo " ✓ ready"
    break
  fi
  echo -n "."
  sleep 1
done

# ─── Start Frontend ────────────────────────────
echo "⚛️  Starting Next.js HTTPS frontend on :3000..."
cd "$ROOT/frontend"
node server.mjs > /tmp/retroscan-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

echo -n "   Waiting for frontend..."
for i in {1..20}; do
  if curl -sk -o /dev/null https://localhost:3000 2>&1; then
    echo " ✓ ready"
    break
  fi
  echo -n "."
  sleep 1
done

# ─── Start ngrok ───────────────────────────────
echo "🌐 Starting ngrok tunnel..."
ngrok http https://localhost:3000 > /tmp/retroscan-ngrok.log 2>&1 &
NGROK_PID=$!
sleep 5

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; t=json.load(sys.stdin)['tunnels']; print(t[0]['public_url'] if t else 'FAILED')")

# ─── Output ────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ All services are running!"
echo "═══════════════════════════════════════════"
echo ""
echo "  💻 Desktop:"
echo "     https://localhost:3000"
echo ""
echo "  📱 Phone (open in browser):"
echo "     $NGROK_URL"
echo ""
echo "  📊 Backend API docs:"
echo "     http://localhost:8000/docs"
echo ""
echo "  📝 Logs:"
echo "     Backend:  tail -f /tmp/retroscan-backend.log"
echo "     Frontend: tail -f /tmp/retroscan-frontend.log"
echo "     ngrok:    tail -f /tmp/retroscan-ngrok.log"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════"

# Cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Stopping all services..."
  kill $BACKEND_PID $FRONTEND_PID $NGROK_PID 2>/dev/null || true
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  lsof -ti:8000 | xargs kill -9 2>/dev/null || true
  pkill ngrok 2>/dev/null || true
  echo "   Done."
  exit 0
}
trap cleanup INT TERM

# Keep script running
wait
