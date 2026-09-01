#!/bin/bash

# Setup cron job for auto-update (runs every 5 minutes)
CRON_JOB="*/5 * * * * /root/js/state-forms/state-forms/auto-update-production.sh"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "auto-update-production.sh"; then
    echo "Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added: runs every 5 minutes"
fi

echo "Current crontab:"
crontab -l
