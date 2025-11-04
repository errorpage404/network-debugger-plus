# Quick script to help upload to GitHub
# This will guide you through the process

Write-Host "`n=== Network Debugger Plus - GitHub Upload Guide ===" -ForegroundColor Green
Write-Host "`nThis script will help you upload your extension to GitHub.`n" -ForegroundColor Cyan

Write-Host "STEP 1: Create GitHub Repository" -ForegroundColor Yellow
Write-Host "1. Go to: https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name: network-debugger-plus" -ForegroundColor White
Write-Host "3. Make it PUBLIC (so you can use GitHub Pages)" -ForegroundColor White
Write-Host "4. DO NOT check 'Add a README file'" -ForegroundColor White
Write-Host "5. Click 'Create repository'" -ForegroundColor White
Write-Host "`nPress Enter after you've created the repository..." -ForegroundColor Cyan
$null = Read-Host

Write-Host "`nSTEP 2: Get Your Repository URL" -ForegroundColor Yellow
Write-Host "Copy the repository URL from GitHub (e.g., https://github.com/yourusername/network-debugger-plus.git)" -ForegroundColor White
$repoUrl = Read-Host "`nPaste your repository URL here"

if (-not $repoUrl) {
    Write-Host "No URL provided. Exiting." -ForegroundColor Red
    exit
}

Write-Host "`nSTEP 3: Initialize Git (if not already done)" -ForegroundColor Yellow
if (-not (Test-Path .git)) {
    Write-Host "Initializing git repository..." -ForegroundColor Cyan
    git init
    Write-Host "✓ Git initialized" -ForegroundColor Green
} else {
    Write-Host "✓ Git already initialized" -ForegroundColor Green
}

Write-Host "`nSTEP 4: Create .gitignore file..." -ForegroundColor Yellow
$gitignoreContent = @"
# OS files
.DS_Store
Thumbs.db
desktop.ini

# Editor files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.log
temp-package/
*.zip
"@

$gitignoreContent | Out-File -FilePath ".gitignore" -Encoding UTF8
Write-Host "✓ .gitignore created" -ForegroundColor Green

Write-Host "`nSTEP 5: Add all files..." -ForegroundColor Yellow
git add .
Write-Host "✓ Files added" -ForegroundColor Green

Write-Host "`nSTEP 6: Create initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit - Network Debugger Plus extension"
Write-Host "✓ Commit created" -ForegroundColor Green

Write-Host "`nSTEP 7: Connect to GitHub..." -ForegroundColor Yellow
git remote remove origin -ErrorAction SilentlyContinue
git remote add origin $repoUrl
Write-Host "✓ Remote added" -ForegroundColor Green

Write-Host "`nSTEP 8: Push to GitHub..." -ForegroundColor Yellow
Write-Host "You may be prompted for your GitHub username and password/token" -ForegroundColor Cyan
Write-Host "Press Enter to continue..." -ForegroundColor Cyan
$null = Read-Host

git branch -M main
git push -u origin main

Write-Host "`n=== Upload Complete! ===" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Go to your repository on GitHub" -ForegroundColor White
Write-Host "2. Click Settings → Pages" -ForegroundColor White
Write-Host "3. Select 'main' branch and '/ (root)' folder" -ForegroundColor White
Write-Host "4. Click Save" -ForegroundColor White
Write-Host "5. Your privacy policy will be at:" -ForegroundColor White
Write-Host "   https://yourusername.github.io/network-debugger-plus/privacy-policy.html" -ForegroundColor Cyan
Write-Host "`nPress Enter to exit..."
$null = Read-Host

