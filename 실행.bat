@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"
if errorlevel 1 (
    echo [오류] 프로젝트 폴더로 이동하지 못했습니다.
    goto :end
)

where node.exe >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
    echo Node.js를 설치한 뒤 다시 실행해 주세요.
    goto :end
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [오류] npm이 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
    echo Node.js 설치 상태를 확인한 뒤 다시 실행해 주세요.
    goto :end
)

if not exist "package.json" (
    echo [오류] 현재 폴더에서 package.json을 찾을 수 없습니다.
    echo 확인한 폴더: %CD%
    goto :end
)

echo StayBoard 개발 서버를 시작합니다.
echo 종료하려면 Ctrl+C를 누르세요.
echo.
call npm.cmd run dev
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [실패] 개발 서버가 오류 코드 %EXIT_CODE%^(으^)로 종료되었습니다.
    echo 위의 npm 오류 내용을 확인해 주세요.
) else (
    echo.
    echo [완료] 개발 서버가 정상적으로 종료되었습니다.
)

:end
echo.
pause
endlocal
