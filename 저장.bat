@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion

set "EXIT_CODE=1"
set "CURRENT_BRANCH="
set "HAS_CHANGES="
set "COMMIT_MESSAGE="

goto main

:main
cd /d "%~dp0"
if errorlevel 1 goto project_folder_failed

:check_git
where git.exe >nul 2>&1
if errorlevel 1 goto git_not_found

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto not_git_repository

:check_branch
echo(
echo [1/6] 현재 브랜치를 확인합니다.
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not defined CURRENT_BRANCH goto detached_head
echo 현재 브랜치: %CURRENT_BRANCH%

:check_status
echo(
echo [2/6] Git 상태를 확인합니다.
git status
if errorlevel 1 goto status_failed

for /f "delims=" %%S in ('git status --porcelain') do set "HAS_CHANGES=1"
if defined HAS_CHANGES goto commit_changes
echo 커밋할 변경사항이 없습니다.
goto fetch_remote

:commit_changes
echo(
echo 변경 파일을 스테이징합니다.
git add -A
if errorlevel 1 goto add_failed

set /p "COMMIT_MESSAGE=Commit Message를 입력하세요 [기본값: Update]: "
if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Update"
set "COMMIT_MESSAGE=%COMMIT_MESSAGE:"=%"
if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Update"

echo 변경 내용을 커밋합니다.
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto commit_failed

:fetch_remote
echo(
echo [3/6] 원격 변경사항을 가져옵니다.
git fetch origin
if errorlevel 1 goto fetch_failed

:rebase_changes
echo(
echo [4/6] 원격 최신 내용을 rebase로 반영합니다.
git rebase "origin/%CURRENT_BRANCH%"
if errorlevel 1 goto rebase_failed

:push_changes
echo(
echo [5/6] GitHub에 변경사항을 전송합니다.
git push origin "%CURRENT_BRANCH%"
if errorlevel 1 goto push_failed

:success
echo(
echo [6/6] 저장이 완료되었습니다.
echo 현재 브랜치의 변경사항을 GitHub에 저장했습니다.
set "EXIT_CODE=0"
goto end

:rebase_failed
if exist ".git\rebase-merge" goto rebase_conflict
if exist ".git\rebase-apply" goto rebase_conflict
echo(
echo [오류] rebase 실행에 실패했습니다.
echo 위의 Git 오류 내용을 확인해 주세요.
goto failed

:rebase_conflict
echo(
echo ======================================
echo Git 충돌이 발생했습니다.
echo(
echo 충돌 파일을 수정한 후:
echo git add -A
echo git rebase --continue
echo(
echo 취소하려면:
echo git rebase --abort
echo(
echo 수정 후 저장.bat을 다시 실행하세요.
echo ======================================
goto failed

:project_folder_failed
echo(
echo [오류] 프로젝트 폴더로 이동하지 못했습니다.
goto failed

:git_not_found
echo(
echo [오류] Git이 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
goto failed

:not_git_repository
echo(
echo [오류] 현재 폴더는 Git 저장소가 아닙니다.
goto failed

:detached_head
echo(
echo [오류] 현재 브랜치가 없습니다. detached HEAD 상태를 확인해 주세요.
goto failed

:status_failed
echo(
echo [오류] Git 상태를 확인하지 못했습니다.
goto failed

:add_failed
echo(
echo [오류] 변경 파일 스테이징에 실패했습니다.
goto failed

:commit_failed
echo(
echo [오류] 커밋 생성에 실패했습니다.
goto failed

:fetch_failed
echo(
echo [오류] 원격 변경사항을 가져오지 못했습니다.
echo 네트워크와 GitHub 인증 상태를 확인해 주세요.
goto failed

:push_failed
echo(
echo [오류] GitHub 전송에 실패했습니다.
echo 원격 저장소와 GitHub 인증 상태를 확인해 주세요.
goto failed

:failed
echo(
echo [실패] 저장 작업을 중단했습니다.

:end
echo(
pause
endlocal & exit /b %EXIT_CODE%
