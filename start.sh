#!/bin/bash
# RetroScan AI — Start everything for mobile testing
# Usage: ./start.sh

echo "🔧 Starting RetroScan AI..."

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
echo "📡 Your local IP: $LOCAL_IP"

# Start backend
echo "🚀 Starting backend on port 8000..."
cd "$(dirname "$0")/backend"
pip install -r requirements.txt -q 2>/dev/null
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend
sleep 3

# Update frontend to use local IP for API
cd "$(dirname "$0")/frontend"
echo "NEXT_PUBLIC_API_URL=http://$LOCAL_IP:8000" > .env.local

# Start frontend
echo "🎨 Starting frontend on port 3000..."
npm run dev -- -H 0.0.0.0 -p 3000 &
FRONTEND_PID=$!

sleep 3

echo ""
echo "=========================================="
echo "  RetroScan AI is running!"
echo "=========================================="
echo ""
echo "  Desktop:  http://localhost:3000"
echo "  Mobile:   http://$LOCAL_IP:3000"
echo ""
echo "  For public URL, run in another terminal:"
echo "    ngrok http 3000"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo "=========================================="

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
