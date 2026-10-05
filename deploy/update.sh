#!/bin/bash
set -euo pipefail
cd /home/ubuntu/cgp-spendcube-analyzer
git pull --ff-only origin main
npm ci
npm run build
systemctl --user restart cgp-spendcube
