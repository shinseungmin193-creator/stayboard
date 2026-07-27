@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion

rem ===== 사용자 설정값 =====
set "VPS_USER=root"
set "VPS_HOST=139.180.195.148"
set "VPS_PORT=22"
set "REMOTE_DIR=/var/www/stayboard"
set "PM2_APP_NAME=stayboard"
set "BRANCH=main"
set "SERVICE_URL=http://139.180.195.148/stayboard"
rem =========================

cd /d "%~dp0" || goto :error

echo [1/5] SSH 명령 사용 가능 여부를 확인합니다.
where ssh >nul 2>&1 || (
  echo [오류] ssh 명령을 찾을 수 없습니다. Windows OpenSSH Client를 설치하세요.
  goto :failed
)

if "%VPS_HOST%"=="" (
  echo [설정 필요] VPS_HOST가 비어 있습니다.
  goto :failed
)

echo [2/5] VPS 접속 정보를 확인합니다.
echo   접속 대상: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
echo   원격 경로: %REMOTE_DIR%
echo   브랜치: %BRANCH%
echo   PM2 앱: %PM2_APP_NAME%
echo.
set /p "DEPLOY_CONFIRM=실제 배포를 진행하시겠습니까? (Y/N): "
if /i not "%DEPLOY_CONFIRM%"=="Y" (
  echo [취소] 배포를 실행하지 않았습니다.
  set "EXIT_CODE=0"
  goto :end
)

echo [3/5] SSH 연결을 테스트합니다.
ssh -p "%VPS_PORT%" "%VPS_USER%@%VPS_HOST%" "echo '[2/11] SSH 연결 성공'" || goto :connection_error

echo [4/5] VPS에서 배포 명령을 순서대로 실행합니다.
ssh -p "%VPS_PORT%" "%VPS_USER%@%VPS_HOST%" "set -e; echo '[3/11] 프로젝트 경로로 이동합니다.' && cd '%REMOTE_DIR%' && echo '[4/11] 충돌 가능한 dump 파일을 안전하게 백업합니다.' && if [ -f stayboard-local.dump ]; then mkdir -p /root/stayboard-backups; BACKUP_FILE=/root/stayboard-backups/stayboard-local-$(date +%%Y%%m%%d-%%H%%M%%S).dump; mv stayboard-local.dump $BACKUP_FILE; echo '[백업 완료] stayboard-local.dump to' $BACKUP_FILE; else echo '[백업 생략] stayboard-local.dump 파일이 없습니다.'; fi && echo '[5/11] main 브랜치 최신 코드를 반영합니다.' && git fetch origin && git checkout '%BRANCH%' && git pull --ff-only origin '%BRANCH%' && echo '[6/11] 의존성을 설치합니다.' && npm ci && echo '[7/11] Prisma Client를 생성합니다.' && npx prisma generate && echo '[8/11] Prisma Migration을 적용합니다.' && npx prisma migrate deploy && echo '[9/11] Production Build를 실행합니다.' && npm run build && echo '[10/11] PM2 프로세스를 재시작합니다.' && pm2 restart '%PM2_APP_NAME%' --update-env && echo '[11/11] PM2 상태를 확인합니다.' && pm2 status" || goto :deploy_error

echo [5/5] VPS 배포 결과를 확인합니다.
echo.
echo [완료] GitHub 최신 코드 반영이 완료되었습니다.
echo [완료] 패키지 설치가 완료되었습니다.
echo [완료] Prisma Client 생성과 마이그레이션이 완료되었습니다.
echo [완료] Next.js 빌드가 완료되었습니다.
echo [완료] PM2 재시작과 상태 확인이 완료되었습니다.
echo [서비스 주소] %SERVICE_URL%
set "EXIT_CODE=0"
goto :end

:connection_error
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [연결 실패] SSH 연결 테스트에 실패했습니다. 오류 코드: %EXIT_CODE%
echo root@%VPS_HOST% 접속 정보, SSH 키 또는 비밀번호, 포트 설정을 확인하세요.
goto :end

:deploy_error
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [배포 실패] VPS 배포 명령 실행에 실패했습니다. 오류 코드: %EXIT_CODE%
echo 마지막으로 출력된 단계와 서버 오류를 확인하세요. 실패 이후 단계는 실행되지 않았습니다.
goto :end

:error
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [오류] 로컬 명령 실행에 실패했습니다. 오류 코드: %EXIT_CODE%
echo 위에 표시된 오류 내용을 확인하세요.
goto :end

:failed
set "EXIT_CODE=1"

:end
echo.
pause
exit /b %EXIT_CODE%
