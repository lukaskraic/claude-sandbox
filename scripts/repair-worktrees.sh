#!/bin/bash
# Repair worktrees after cron job damage
# Run as claude-sandbox user or root

set -e

WORKTREE_BASE="/srv/claude-sandbox/worktrees"
REPOS_BASE="/srv/claude-sandbox/data/repos"

# Add safe.directory for all paths
git config --global --add safe.directory '*'

echo "Repairing worktrees..."

for project_dir in "$WORKTREE_BASE"/*; do
    if [ ! -d "$project_dir" ]; then
        continue
    fi

    project_name=$(basename "$project_dir")
    repo_path="$REPOS_BASE/$project_name"

    if [ ! -d "$repo_path/.git" ]; then
        echo "Skipping $project_name - no repo found"
        continue
    fi

    echo "=== Project: $project_name ==="

    for worktree in "$project_dir"/*; do
        if [ ! -d "$worktree" ]; then
            continue
        fi

        session_id=$(basename "$worktree")
        gitdir_entry="$repo_path/.git/worktrees/$session_id"
        git_file="$worktree/.git"

        # Check if worktree entry exists in main repo
        if [ ! -d "$gitdir_entry" ]; then
            echo "  $session_id: No worktree entry in main repo (orphaned directory)"
            continue
        fi

        # Create or fix .git file
        if [ ! -f "$git_file" ] || ! grep -q "^gitdir:" "$git_file" 2>/dev/null; then
            echo "gitdir: $gitdir_entry" > "$git_file"
            echo "  $session_id: Created .git file"
        fi

        # Restore missing files from git
        cd "$worktree"

        # Get list of tracked files
        tracked_count=$(git ls-tree -r HEAD --name-only 2>/dev/null | wc -l)

        # Get list of actual files
        actual_count=$(find . -type f ! -path './.git' ! -path './.m2/*' ! -path './node_modules/*' ! -path './.config/*' 2>/dev/null | wc -l)

        if [ "$actual_count" -lt "$tracked_count" ]; then
            echo "  $session_id: Restoring $((tracked_count - actual_count)) missing files..."
            git checkout HEAD -- . 2>/dev/null || echo "    Warning: Some files could not be restored"
        else
            echo "  $session_id: Files intact ($actual_count files)"
        fi
    done
done

echo ""
echo "=== Worktree status after repair ==="
for project_dir in "$WORKTREE_BASE"/*; do
    if [ ! -d "$project_dir" ]; then
        continue
    fi
    project_name=$(basename "$project_dir")
    repo_path="$REPOS_BASE/$project_name"
    if [ -d "$repo_path/.git" ]; then
        git -C "$repo_path" worktree list
    fi
done

echo ""
echo "Repair complete!"
