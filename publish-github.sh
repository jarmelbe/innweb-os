#!/usr/bin/env bash
set -euo pipefail
REPO_URL="${1:-https://github.com/jarmelbe/innweb-os.git}"
BRANCH="${2:-main}"
MESSAGE="${3:-Launch INNweb OS Opportunity Finder MVP}"
command -v git >/dev/null || { echo "Git is required" >&2; exit 1; }
[ -f package.json ] || { echo "Run from project root" >&2; exit 1; }
[ -d .git ] || git init
git add .
if ! git diff --cached --quiet; then git commit -m "$MESSAGE"; fi
git branch -M "$BRANCH"
if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "$REPO_URL"; else git remote add origin "$REPO_URL"; fi
git push -u origin "$BRANCH"
echo "INNweb OS uploaded successfully."
