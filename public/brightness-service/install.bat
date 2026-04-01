@echo off
echo Installing Pikes Brightness Service...
echo.

REM Get the directory of this script
set "DIR=%~dp0"
set "SCRIPT=%DIR%server.js"
set "STARTER=%DIR%start-service.bat"

REM Check server.js is present
if not exist "%SCRIPT%" (
    echo ERROR: server.js not found in %DIR%
    echo Make sure you copied the entire brightness-service folder.
    pause
    exit /b 1
)

REM Check Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Download it from https://nodejs.org and re-run this script.
    pause
    exit /b 1
)

REM Register a scheduled task using start-service.bat as the command
REM (avoids quoting issues with paths that contain spaces)
echo Registering Windows startup task...
schtasks /create /tn "PikesBrightnessService" /tr "\"%STARTER%\"" /sc onlogon /ru "%USERNAME%" /rl HIGHEST /f
if %ERRORLEVEL% neq 0 (
    echo WARNING: Could not register startup task. Try running as Administrator.
) else (
    echo Startup task registered successfully.
)

REM Start the service immediately using pushd so the working dir is correct
echo Starting service...
start "PikesBrightness" /d "%DIR%" /min cmd /c node server.js

echo.
echo Done! The brightness service is now running on port 3737.
echo It will start automatically on next login.
echo.
echo In the dashboard, go to Settings ^> Presence ^& Wake ^> Real brightness control
echo and click "Test" to verify the connection.
echo.
pause
