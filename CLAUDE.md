# Claude Sandbox Development Guide

## Project Structure

```
claude-sandbox/
├── packages/
│   ├── server/     # Backend API (Node.js + tRPC)
│   ├── web/        # Frontend (Vue 3 + Vuetify 3)
│   └── shared/     # Shared types
├── scripts/
│   └── deploy.sh   # Deployment script
└── docker/         # Container configurations
```

## Deployment

### Available sudo commands (no password required)

```bash
# Restart service after deployment
sudo systemctl restart claude-sandbox

# Check service status
sudo systemctl status claude-sandbox

# View service logs
sudo journalctl -u claude-sandbox -f

# Run deploy script
sudo /home/licencieclaude13/work/claude-sandbox/scripts/deploy.sh

# Copy files to production
sudo cp <files> /srv/claude-sandbox/

# Reload httpd (reverse proxy)
sudo systemctl reload httpd
```

### Deploy workflow

1. Build the project:
   ```bash
   cd /home/licencieclaude13/work/claude-sandbox
   pnpm build
   ```

2. Deploy using script:
   ```bash
   sudo /home/licencieclaude13/work/claude-sandbox/scripts/deploy.sh
   ```

   Or manually:
   ```bash
   sudo systemctl restart claude-sandbox
   ```

3. Check logs if needed:
   ```bash
   sudo journalctl -u claude-sandbox -n 50
   ```

## Development

### Build commands

```bash
# Full build
pnpm build

# Type check
pnpm --filter web vue-tsc --noEmit

# Clean .vue.d.ts files before build (if conflicts)
find packages/web -name "*.vue.d.ts" -delete
```

### Service details

- **Production path:** `/srv/claude-sandbox/`
- **Service:** `claude-sandbox.service`
- **Web URL:** https://claudeui.alanata.sk/
- **API port:** 3020

## Adding New User Access (Claude License)

When adding a new user who wants to use their `.claude` directory in sandbox sessions:

```bash
# 1. Grant traverse access to home directory (required for path traversal)
sudo setfacl -m u:claude-sandbox:rx /home/<username>

# 2. Grant read+write access to .claude directory and contents
#    (Claude Code needs write for settings.local.json, session state, etc.)
sudo setfacl -Rm u:claude-sandbox:rwX /home/<username>/.claude
sudo setfacl -Rdm u:claude-sandbox:rwX /home/<username>/.claude

# 3. Grant write access to .local directory (contains Claude Code binary)
sudo setfacl -Rm u:claude-sandbox:rwX /home/<username>/.local
sudo setfacl -Rdm u:claude-sandbox:rwX /home/<username>/.local
```

**For existing git repos** (one-time setup per repo):
```bash
# Grant container user write access to git directory
# (needed for git add/commit in worktrees)
sudo setfacl -Rm u:<username>:rwX /srv/claude-sandbox/data/repos/<project>/.git/
sudo setfacl -Rdm u:<username>:rwX /srv/claude-sandbox/data/repos/<project>/.git/
```

Note: For **new sessions**, the service automatically sets ACL on `.git/` directory.

**Why this is needed:**
- The `claude-sandbox` service runs as a dedicated user, not root
- Without ACL on home dir, service cannot traverse to `.claude`
- Without ACL on `.claude`, service cannot read Claude settings
- Without ACL on `.local`, container cannot access Claude Code binary
- Without ACL on `.git/`, container user cannot run git commands
- The `-Rm` sets recursive permissions, `-Rdm` sets default for new files

**Current users with access:**
- `licencieclaude13` - ACL added 2026-02-02
- `licencieclaude21` - ACL added 2026-02-03

## Tech Stack

- **Backend:** Node.js 20, TypeScript, tRPC, Express
- **Frontend:** Vue 3, Vuetify 3, Shiki (syntax highlight), CodeMirror 6 (editor)
- **Container:** Podman
- **Git:** simple-git for worktree management
