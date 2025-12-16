# PowerShell Script để Build AccSafe Desktop App
# Script này sẽ tự động xóa và thay thế folder dist-electron

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Building AccSafe Desktop App" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Lấy đường dẫn thư mục hiện tại
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Bước 1: Xóa folder dist-electron cũ (nếu có)
Write-Host "[0/4] Cleaning old build artifacts..." -ForegroundColor Yellow
$distElectronPath = Join-Path $scriptPath "dist-electron"
if (Test-Path $distElectronPath) {
    Write-Host "  Removing old dist-electron folder..." -ForegroundColor Gray
    try {
        Remove-Item -Path $distElectronPath -Recurse -Force -ErrorAction Stop
        Write-Host "  ✓ Old dist-electron folder removed successfully" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Error removing dist-electron folder: $_" -ForegroundColor Red
        Write-Host "  Trying to continue anyway..." -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ No old dist-electron folder found" -ForegroundColor Green
}

# Xóa folder dist cũ (nếu có)
$distPath = Join-Path $scriptPath "dist"
if (Test-Path $distPath) {
    Write-Host "  Removing old dist folder..." -ForegroundColor Gray
    try {
        Remove-Item -Path $distPath -Recurse -Force -ErrorAction Stop
        Write-Host "  ✓ Old dist folder removed successfully" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Error removing dist folder: $_" -ForegroundColor Red
    }
}

Write-Host ""

# Bước 2: Cài đặt dependencies
Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }
    Write-Host "  ✓ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "  ✗ ERROR: Failed to install dependencies" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Bước 3: Build frontend
Write-Host "[2/4] Building frontend..." -ForegroundColor Yellow
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed with exit code $LASTEXITCODE"
    }
    Write-Host "  ✓ Frontend built successfully" -ForegroundColor Green
} catch {
    Write-Host "  ✗ ERROR: Failed to build frontend" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Bước 4: Build Windows executable
Write-Host "[3/4] Building Windows executable..." -ForegroundColor Yellow
try {
    npm run build:win
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build:win failed with exit code $LASTEXITCODE"
    }
    Write-Host "  ✓ Windows executable built successfully" -ForegroundColor Green
} catch {
    Write-Host "  ✗ ERROR: Failed to build executable" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Bước 5: Kiểm tra kết quả
Write-Host "[4/4] Verifying build output..." -ForegroundColor Yellow
if (Test-Path $distElectronPath) {
    $exeFiles = Get-ChildItem -Path $distElectronPath -Filter "*.exe" -File
    if ($exeFiles.Count -gt 0) {
        Write-Host "  ✓ Build completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "  Build Summary" -ForegroundColor Cyan
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Output files are in: dist-electron\" -ForegroundColor White
        Write-Host ""
        foreach ($exe in $exeFiles) {
            $fileSize = [math]::Round($exe.Length / 1MB, 2)
            Write-Host "  - $($exe.Name) ($fileSize MB)" -ForegroundColor Green
        }
        Write-Host ""
    } else {
        Write-Host "  ⚠ Warning: No .exe files found in dist-electron" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ ERROR: dist-electron folder not found after build" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Build process completed!" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"

