#!/bin/bash
# Cleanup orphaned worktrees that are no longer associated with active sessions
# Run as claude-sandbox user
#
# SAFETY FEATURES:
# - Reads session list directly from SQLite database (no auth issues)
# - Validates database response before proceeding
# - Never deletes if we can't reliably get session list
# - Safety limit on max deletions per run
# - Dry-run mode for testing

set -o pipefail

WORKTREE_BASE="/srv/claude-sandbox/worktrees"
DB_PATH="/srv/claude-sandbox/data/claude-sandbox.db"
LOG_FILE="/var/log/claude-sandbox-cleanup.log"
MAX_DELETIONS_PER_RUN=10  # Safety limit - never delete more than this in one run
DRY_RUN="${DRY_RUN:-false}"  # Set DRY_RUN=true to test without deleting

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

# Get list of ALL session IDs from database (not just running ones)
# We keep worktrees for stopped sessions too - only delete truly orphaned ones
get_session_ids_from_db() {
    if [ ! -f "$DB_PATH" ]; then
        return 1
    fi

    # Get all session IDs from database
    sqlite3 "$DB_PATH" "SELECT id FROM sessions" 2>/dev/null
}

# Verify we can read from database and get valid data
verify_database_access() {
    if [ ! -f "$DB_PATH" ]; then
        log_error "Database file not found: $DB_PATH"
        return 1
    fi

    if [ ! -r "$DB_PATH" ]; then
        log_error "Cannot read database file: $DB_PATH"
        return 1
    fi

    # Try to count sessions - this validates DB is readable and has expected schema
    local count
    count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions" 2>/dev/null)

    if [ $? -ne 0 ]; then
        log_error "Failed to query database"
        return 1
    fi

    # Sanity check - count should be a number
    if ! [[ "$count" =~ ^[0-9]+$ ]]; then
        log_error "Invalid session count from database: $count"
        return 1
    fi

    echo "$count"
    return 0
}

# Cleanup orphaned worktrees for a project
cleanup_project_worktrees() {
    local project_dir="$1"
    local project_name=$(basename "$project_dir")
    local session_ids="$2"
    local repo_path="/srv/claude-sandbox/data/repos/$project_name"
    local cleaned=0
    local skipped=0

    if [ ! -d "$project_dir" ]; then
        return 0
    fi

    for worktree in "$project_dir"/*; do
        if [ ! -d "$worktree" ]; then
            continue
        fi

        local session_id=$(basename "$worktree")

        # Check if session exists in database
        if echo "$session_ids" | grep -q "^${session_id}$"; then
            continue
        fi

        # Safety limit check
        if [ $cleaned -ge $MAX_DELETIONS_PER_RUN ]; then
            log "Safety limit reached ($MAX_DELETIONS_PER_RUN deletions). Stopping cleanup for $project_name."
            ((skipped++))
            continue
        fi

        # Session not in database - this is truly orphaned
        if [ "$DRY_RUN" = "true" ]; then
            log "[DRY-RUN] Would remove orphaned worktree: $project_name/$session_id"
        else
            log "Removing orphaned worktree: $project_name/$session_id"

            # Try git worktree remove first (proper cleanup)
            if [ -d "$repo_path/.git" ]; then
                git -C "$repo_path" worktree remove --force "$worktree" 2>/dev/null || true
            fi

            # If directory still exists (git command failed), use rm -rf as fallback
            if [ -d "$worktree" ]; then
                rm -rf "$worktree"
            fi
        fi

        ((cleaned++)) || true
    done

    # Prune any stale worktree entries from git
    if [ -d "$repo_path/.git" ] && [ $cleaned -gt 0 ] && [ "$DRY_RUN" != "true" ]; then
        git -C "$repo_path" worktree prune 2>/dev/null || true
    fi

    if [ $cleaned -gt 0 ]; then
        if [ "$DRY_RUN" = "true" ]; then
            log "[DRY-RUN] Would clean $cleaned orphaned worktrees for project $project_name"
        else
            log "Cleaned $cleaned orphaned worktrees for project $project_name"
        fi
    fi

    if [ $skipped -gt 0 ]; then
        log "Skipped $skipped worktrees due to safety limit"
    fi

    echo $cleaned
}

# Main
log "Starting worktree cleanup (DRY_RUN=$DRY_RUN, MAX_DELETIONS=$MAX_DELETIONS_PER_RUN)"

# Step 1: Verify database access
session_count=$(verify_database_access)
if [ $? -ne 0 ]; then
    log_error "Cannot verify database access. Aborting cleanup to prevent data loss."
    exit 1
fi

log "Database contains $session_count sessions"

# Step 2: Get all session IDs
session_ids=$(get_session_ids_from_db)
if [ $? -ne 0 ]; then
    log_error "Failed to get session IDs from database. Aborting cleanup."
    exit 1
fi

# Step 3: Count worktrees before cleanup
total_worktrees=0
for project_dir in "$WORKTREE_BASE"/*; do
    if [ -d "$project_dir" ]; then
        count=$(find "$project_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
        total_worktrees=$((total_worktrees + count))
    fi
done

log "Found $total_worktrees worktree directories"

# Step 4: Safety check - if we have worktrees but 0 sessions, something is wrong
if [ "$total_worktrees" -gt 0 ] && [ "$session_count" -eq 0 ]; then
    log_error "WARNING: Found $total_worktrees worktrees but 0 sessions in database."
    log_error "This could indicate a database issue. Aborting cleanup to prevent data loss."
    exit 1
fi

# Step 5: Cleanup each project's worktrees
total_cleaned=0
for project_dir in "$WORKTREE_BASE"/*; do
    if [ -d "$project_dir" ]; then
        cleaned=$(cleanup_project_worktrees "$project_dir" "$session_ids")
        total_cleaned=$((total_cleaned + cleaned))
    fi
done

# Step 6: Report results
if [ "$DRY_RUN" != "true" ]; then
    used=$(du -sh "$WORKTREE_BASE" 2>/dev/null | cut -f1)
    log "Worktree directory size after cleanup: $used"
fi

log "Cleanup complete. Removed $total_cleaned orphaned worktrees."
