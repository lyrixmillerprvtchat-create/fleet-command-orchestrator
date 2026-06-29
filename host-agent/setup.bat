@echo off
echo ============================================
echo  Fleet Command — Host Agent Setup
echo ============================================

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: pip install failed. See above for details.
    pause
    exit /b 1
)

if not exist ".env" (
    echo Creating .env from template...
    copy .env.example .env
    echo.
    echo ACTION REQUIRED: Open host-agent\.env and fill in your FLEET_ID and HOST_ACCESS_KEY
    echo You can find your FLEET_ID in the Supabase fleets table.
    echo The HOST_ACCESS_KEY is the access_key stored in that row's credentials column.
) else (
    echo .env already exists — skipping copy.
)

echo.
echo Setup complete. Edit host-agent\.env then run:
echo   python screen_stream.py
echo.
pause
