#!/bin/bash
set -e

echo "=== Deploying production ==="

# Copy production frontend files
cp -r /root/js/state-forms/state-forms/origin/main/* /var/www/state-forms/

# Copy shared assets (logo etc)
cp -r /root/js/state-forms/state-forms/src/* /var/www/state-forms/src/ 2>/dev/null || true

# Restart production server
pm2 restart state-forms 2>/dev/null || echo "PM2 process not found, skipping restart"

echo "=== Production deployed ==="
