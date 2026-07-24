#!/bin/bash
set -e

SRC="/root/js/state-forms/state-forms/main"
DST="/var/www/state-forms/main"

cp -r "$SRC"/* "$DST"/
echo "Deployed OK — $(date)"
