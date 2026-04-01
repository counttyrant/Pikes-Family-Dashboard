@echo off
echo Uninstalling Pikes Brightness Service...
echo.

REM Delete the scheduled task
schtasks /delete /tn "PikesBrightnessService" /f
if %ERRORLEVEL% neq 0 (
    echo WARNING: Task not found or could not be deleted.
) else (
    echo Startup task removed.
)

REM Kill any running instance
tasklist | find "node.exe" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Stopping running node processes associated with this service...
    for /f "tokens=2" %%i in ('tasklist ^| find "node.exe"') do (
        wmic process where "ProcessId=%%i and CommandLine like '%%server.js%%'" delete >nul 2>&1
    )
)

echo.
echo Done. The brightness service has been removed.
pause
