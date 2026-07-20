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

echo 현재 Git 상태:
echo.
git status
if errorlevel 1 (
    echo.
    echo [실패] Git 상태를 확인하지 못했습니다. 위의 오류 내용을 확인해 주세요.
    goto :end
)

echo.
set "COMMIT_MESSAGE="
set /p "COMMIT_MESSAGE=Commit Message를 입력하세요 [기본값: Update]: "
if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Update"
set "COMMIT_MESSAGE=%COMMIT_MESSAGE:"=%"
if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Update"

echo.
echo 변경 파일을 스테이징합니다.
git add .
if errorlevel 1 (
    echo [실패] git add 실행에 실패했습니다. 위의 오류 내용을 확인해 주세요.
    goto :end
)

echo 변경 내용을 커밋합니다.
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 (
    echo [실패] git commit 실행에 실패했습니다. 커밋할 변경 사항과 위의 오류 내용을 확인해 주세요.
    goto :end
)

echo GitHub에 변경 내용을 전송합니다.
git push
if errorlevel 1 (
    echo [실패] git push 실행에 실패했습니다. 원격 저장소, 브랜치, 인증 상태와 위의 오류 내용을 확인해 주세요.
    goto :end
)

echo.
echo [성공] 변경 내용을 GitHub에 저장했습니다.

:end
echo.
pause
endlocal
