@echo off
echo ============================================
echo   Building AccSafe Desktop App
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
echo [3/3] Building Windows executable...
call npm run build:win
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
echo Output files are in: dist-electron/
echo.
pause

