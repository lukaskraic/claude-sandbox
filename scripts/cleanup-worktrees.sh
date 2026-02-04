#!/bin/bash
# Cleanup orphaned worktrees that are no longer associated with active sessions
# Run as claude-sandbox user

set -o pipefail

WORKTREE_BASE="/srv/claude-sandbox/worktrees"
API_URL="http://localhost:3020/trpc"
LOG_FILE="/var/log/claude-sandbox-cleanup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Get list of active session IDs from API
get_active_sessions() {
    curl -s "${API_URL}/session.list" 2>/dev/null | \
        grep -oP '"id":"[^"]+' | \
        cut -d'"' -f4
}

# Cleanup orphaned worktrees for a project
cleanup_project_worktrees() {
    local project_dir="$1"
    local project_name=$(basename "$project_dir")
    local active_sessions="$2"
    local repo_path="/srv/claude-sandbox/data/repos/$project_name"
    local cleaned=0

    if [ ! -d "$project_dir" ]; then
        return
    fi

    for worktree in "$project_dir"/*; do
        if [ ! -d "$worktree" ]; then
            continue
        fi

        session_id=$(basename "$worktree")

        # Check if session is active
        if echo "$active_sessions" | grep -q "^${session_id}$"; then
            continue
        fi

        # Session not active - remove worktree properly using git
        log "Removing orphaned worktree: $project_name/$session_id"

        # Try git worktree remove first (proper cleanup)
        if [ -d "$repo_path/.git" ]; then
            git -C "$repo_path" worktree remove --force "$worktree" 2>/dev/null || true
        fi

        # If directory still exists (git command failed), use rm -rf as fallback
        if [ -d "$worktree" ]; then
            rm -rf "$worktree"
        fi

        ((cleaned++)) || true
    done

    # Prune any stale worktree entries from git
    if [ -d "$repo_path/.git" ] && [ $cleaned -gt 0 ]; then
        git -C "$repo_path" worktree prune 2>/dev/null || true
    fi

    if [ $cleaned -gt 0 ]; then
        log "Cleaned $cleaned orphaned worktrees for project $project_name"
    fi
}

# Main
log "Starting worktree cleanup"

# Get active sessions
active_sessions=$(get_active_sessions)
active_count=$(echo "$active_sessions" | grep -c . || echo 0)
log "Found $active_count active sessions"

# Cleanup each project's worktrees
for project_dir in "$WORKTREE_BASE"/*; do
    if [ -d "$project_dir" ]; then
        cleanup_project_worktrees "$project_dir" "$active_sessions"
    fi
done

# Report disk usage
used=$(du -sh "$WORKTREE_BASE" 2>/dev/null | cut -f1)
log "Worktree directory size after cleanup: $used"

log "Cleanup complete"
