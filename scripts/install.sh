#!/bin/bash
set -euo pipefail

# Claude Sandbox Universal Installer
# Supports: AlmaLinux 10+ (Podman), Ubuntu 24.04+ (Docker)
# Run as regular user with sudo access.
# Usage: bash install.sh --runtime podman|docker

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; exit 1; }

# --- Parse args ---
RUNTIME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --runtime) RUNTIME="$2"; shift 2 ;;
    *) err "Unknown argument: $1. Usage: install.sh --runtime podman|docker" ;;
  esac
done

[[ -z "$RUNTIME" ]] && err "Missing --runtime flag. Usage: install.sh --runtime podman|docker"
[[ "$RUNTIME" != "podman" && "$RUNTIME" != "docker" ]] && err "Runtime must be 'podman' or 'docker'"

# --- Pre-flight checks ---
for cmd in sudo curl tar; do
  command -v "$cmd" &>/dev/null || err "Required command '$cmd' not found. Install it first."
done

sudo -n true 2>/dev/null || err "sudo requires a password or is not configured. Run with a user that has passwordless sudo or enter password first."

# --- Detect OS ---
source /etc/os-release 2>/dev/null || err "Cannot read /etc/os-release"
OS_ID="$ID"
log "Detected OS: $PRETTY_NAME (ID=$OS_ID)"
log "Container runtime: $RUNTIME"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_USER="$(whoami)"
APP_DIR="/srv/claude-sandbox/app"
DATA_DIR="/srv/claude-sandbox/data"
WORKTREE_DIR="/srv/claude-sandbox/worktrees"

# Verify source has been built
if [[ ! -d "$SRC_DIR/packages/server/dist" ]]; then
  err "Server not built. Run 'pnpm build' in $SRC_DIR first."
fi
if [[ ! -d "$SRC_DIR/packages/web/dist" ]]; then
  err "Frontend not built. Run 'pnpm build' in $SRC_DIR first."
fi

# --- Step 1: Base packages ---
log "Installing base packages..."
case "$OS_ID" in
  almalinux|rhel|centos|rocky|fedora)
    sudo dnf install -y git sqlite acl curl tar gcc-c++ make
    ;;
  ubuntu|debian)
    sudo apt-get update
    sudo apt-get install -y git sqlite3 acl curl tar build-essential
    ;;
  *)
    err "Unsupported OS: $OS_ID"
    ;;
esac

# --- Step 2: Node.js 20 ---
if command -v node &>/dev/null && [[ "$(node -v)" == v20.* ]]; then
  log "Node.js $(node -v) already installed"
else
  log "Installing Node.js 20..."
  case "$OS_ID" in
    almalinux|rhel|centos|rocky|fedora)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo dnf install -y nodejs
      ;;
    ubuntu|debian)
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
      sudo apt-get install -y nodejs
      ;;
  esac
fi
log "Node.js $(node -v)"

# --- Step 3: pnpm ---
if command -v pnpm &>/dev/null; then
  log "pnpm already installed"
else
  log "Installing pnpm..."
  sudo npm install -g pnpm
fi

# --- Step 4: Container runtime ---
if [[ "$RUNTIME" == "podman" ]]; then
  if command -v podman &>/dev/null; then
    log "Podman already installed: $(podman --version)"
  else
    log "Installing Podman..."
    case "$OS_ID" in
      almalinux|rhel|centos|rocky|fedora) sudo dnf install -y podman ;;
      ubuntu|debian) sudo apt-get install -y podman ;;
    esac
  fi
  log "Enabling Podman socket..."
  sudo systemctl enable --now podman.socket
  CONTAINER_SOCKET="/run/podman/podman.sock"

elif [[ "$RUNTIME" == "docker" ]]; then
  if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
  else
    log "Installing Docker CE..."
    case "$OS_ID" in
      almalinux|rhel|centos|rocky|fedora)
        sudo dnf install -y dnf-plugins-core
        sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
        sudo dnf install -y docker-ce docker-ce-cli containerd.io
        ;;
      ubuntu|debian)
        sudo apt-get install -y ca-certificates gnupg
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/$OS_ID/gpg" | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_ID $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
        ;;
    esac
  fi
  log "Enabling Docker..."
  sudo systemctl enable --now docker
  CONTAINER_SOCKET="/var/run/docker.sock"
fi

# --- Step 5: Claude Code ---
if command -v claude &>/dev/null; then
  log "Claude Code already installed"
else
  log "Installing Claude Code..."
  sudo npm install -g @anthropic-ai/claude-code
fi

# --- Step 6: Service user + directories ---
log "Creating service user and directories..."
if id claude-sandbox &>/dev/null; then
  log "User claude-sandbox already exists"
else
  sudo useradd -r -m -d /srv/claude-sandbox -s /bin/bash claude-sandbox
fi

sudo mkdir -p "$APP_DIR/packages/server" "$APP_DIR/packages/web" "$APP_DIR/scripts"
sudo mkdir -p "$DATA_DIR" "$WORKTREE_DIR"

# --- Step 7: Deploy app ---
log "Deploying application from $SRC_DIR..."
sudo rm -rf "$APP_DIR/packages/server/dist" "$APP_DIR/packages/web/dist"
sudo cp -r "$SRC_DIR/packages/server/dist" "$APP_DIR/packages/server/"
sudo cp -r "$SRC_DIR/packages/web/dist" "$APP_DIR/packages/web/"

# Copy scripts for cron jobs etc.
sudo cp -r "$SRC_DIR/scripts/"* "$APP_DIR/scripts/" 2>/dev/null || true

# Production package.json (no workspace references)
sudo tee "$APP_DIR/packages/server/package.json" > /dev/null << 'PKGJSON'
{
  "name": "@claude-sandbox/server",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@trpc/server": "^10.45.0",
    "better-sqlite3": "^9.4.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dockerode": "^4.0.0",
    "express": "^4.18.2",
    "multer": "^2.0.2",
    "simple-git": "^3.22.0",
    "tar-stream": "^3.1.7",
    "uuid": "^9.0.0",
    "ws": "^8.16.0",
    "zod": "^3.22.0"
  }
}
PKGJSON

log "Installing production dependencies..."
sudo rm -rf "$APP_DIR/packages/server/node_modules" "$APP_DIR/packages/server/package-lock.json"
sudo bash -c "cd '$APP_DIR/packages/server' && /usr/bin/npm install --omit=dev --no-audit --no-fund" 2>&1 || true

sudo chown -R claude-sandbox:claude-sandbox /srv/claude-sandbox

# --- Step 8: ACL for current user ---
log "Setting up ACL permissions for $INSTALL_USER..."
HOME_DIR="$(getent passwd "$INSTALL_USER" | cut -d: -f6)"

# Grant service user access to user's .claude directory
if [[ -d "$HOME_DIR/.claude" ]]; then
  sudo setfacl -m u:claude-sandbox:rx "$HOME_DIR"
  sudo setfacl -Rm u:claude-sandbox:rwX "$HOME_DIR/.claude"
  sudo setfacl -Rdm u:claude-sandbox:rwX "$HOME_DIR/.claude"
  log "ACL set on $HOME_DIR/.claude"
else
  warn "$HOME_DIR/.claude not found - skipping ACL (create it before running sessions)"
fi

# Grant service user read access to .claude.json (Claude Code state file in home dir)
# This file is mode 600 by default, service needs to read it to copy into sessions
if [[ -f "$HOME_DIR/.claude.json" ]]; then
  sudo setfacl -m u:claude-sandbox:r "$HOME_DIR/.claude.json"
  log "ACL set on $HOME_DIR/.claude.json"
fi

# Grant service user access to .local (Claude Code binary)
if [[ -d "$HOME_DIR/.local" ]]; then
  sudo setfacl -Rm u:claude-sandbox:rwX "$HOME_DIR/.local"
  sudo setfacl -Rdm u:claude-sandbox:rwX "$HOME_DIR/.local"
  log "ACL set on $HOME_DIR/.local"
fi

# --- Step 9: Container socket access ---
log "Configuring container socket access..."
if [[ "$RUNTIME" == "docker" ]]; then
  if getent group docker &>/dev/null; then
    sudo usermod -aG docker claude-sandbox
    log "Added claude-sandbox to docker group"
  fi
elif [[ "$RUNTIME" == "podman" ]]; then
  # Podman rootful socket - ensure claude-sandbox can access it
  if [[ -S "$CONTAINER_SOCKET" ]]; then
    sudo setfacl -m u:claude-sandbox:rw "$CONTAINER_SOCKET"
    log "ACL set on $CONTAINER_SOCKET"
  fi
fi

# --- Step 10: systemd service ---
log "Creating systemd service..."
sudo tee /etc/systemd/system/claude-sandbox.service > /dev/null << EOF
[Unit]
Description=Claude Sandbox Server
After=network.target
$(if [[ "$RUNTIME" == "docker" ]]; then echo "After=docker.service"; fi)
$(if [[ "$RUNTIME" == "podman" ]]; then echo "After=podman.socket"; fi)

[Service]
Type=simple
User=claude-sandbox
Group=claude-sandbox
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node packages/server/dist/index.js
Restart=on-failure
RestartSec=5

Environment=NODE_ENV=production
Environment=PORT=3020
Environment=HOST=0.0.0.0
Environment=DATA_DIR=$DATA_DIR
Environment=WORKTREE_BASE=$WORKTREE_DIR
Environment=CONTAINER_RUNTIME=$RUNTIME
Environment=CONTAINER_SOCKET=$CONTAINER_SOCKET
Environment=LOG_LEVEL=info
Environment=CLAUDE_SOURCE_USERS=$INSTALL_USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable claude-sandbox

# --- Step 11: Start + verify ---
log "Starting claude-sandbox service..."
sudo systemctl start claude-sandbox

sleep 3

if curl -sf http://localhost:3020/health > /dev/null 2>&1; then
  log "Health check passed!"
  curl -s http://localhost:3020/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3020/health
else
  warn "Health check failed. Checking logs..."
  sudo journalctl -u claude-sandbox -n 20 --no-pager
  err "Service did not start properly. Check logs above."
fi

echo ""
log "Installation complete!"
echo "  Runtime:  $RUNTIME"
echo "  Socket:   $CONTAINER_SOCKET"
echo "  URL:      http://$(hostname -I | awk '{print $1}'):3020"
echo "  Logs:     sudo journalctl -u claude-sandbox -f"
echo ""
echo "Next: run 'bash scripts/setup-demo.sh' to create the demo project"
