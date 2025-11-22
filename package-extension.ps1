# PowerShell script to package Network Debugger Plus extension for Chrome Web Store
# Usage: .\package-extension.ps1

$ErrorActionPreference = "Stop"

Write-Host "Packaging Network Debugger Plus for Chrome Web Store..." -ForegroundColor Green

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionName = "network-debugger-plus"
$zipFileName = "$extensionName-v1.0.3.zip"
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

# Files/folders to exclude from icons directory
$iconsExclude = @(
    "icons\manifest.json",
    "icons\*.xml",
    "icons\*.html",
    "icons\*.ico",
    "icons\create-icons.html",
    "icons\browserconfig.xml"
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
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $file (NOT FOUND)" -ForegroundColor Red
    }
}

# Verify no duplicate manifest.json exists
Write-Host "`nVerifying package structure..." -ForegroundColor Cyan
$duplicateManifest = Join-Path $tempDir "icons\manifest.json"
if (Test-Path $duplicateManifest) {
    Write-Host "  [WARN] Removing duplicate manifest.json from icons folder..." -ForegroundColor Yellow
    Remove-Item -Path $duplicateManifest -Force
    Write-Host "  [OK] Removed duplicate manifest.json" -ForegroundColor Green
}

# Verify manifest.json permissions
Write-Host "`nVerifying manifest.json permissions..." -ForegroundColor Cyan
$manifestPath = Join-Path $tempDir "manifest.json"
if (Test-Path $manifestPath) {
    $manifestContent = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $permissions = $manifestContent.permissions
    $hasDebugger = $permissions -contains "debugger"
    $hasWebRequest = $permissions -contains "webRequest"
    $hasActiveTab = $permissions -contains "activeTab"
    $hasTabs = $permissions -contains "tabs"
    $hasHostPermissions = $manifestContent.PSObject.Properties.Name -contains "host_permissions"
    
    if ($hasDebugger -and -not $hasWebRequest -and -not $hasActiveTab -and -not $hasTabs -and -not $hasHostPermissions) {
        Write-Host "  [OK] Permissions are correct (only 'debugger')" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] WARNING: Permissions may be incorrect!" -ForegroundColor Red
        if (-not $hasDebugger) { Write-Host "    - Missing 'debugger' permission" -ForegroundColor Red }
        if ($hasWebRequest) { Write-Host "    - Should not have 'webRequest' permission" -ForegroundColor Yellow }
        if ($hasActiveTab) { Write-Host "    - Should not have 'activeTab' permission" -ForegroundColor Yellow }
        if ($hasTabs) { Write-Host "    - Should not have 'tabs' permission" -ForegroundColor Yellow }
        if ($hasHostPermissions) { Write-Host "    - Should not have 'host_permissions'" -ForegroundColor Yellow }
    }
} else {
    Write-Host "  [FAIL] manifest.json not found!" -ForegroundColor Red
}

# Count manifest.json files (should be exactly 1)
$manifestCount = (Get-ChildItem -Path $tempDir -Recurse -Filter "manifest.json").Count
if ($manifestCount -eq 1) {
    Write-Host "  [OK] Found exactly 1 manifest.json (correct)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Found $manifestCount manifest.json files (should be 1)" -ForegroundColor Red
    Write-Host "    Locations:" -ForegroundColor Yellow
    Get-ChildItem -Path $tempDir -Recurse -Filter "manifest.json" | ForEach-Object {
        Write-Host "      - $($_.FullName.Replace($tempDir, '.'))" -ForegroundColor Yellow
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
Write-Host "`n[SUCCESS] Package created successfully!" -ForegroundColor Green
Write-Host "  File: $zipFileName" -ForegroundColor Cyan
Write-Host "  Size: $([math]::Round($zipSize, 2)) KB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://chrome.google.com/webstore/devconsole/" -ForegroundColor White
Write-Host "  2. Click Add new item" -ForegroundColor White
Write-Host "  3. Upload: $zipFileName" -ForegroundColor White

