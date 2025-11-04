# PowerShell script to package Network Debugger Plus extension for Chrome Web Store
# Usage: .\package-extension.ps1

$ErrorActionPreference = "Stop"

Write-Host "Packaging Network Debugger Plus for Chrome Web Store..." -ForegroundColor Green

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionName = "network-debugger-plus"
$zipFileName = "$extensionName-v1.0.0.zip"
$tempDir = Join-Path $scriptDir "temp-package"

# Clean up temp directory if it exists
if (Test-Path $tempDir) {
    Write-Host "Cleaning up previous temp directory..." -ForegroundColor Yellow
    Remove-Item -Path $tempDir -Recurse -Force
}

# Create temp directory
New-Item -ItemType Directory -Path $tempDir | Out-Null
Write-Host "Created temp directory: $tempDir" -ForegroundColor Cyan

# Files to include
$filesToInclude = @(
    "manifest.json",
    "background.js",
    "devtools.html",
    "devtools.js",
    "panel.html",
    "panel.js",
    "styles\panel.css",
    "utils\jsonTreeView.js",
    "utils\requestManager.js",
    "icons\icon16.png",
    "icons\icon48.png",
    "icons\icon128.png"
)

# Copy files
Write-Host "`nCopying required files..." -ForegroundColor Cyan
foreach ($file in $filesToInclude) {
    $sourcePath = Join-Path $scriptDir $file
    $destPath = Join-Path $tempDir $file
    
    if (Test-Path $sourcePath) {
        $destDir = Split-Path -Parent $destPath
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (NOT FOUND)" -ForegroundColor Red
    }
}

# Remove old zip if exists
if (Test-Path $zipFileName) {
    Write-Host "`nRemoving old ZIP file..." -ForegroundColor Yellow
    Remove-Item -Path $zipFileName -Force
}

# Create ZIP file
Write-Host "`nCreating ZIP file: $zipFileName" -ForegroundColor Cyan
$zipPath = Join-Path $scriptDir $zipFileName

# Use .NET compression to create ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $zipPath)

# Clean up temp directory
Write-Host "Cleaning up temp directory..." -ForegroundColor Yellow
Remove-Item -Path $tempDir -Recurse -Force

# Get file size
$zipSize = (Get-Item $zipPath).Length / 1KB
Write-Host "`n✓ Package created successfully!" -ForegroundColor Green
Write-Host "  File: $zipFileName" -ForegroundColor Cyan
Write-Host "  Size: $([math]::Round($zipSize, 2)) KB" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://chrome.google.com/webstore/devconsole/" -ForegroundColor White
Write-Host "  2. Click 'Add new item'" -ForegroundColor White
Write-Host "  3. Upload: $zipFileName" -ForegroundColor White
Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

