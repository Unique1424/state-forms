#!/bin/bash
set -e

echo "=== Deploying staging ==="

# Copy staging frontend files
cp -r /root/js/state-forms/state-forms/staging/main/* /var/www/state-forms-staging/

# Copy shared assets (logo etc)
cp -r /root/js/state-forms/state-forms/src/* /var/www/state-forms-staging/src/ 2>/dev/null || true

# Restart staging server
pm2 restart state-forms-staging 2>/dev/null || echo "PM2 process not found, skipping restart"

echo "=== Staging deployed ==="
