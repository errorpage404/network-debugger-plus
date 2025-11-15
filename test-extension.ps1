# PowerShell script to test Network Debugger Plus extension locally
# Usage: .\test-extension.ps1

$ErrorActionPreference = "Stop"

Write-Host "Testing Network Debugger Plus Extension..." -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Test 1: Check required files exist
Write-Host "`n[Test 1] Checking required files..." -ForegroundColor Cyan
$requiredFiles = @(
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

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $scriptDir $file
    if (Test-Path $filePath) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (MISSING)" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if ($allFilesExist) {
    Write-Host "  ✓ All required files present" -ForegroundColor Green
} else {
    Write-Host "  ✗ Some required files are missing!" -ForegroundColor Red
}

# Test 2: Verify manifest.json structure
Write-Host "`n[Test 2] Verifying manifest.json..." -ForegroundColor Cyan
$manifestPath = Join-Path $scriptDir "manifest.json"
if (Test-Path $manifestPath) {
    try {
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        
        # Check required fields
        $checks = @{
            "manifest_version" = $manifest.manifest_version -eq 3
            "name" = $null -ne $manifest.name
            "version" = $null -ne $manifest.version
            "devtools_page" = $null -ne $manifest.devtools_page
            "background.service_worker" = $null -ne $manifest.background.service_worker
        }
        
        foreach ($check in $checks.GetEnumerator()) {
            if ($check.Value) {
                Write-Host "  ✓ $($check.Key)" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $($check.Key) (missing or invalid)" -ForegroundColor Red
            }
        }
        
        # Check permissions
        Write-Host "`n  Checking permissions..." -ForegroundColor Yellow
        $permissions = $manifest.permissions
        if ($permissions -contains "debugger") {
            Write-Host "    ✓ Has 'debugger' permission" -ForegroundColor Green
        } else {
            Write-Host "    ✗ Missing 'debugger' permission" -ForegroundColor Red
        }
        
        $badPermissions = @("webRequest", "activeTab", "tabs")
        $hasBadPermissions = $false
        foreach ($bad in $badPermissions) {
            if ($permissions -contains $bad) {
                Write-Host "    ✗ Should not have '$bad' permission" -ForegroundColor Red
                $hasBadPermissions = $true
            }
        }
        
        if (-not $hasBadPermissions) {
            Write-Host "    ✓ No unnecessary permissions" -ForegroundColor Green
        }
        
        # Check host_permissions
        if ($manifest.PSObject.Properties.Name -contains "host_permissions") {
            Write-Host "    ✗ Should not have 'host_permissions'" -ForegroundColor Red
        } else {
            Write-Host "    ✓ No host_permissions (correct)" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "  ✗ Error parsing manifest.json: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ manifest.json not found!" -ForegroundColor Red
}

# Test 3: Check for duplicate manifest.json
Write-Host "`n[Test 3] Checking for duplicate manifest.json..." -ForegroundColor Cyan
$duplicateManifest = Join-Path $scriptDir "icons\manifest.json"
if (Test-Path $duplicateManifest) {
    Write-Host "  ✗ Found duplicate manifest.json in icons folder!" -ForegroundColor Red
    Write-Host "    Location: icons\manifest.json" -ForegroundColor Yellow
    Write-Host "    Action: Delete this file before packaging" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ No duplicate manifest.json found" -ForegroundColor Green
}

# Test 4: Verify file references in manifest
Write-Host "`n[Test 4] Verifying file references..." -ForegroundColor Cyan
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    
    # Check devtools_page
    if ($manifest.devtools_page) {
        $devtoolsPath = Join-Path $scriptDir $manifest.devtools_page
        if (Test-Path $devtoolsPath) {
            Write-Host "  ✓ devtools.html exists" -ForegroundColor Green
        } else {
            Write-Host "  ✗ devtools.html not found at: $($manifest.devtools_page)" -ForegroundColor Red
        }
    }
    
    # Check background service_worker
    if ($manifest.background.service_worker) {
        $bgPath = Join-Path $scriptDir $manifest.background.service_worker
        if (Test-Path $bgPath) {
            Write-Host "  ✓ background.js exists" -ForegroundColor Green
        } else {
            Write-Host "  ✗ background.js not found at: $($manifest.background.service_worker)" -ForegroundColor Red
        }
    }
    
    # Check icons
    if ($manifest.icons) {
        $iconSizes = @("16", "48", "128")
        foreach ($size in $iconSizes) {
            if ($manifest.icons.$size) {
                $iconPath = Join-Path $scriptDir $manifest.icons.$size
                if (Test-Path $iconPath) {
                    Write-Host "  ✓ icon$size.png exists" -ForegroundColor Green
                } else {
                    Write-Host "  ✗ icon$size.png not found at: $($manifest.icons.$size)" -ForegroundColor Red
                }
            }
        }
    }
}

# Test 5: Check panel.html references
Write-Host "`n[Test 5] Verifying panel.html references..." -ForegroundColor Cyan
$panelHtmlPath = Join-Path $scriptDir "panel.html"
if (Test-Path $panelHtmlPath) {
    $panelContent = Get-Content $panelHtmlPath -Raw
    
    # Check for CSS reference
    if ($panelContent -match 'href="styles/panel\.css"') {
        $cssPath = Join-Path $scriptDir "styles\panel.css"
        if (Test-Path $cssPath) {
            Write-Host "  ✓ panel.css reference is valid" -ForegroundColor Green
        } else {
            Write-Host "  ✗ panel.css not found" -ForegroundColor Red
        }
    }
    
    # Check for JS references
    $jsFiles = @("utils\jsonTreeView.js", "utils\requestManager.js", "panel.js")
    foreach ($jsFile in $jsFiles) {
        if ($panelContent -match [regex]::Escape($jsFile.Replace("\", "/"))) {
            $jsPath = Join-Path $scriptDir $jsFile
            if (Test-Path $jsPath) {
                Write-Host "  ✓ $jsFile reference is valid" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $jsFile not found" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "  ✗ panel.html not found!" -ForegroundColor Red
}

# Test 6: Check devtools.html references
Write-Host "`n[Test 6] Verifying devtools.html references..." -ForegroundColor Cyan
$devtoolsHtmlPath = Join-Path $scriptDir "devtools.html"
if (Test-Path $devtoolsHtmlPath) {
    $devtoolsContent = Get-Content $devtoolsHtmlPath -Raw
    
    if ($devtoolsContent -match 'src="devtools\.js"') {
        $devtoolsJsPath = Join-Path $scriptDir "devtools.js"
        if (Test-Path $devtoolsJsPath) {
            Write-Host "  ✓ devtools.js reference is valid" -ForegroundColor Green
        } else {
            Write-Host "  ✗ devtools.js not found" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  ✗ devtools.html not found!" -ForegroundColor Red
}

# Summary
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Fix any errors shown above" -ForegroundColor White
Write-Host "  2. Load extension in Chrome as 'unpacked' to test functionality" -ForegroundColor White
Write-Host "  3. Run .\package-extension.ps1 to create submission package" -ForegroundColor White
Write-Host "  4. Test the extracted package as unpacked extension" -ForegroundColor White
Write-Host "  5. Upload to Chrome Web Store" -ForegroundColor White
Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


