@echo off
REM One-click launcher for the Morning Routine Dashboard setup on Windows.
REM Runs the PowerShell script with execution policy bypassed for this session.

setlocal
set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup.ps1" %*

echo.
echo Setup finished. Press any key to close this window.
pause >nul
endlocal
