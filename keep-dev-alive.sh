#!/usr/bin/env bash
# Self-healing supervisor for the IC-OS dev server.
# Ensures `next dev -p 3000` is always running, avoiding duplicate instances.
# Designed to be invoked by a recurring cron job (fixed_rate ~60s).
set -u

PROJECT_DIR="/home/z/my-project"
PORT=3000
LOG="$PROJECT_DIR/dev.log"
PIDFILE="$PROJECT_DIR/.dev-server.pid"

cd "$PROJECT_DIR" || exit 1

# 1. If the port is already answering, the server is healthy — do nothing.
if curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$PORT" 2>/dev/null; then
  exit 0
fi

# 2. Port not answering. Kill any stale next processes (avoid duplicates).
pkill -f "next-server (v" 2>/dev/null
pkill -f "next dev -p $PORT" 2>/dev/null
sleep 1

# 3. Relaunch with full detachment so it survives the supervisor's own exit.
#    nohup + setsid reparents the process to PID 1 (tini), and all stdio is
#    redirected away from the controlling terminal.
nohup setsid bash -c "exec $PROJECT_DIR/node_modules/.bin/next dev -p $PORT > $LOG 2>&1" \
  > /dev/null 2>&1 < /dev/null &
echo $! > "$PIDFILE"
disown 2>/dev/null || true

exit 0
