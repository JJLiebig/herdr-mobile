# Requires PowerShell 7, Git, Node, and GitHub CLI (gh) authenticated locally.
# Creates a new PRIVATE personal repository; never force-pushes or overwrites one.
[CmdletBinding()]
param([string]$Owner = 'JJLiebig', [string]$Name = 'herdr-mobile')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
foreach ($tool in @('git', 'gh', 'node')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing $tool. Install it before publishing." }
}
if ($Owner -notmatch '^[a-zA-Z0-9-]+$' -or $Name -notmatch '^[a-zA-Z0-9._-]+$') { throw 'Invalid repository name.' }
function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE. Stopped without retry or force push." }
}
Invoke-Checked 'gh' @('auth', 'status')
$login = (& gh api user --jq '.login').Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the authenticated GitHub account.' }
if ($login -ine $Owner) { throw "Authenticated as $login, not $Owner. This script only creates a repository in the authenticated personal account." }
Invoke-Checked 'node' @('scripts/check.mjs')
$repo = "$Owner/$Name"
# A successful existence check is an explicit stop, never permission to overwrite.
& gh repo view $repo --json nameWithOwner 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "$repo already exists. This create-only script will not touch it." }
if (Test-Path (Join-Path $root '.git')) { throw 'This folder already has a .git directory. Use a fresh extraction to avoid altering an existing checkout.' }
if (Test-Path (Join-Path $root '.env')) { Write-Host '.env will remain ignored and is not staged.' }
Invoke-Checked 'git' @('init', '-b', 'main')
# Do not mutate the user's global author identity. git commit will use their configured identity.
Invoke-Checked 'git' @('add', '.gitignore', '.gitattributes', '.env.example', 'herdr-mobile.config.example.json', 'package.json', 'package-lock.json', 'README.md', 'AGENTS.md', 'SECURITY.md', 'docs', 'shared', 'server', 'public', 'tests', 'scripts', '.github')
$staged = & git diff --cached --name-only
if ($staged | Where-Object { $_ -match '(^|/)\.env$|^artifacts/|^node_modules/|herdr-mobile\.config\.json$' }) { throw 'Unexpected sensitive path staged. Publication stopped.' }
Invoke-Checked 'git' @('commit', '-m', 'Draft v1: mobile overview, focused composer, voice and read-only bridge')
Invoke-Checked 'gh' @('repo', 'create', $repo, '--private', '--source', '.', '--remote', 'origin', '--description', 'Mobile-first companion for existing Herdr agents. Initial v1 draft; live control gated.', '--push')
Invoke-Checked 'gh' @('repo', 'view', $repo, '--json', 'url,isPrivate,defaultBranchRef')
Write-Host 'Created and pushed the private repository. No Herdr sessions were changed.'

