@echo off
echo ============================================
echo   Building AccSafe (Requires Admin)
echo ============================================
echo.
echo Please run this script as Administrator!
echo Press any key to continue or Ctrl+C to cancel...
pause >nul
echo.

cd /d "%~dp0"

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build frontend
    pause
    exit /b 1
)

echo.
echo [3/3] Building executable...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run build:win
if %errorlevel% neq 0 (
    echo ERROR: Failed to build executable
    echo.
    echo NOTE: If you see code signing errors, make sure you're running as Administrator
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Build completed successfully!
echo ============================================
echo.
echo Output files are in: dist-electron/
echo   - AccSafe-1.0.0-x64.exe (Installer)
echo   - AccSafe-1.0.0-portable.exe (Portable)
echo.
pause

