#!/bin/bash
set -e

SRC="/root/js/state-forms/state-forms/origin/main"
DST="/var/www/state-forms/origin/main"

mkdir -p "$DST"
rsync -a --delete "$SRC/" "$DST/"
echo "Deployed OK — $(date)"
