@echo off
chcp 65001 >nul
setlocal

echo [1/10] BAT 파일이 있는 프로젝트 폴더로 이동합니다.
cd /d "%~dp0" || goto :error

echo [2/10] Git 설치 여부를 확인합니다.
where git >nul 2>&1 || (
  echo [오류] Git을 찾을 수 없습니다. Git을 설치하고 PATH를 확인하세요.
  goto :failed
)

echo [3/10] 현재 폴더가 Git 저장소인지 확인합니다.
git rev-parse --is-inside-work-tree >nul 2>&1 || (
  echo [오류] 현재 폴더는 Git 저장소가 아닙니다: %CD%
  goto :failed
)

echo [4/10] 현재 브랜치를 확인합니다.
git branch --show-current || goto :error

echo [5/10] 로컬 변경사항을 확인합니다.
set "HAS_CHANGES="
for /f "delims=" %%I in ('git status --porcelain') do set "HAS_CHANGES=1"
if defined HAS_CHANGES (
  echo.
  echo [중단] 다음 로컬 변경사항이 있습니다.
  git status --short
  echo.
  echo 먼저 GitHub 저장을 실행하거나 변경사항을 정리하세요.
  echo 로컬 변경사항은 삭제하거나 임시 보관하지 않았습니다.
  goto :failed
)

echo [6/10] GitHub 원격 저장소의 최신 정보를 가져옵니다.
git fetch origin || goto :error

echo [7/10] 기본 브랜치 main으로 이동합니다.
git checkout main || goto :error

echo [8/10] main 브랜치를 fast-forward 방식으로 업데이트합니다.
git pull --ff-only origin main || goto :error

echo [9/10] package-lock.json 변경 가능성을 반영해 패키지를 설치합니다.
call npm.cmd install || goto :error

echo [10/10] Prisma Client를 갱신합니다.
call npx.cmd prisma generate || goto :error

echo.
echo [완료] GitHub 최신 코드, 패키지, Prisma Client 갱신이 완료되었습니다.
goto :success

:error
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [오류] 명령 실행에 실패했습니다. 오류 코드: %EXIT_CODE%
echo 위에 표시된 오류 내용을 확인하세요.
goto :end

:failed
set "EXIT_CODE=1"
goto :end

:success
set "EXIT_CODE=0"

:end
echo.
pause
exit /b %EXIT_CODE%
