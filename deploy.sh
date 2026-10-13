#!/bin/bash
set -e

echo "=== Deploying production ==="

SRC="/root/js/state-forms/state-forms/main"
DST="/var/www/state-forms"

# Copy production frontend files
cp -r "$SRC"/* "$DST"/

# Restart production server
pm2 restart state-forms 2>/dev/null || echo "PM2 process not found, skipping restart"

echo "=== Production deployed OK — $(date) ==="
