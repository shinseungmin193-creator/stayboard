@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"
if errorlevel 1 (
    echo [오류] 프로젝트 폴더로 이동하지 못했습니다.
    goto :end
)

where git.exe >nul 2>&1
if errorlevel 1 (
    echo [오류] Git이 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
    echo Git for Windows를 설치한 뒤 다시 실행해 주세요.
    goto :end
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [오류] 현재 폴더는 Git 저장소가 아닙니다.
    echo 확인한 폴더: %CD%
    goto :end
)

echo GitHub에서 최신 내용을 가져옵니다.
echo.
git pull
if errorlevel 1 (
    echo.
    echo [실패] git pull 실행에 실패했습니다. 충돌, 원격 저장소, 인증 상태와 위의 오류 내용을 확인해 주세요.
    goto :end
)

echo.
echo [성공] GitHub의 최신 내용을 가져왔습니다.

:end
echo.
pause
endlocal
