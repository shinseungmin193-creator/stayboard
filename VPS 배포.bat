@echo off
chcp 65001 >nul
setlocal

rem ===== 사용자 설정값 =====
set "VPS_USER=root"
set "VPS_HOST=여기에_VPS_IP"
set "VPS_PORT=22"
set "VPS_PROJECT_PATH=/var/www/stayboard"
set "PM2_APP_NAME=stayboard"
set "BRANCH=main"
rem =========================

cd /d "%~dp0" || goto :error

echo [1/4] SSH 명령 사용 가능 여부를 확인합니다.
where ssh >nul 2>&1 || (
  echo [오류] ssh 명령을 찾을 수 없습니다. Windows OpenSSH Client를 설치하세요.
  goto :failed
)

if /i "%VPS_HOST%"=="여기에_VPS_IP" (
  echo [설정 필요] VPS 배포.bat 상단의 VPS_HOST를 실제 VPS IP 또는 호스트명으로 변경하세요.
  goto :failed
)
if "%VPS_HOST%"=="" (
  echo [설정 필요] VPS_HOST가 비어 있습니다.
  goto :failed
)

echo [2/4] VPS 접속 정보를 확인합니다.
echo   접속 대상: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
echo   프로젝트: %VPS_PROJECT_PATH%
echo   브랜치: %BRANCH%
echo   PM2 앱: %PM2_APP_NAME%
echo.
set /p "DEPLOY_CONFIRM=실제 배포를 진행하시겠습니까? (Y/N): "
if /i not "%DEPLOY_CONFIRM%"=="Y" (
  echo [취소] 배포를 실행하지 않았습니다.
  set "EXIT_CODE=0"
  goto :end
)

echo [3/4] VPS에 접속해 최신 코드 반영, 패키지 설치, Prisma 갱신, 빌드, PM2 재시작을 수행합니다.
set "REMOTE_COMMAND=set -e; cd '%VPS_PROJECT_PATH%' ^&^& echo '[1/9] GitHub 원격 정보를 가져옵니다.' ^&^& git fetch origin ^&^& echo '[2/9] 배포 브랜치로 이동합니다.' ^&^& git checkout '%BRANCH%' ^&^& echo '[3/9] 최신 코드를 fast-forward 방식으로 반영합니다.' ^&^& git pull --ff-only origin '%BRANCH%' ^&^& echo '[4/9] 잠금 파일 기준으로 패키지를 설치합니다.' ^&^& npm ci ^&^& echo '[5/9] Prisma Client를 생성합니다.' ^&^& npx prisma generate ^&^& echo '[6/9] Prisma 마이그레이션을 적용합니다.' ^&^& npx prisma migrate deploy ^&^& echo '[7/9] Next.js 프로덕션 빌드를 실행합니다.' ^&^& npm run build ^&^& echo '[8/9] PM2 앱을 재시작하고 현재 구성을 저장합니다.' ^&^& pm2 restart '%PM2_APP_NAME%' --update-env ^&^& pm2 save ^&^& echo '[9/9] PM2 상태를 확인합니다.' ^&^& pm2 status"

ssh -p "%VPS_PORT%" "%VPS_USER%@%VPS_HOST%" "%REMOTE_COMMAND%" || goto :ssh_error

echo [4/4] VPS 배포 결과를 확인합니다.
echo.
echo [완료] GitHub 최신 코드 반영이 완료되었습니다.
echo [완료] 패키지 설치가 완료되었습니다.
echo [완료] Prisma Client 생성과 마이그레이션이 완료되었습니다.
echo [완료] Next.js 빌드가 완료되었습니다.
echo [완료] PM2 재시작과 상태 확인이 완료되었습니다.
set "EXIT_CODE=0"
goto :end

:ssh_error
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [배포 실패] SSH 연결 또는 VPS 서버 명령 실행에 실패했습니다. 오류 코드: %EXIT_CODE%
echo 위에 표시된 SSH 또는 서버 명령 오류를 확인하세요. 실패 이후 단계는 실행되지 않았습니다.
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
