@echo off
echo ============================================
echo   Building AccSafe Portable (No Admin Required)
echo ============================================
echo.

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
echo [3/3] Building Portable executable...
call npx electron-builder --win portable --x64
if %errorlevel% neq 0 (
    echo ERROR: Failed to build executable
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Build completed successfully!
echo ============================================
echo.
echo Output file: dist-electron\AccSafe-1.0.0-portable.exe
echo.
pause

