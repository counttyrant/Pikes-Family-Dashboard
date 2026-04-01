@echo off
echo Installing Pikes Brightness Service...
echo.

REM Get the directory of this script
set "DIR=%~dp0"
set "SCRIPT=%DIR%server.js"

REM Check Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Download it from https://nodejs.org and re-run this script.
    pause
    exit /b 1
)

REM Register a scheduled task to run at logon
echo Registering Windows startup task...
schtasks /create /tn "PikesBrightnessService" /tr "node \"%SCRIPT%\"" /sc onlogon /ru "%USERNAME%" /rl HIGHEST /f
if %ERRORLEVEL% neq 0 (
    echo WARNING: Could not register startup task. Try running as Administrator.
) else (
    echo Startup task registered successfully.
)

REM Start the service right now
echo Starting service...
start "" /b node "%SCRIPT%"

echo.
echo Done! The brightness service is now running on port 3737.
echo It will start automatically on next login.
echo.
echo In the dashboard, go to Settings ^> Presence ^& Wake ^> Real brightness control
echo and click "Test" to verify the connection.
echo.
pause
