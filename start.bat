@echo off
echo ============================================
echo  Fleet Command Orchestrator — Local Server
echo ============================================

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

if not exist ".env.local" (
    echo Creating .env.local from template...
    copy .env.local.example .env.local
    echo.
    echo ACTION REQUIRED: Open .env.local and fill in your Supabase keys and SESSION_SECRET
    echo Then re-run this script.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo.
echo Building production bundle...
npm run build
if %errorlevel% neq 0 (
    echo Build failed. Run "npm run dev" instead for development mode.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Starting server on http://localhost:3002
echo  On your LAN, use your PC's IP address.
echo  To find it: open CMD and run  ipconfig
echo ============================================
echo.
npm run start
