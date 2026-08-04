@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion

set "EXIT_CODE=1"

cd /d "%~dp0"
if errorlevel 1 (
    echo [오류] 프로젝트 폴더로 이동하지 못했습니다.
    goto :end
)

where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo [오류] Windows PowerShell을 찾을 수 없습니다.
    goto :end
)

if not exist "%~dp0scripts\pull-server-db.ps1" (
    echo [오류] DB 가져오기 스크립트를 찾을 수 없습니다.
    echo 확인한 경로: %~dp0scripts\pull-server-db.ps1
    goto :end
)

if /I "%~1"=="--check" (
    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\pull-server-db.ps1" -CheckOnly
) else (
    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\pull-server-db.ps1" %*
)
set "EXIT_CODE=%ERRORLEVEL%"

:end
echo(
if not defined STAYBOARD_DB_PULL_NO_PAUSE pause
endlocal & exit /b %EXIT_CODE%
