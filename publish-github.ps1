param(
  [string]$RepoUrl = "https://github.com/jarmelbe/innweb-os.git",
  [string]$Branch = "main",
  [string]$CommitMessage = "Launch INNweb OS Opportunity Finder MVP"
)
$ErrorActionPreference = "Stop"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is required." }
if (-not (Test-Path "package.json")) { throw "Run from the project root." }
if (-not (Test-Path ".git")) { git init }
git add .
$pending = git diff --cached --name-only
if ($pending) { git commit -m $CommitMessage }
git branch -M $Branch
$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) { git remote set-url origin $RepoUrl } else { git remote add origin $RepoUrl }
git push -u origin $Branch
Write-Host "INNweb OS uploaded successfully."
