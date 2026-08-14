#!/bin/bash
set -e

SRC="/root/js/state-forms/state-forms/staging"
DST="/var/www/state-forms-staging/main"

cp -r "$SRC"/* "$DST"/
echo "Staging deployed OK — $(date)"
