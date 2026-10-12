#!/bin/bash
set -e

echo "=== Deploying staging ==="

# Copy staging frontend files
SRC="/root/js/state-forms/state-forms/staging"
DST="/var/www/state-forms-staging/main"
cp -r "$SRC"/* "$DST"/

# Restart staging server
pm2 restart state-forms-staging 2>/dev/null || echo "PM2 process not found, skipping restart"

echo "=== Staging deployed OK — $(date) ==="
