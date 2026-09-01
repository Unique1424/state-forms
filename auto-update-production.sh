#!/bin/bash
set -e

REPO_DIR="/root/js/state-forms/state-forms"
BRANCH="main"
FRONTEND_SOURCE="$REPO_DIR/origin/main"
LOG_FILE="/var/log/state-forms-auto-update.log"

echo "=== Auto-update started at $(date) ===" | tee -a "$LOG_FILE"

cd "$REPO_DIR"

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH" | tee -a "$LOG_FILE"

# Fetch latest changes
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"

# Check if there are updates
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "No updates available" | tee -a "$LOG_FILE"
    exit 0
fi

echo "Updates found: $LOCAL -> $REMOTE" | tee -a "$LOG_FILE"

# Create or update production worktree
PROD_WORKTREE="/root/js/state-forms/production-worktree"

if [ ! -d "$PROD_WORKTREE" ]; then
    echo "Creating production worktree..." | tee -a "$LOG_FILE"
    git worktree add "$PROD_WORKTREE" "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
else
    echo "Updating production worktree..." | tee -a "$LOG_FILE"
    cd "$PROD_WORKTREE"
    git pull origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
    cd "$REPO_DIR"
fi

# Copy frontend files to origin/main
echo "Copying frontend files..." | tee -a "$LOG_FILE"
rsync -av --delete "$PROD_WORKTREE/" "$FRONTEND_SOURCE/" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.env.staging' \
    --exclude='Discord_bot' \
    --exclude='uploads' \
    --exclude='server.js' \
    --exclude='package.json' \
    --exclude='package-lock.json' \
    --exclude='deploy.sh' \
    --exclude='deploy-staging.sh' \
    2>&1 | tee -a "$LOG_FILE"

# Run deployment
echo "Running deployment..." | tee -a "$LOG_FILE"
bash "$REPO_DIR/deploy.sh" 2>&1 | tee -a "$LOG_FILE"

echo "=== Auto-update completed at $(date) ===" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
