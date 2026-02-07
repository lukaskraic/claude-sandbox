#!/bin/bash
set -euo pipefail

# Creates a demo project + session in claude-sandbox
# Run after install.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; exit 1; }

API="http://localhost:3020"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_SRC="$SCRIPT_DIR/demo"
REPO_DIR="/srv/claude-sandbox/data/repos/demo-hello-world"
INSTALL_USER="$(whoami)"

# --- Check dependencies ---
MISSING=()
for cmd in curl git python3 sudo; do
  command -v "$cmd" &>/dev/null || MISSING+=("$cmd")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  err "Missing required commands: ${MISSING[*]}. Run install.sh first."
fi

if [[ ! -d "$DEMO_SRC" ]]; then
  err "Demo source not found at $DEMO_SRC"
fi

# Check service is running
if ! curl -sf "$API/health" > /dev/null 2>&1; then
  warn "Service not responding on $API. Checking systemd..."
  if systemctl is-active --quiet claude-sandbox 2>/dev/null; then
    warn "Service is active but not responding. Waiting 5s..."
    sleep 5
    curl -sf "$API/health" > /dev/null 2>&1 || err "claude-sandbox is not responding on $API after waiting"
  else
    err "claude-sandbox service is not running. Run install.sh first."
  fi
fi
log "Service is healthy"

# --- Step 1: Init demo git repo ---
log "Creating demo git repo at $REPO_DIR..."
if sudo test -d "$REPO_DIR/.git"; then
  warn "Repo already exists, skipping init"
else
  sudo mkdir -p "$REPO_DIR"
  sudo chown claude-sandbox:claude-sandbox "$REPO_DIR"

  # Init as bare-like repo with a local origin pointing to itself
  sudo -u claude-sandbox git init "$REPO_DIR"
  sudo -u claude-sandbox git -C "$REPO_DIR" checkout -b main
  # Set origin to itself so worktree creation works (needs origin/main)
  sudo -u claude-sandbox git -C "$REPO_DIR" remote add origin "$REPO_DIR"

  # Copy demo files (exclude node_modules)
  sudo cp -r "$DEMO_SRC/backend" "$REPO_DIR/"
  sudo rm -rf "$REPO_DIR/backend/node_modules" "$REPO_DIR/backend/package-lock.json"
  sudo cp -r "$DEMO_SRC/frontend" "$REPO_DIR/"
  sudo cp "$DEMO_SRC/README.md" "$REPO_DIR/"
  if [[ -f "$DEMO_SRC/.gitignore" ]]; then
    sudo cp "$DEMO_SRC/.gitignore" "$REPO_DIR/"
  else
    printf 'node_modules/\npackage-lock.json\n' | sudo tee "$REPO_DIR/.gitignore" > /dev/null
  fi
  sudo chown -R claude-sandbox:claude-sandbox "$REPO_DIR"

  # Initial commit
  sudo -u claude-sandbox git -C "$REPO_DIR" add -A
  sudo -u claude-sandbox git -C "$REPO_DIR" -c user.name="Demo" -c user.email="demo@localhost" commit -m "init: demo hello world app"
  # Fetch from self so origin/main exists for worktree creation
  sudo -u claude-sandbox git -C "$REPO_DIR" fetch origin
  log "Git repo initialized with demo files"
fi

# Grant current user ACL on the .git directory
sudo setfacl -Rm "u:$INSTALL_USER:rwX" "$REPO_DIR/.git"
sudo setfacl -Rdm "u:$INSTALL_USER:rwX" "$REPO_DIR/.git"

# --- Step 2: Create project via API ---
log "Creating project..."

# Check if project already exists
EXISTING=$(curl -sf "$API/trpc/project.getByName?input=%7B%22name%22%3A%22demo-hello-world%22%7D" 2>/dev/null || echo "")
if echo "$EXISTING" | grep -q '"id"'; then
  PROJECT_ID=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['data']['id'])" 2>/dev/null || echo "")
  if [[ -n "$PROJECT_ID" ]]; then
    log "Project already exists: $PROJECT_ID"
  fi
fi

if [[ -z "${PROJECT_ID:-}" ]]; then
  RESULT=$(curl -s "$API/trpc/project.create" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "demo-hello-world",
      "description": "Demo Express + PostgreSQL app",
      "git": {
        "remote": "'"$REPO_DIR"'",
        "defaultBranch": "main"
      },
      "environment": {
        "baseImage": "ubuntu:24.04",
        "runtimes": { "node": "20" },
        "packages": [],
        "services": [
          {
            "type": "postgres",
            "version": "16",
            "database": "sandbox",
            "user": "sandbox",
            "password": "sandbox"
          }
        ],
        "ports": ["3000:3000/tcp"],
        "setup": "cd /workspace/backend && npm install && setsid node server.js > /tmp/server.log 2>&1 < /dev/null &"
      }
    }')

  PROJECT_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['data']['id'])" 2>/dev/null || echo "")
  [[ -z "$PROJECT_ID" ]] && err "Failed to create project. Response: $RESULT"
  log "Project created: $PROJECT_ID"
fi

# --- Step 3: Create + start session ---
log "Creating session..."
SESSION_RESULT=$(curl -sf "$API/trpc/session.create" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"name\": \"demo-session\",
    \"claudeSourceUser\": \"$INSTALL_USER\"
  }")

SESSION_ID=$(echo "$SESSION_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['data']['id'])" 2>/dev/null || echo "")
[[ -z "$SESSION_ID" ]] && err "Failed to create session. Response: $SESSION_RESULT"
log "Session created: $SESSION_ID"

log "Starting session (this may take a while for image build)..."
START_RESULT=$(curl -s "$API/trpc/session.start" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$SESSION_ID\"}" \
  --max-time 600)

STATUS=$(echo "$START_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['data']['status'])" 2>/dev/null || echo "unknown")
log "Session status: $STATUS"

if [[ "$STATUS" == "unknown" ]]; then
  warn "Could not parse session.start response:"
  echo "$START_RESULT" | head -5
fi

if [[ "$STATUS" != "running" ]]; then
  warn "Session not running yet. Checking status..."
  sleep 10
  SESSION_GET_INPUT=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps({'id':'$SESSION_ID'})))")
  RETRY_DATA=$(curl -s "$API/trpc/session.get?input=$SESSION_GET_INPUT" 2>/dev/null || echo "")
  STATUS=$(echo "$RETRY_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['data']['status'])" 2>/dev/null || echo "unknown")
  log "Session status after retry: $STATUS"
fi

# --- Step 4: Check session details ---
sleep 5

SESSION_GET_INPUT=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps({'id':'$SESSION_ID'})))")
SESSION_DATA=$(curl -sf "$API/trpc/session.get?input=$SESSION_GET_INPUT" 2>/dev/null || echo "")
FINAL_STATUS=$(echo "$SESSION_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['data']['status'])" 2>/dev/null || echo "unknown")
PORTS=$(echo "$SESSION_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['data'].get('container_ports','{}'))" 2>/dev/null || echo "{}")

echo ""
log "Demo setup complete!"
echo "  Project:   demo-hello-world ($PROJECT_ID)"
echo "  Session:   $SESSION_ID"
echo "  Status:    $FINAL_STATUS"
echo "  Ports:     $PORTS"
echo "  Dashboard: $API"
echo ""
if [[ "$FINAL_STATUS" == "running" ]]; then
  log "Try: Open the dashboard at $API and check the session"
else
  warn "Session status is '$FINAL_STATUS'. Check logs: sudo journalctl -u claude-sandbox -n 50"
fi
