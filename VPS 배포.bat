@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion

set "VPS_HOST=139.180.195.148"
set "VPS_PORT=22"
set "VPS_USER=root"
set "REMOTE_PATH=/var/www/stayboard"
set "BRANCH=main"
set "PM2_APP=stayboard"
set "SERVICE_URL=http://139.180.195.148/stayboard"
set "REMOTE_TEMP=/tmp/deploy-stayboard.sh"
set "LOCAL_TEMP="
set "EXIT_CODE=1"

goto :main

:main
cd /d "%~dp0"
if errorlevel 1 goto local_path_failed

echo [준비] SSH 명령 사용 가능 여부를 확인합니다.
where ssh >nul 2>&1
if errorlevel 1 goto ssh_missing

echo [준비] SCP 명령 사용 가능 여부를 확인합니다.
where scp >nul 2>&1
if errorlevel 1 goto scp_missing

echo [준비] 임시 배포 스크립트 생성 도구를 확인합니다.
where powershell.exe >nul 2>&1
if errorlevel 1 goto powershell_missing

echo(
echo ======================================
echo StayBoard VPS 배포 정보
echo ======================================
echo 접속 대상: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
echo 원격 경로: %REMOTE_PATH%
echo 배포 브랜치: %BRANCH%
echo PM2 앱: %PM2_APP%
echo 서비스 주소: %SERVICE_URL%
echo ======================================
echo(
set /p "CONFIRM=실제 배포를 진행하시겠습니까? (Y/N): "
if /I "%CONFIRM%"=="Y" goto ssh_test
goto cancelled

:ssh_test
echo(
echo [연결 확인] VPS SSH 연결을 테스트합니다.
ssh -p "%VPS_PORT%" "%VPS_USER%@%VPS_HOST%" "echo SSH 연결 성공"
if errorlevel 1 goto ssh_failed
goto create_local_script

:create_local_script
set "LOCAL_TEMP=%TEMP%\deploy-stayboard-%RANDOM%-%RANDOM%.sh"
echo [준비] 안전한 원격 배포 스크립트를 생성합니다.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$lines=[IO.File]::ReadAllLines('%~f0',[Text.Encoding]::UTF8); $marker=[Array]::IndexOf($lines,':remote_script'); if($marker -lt 0){throw 'remote script marker not found'}; $payload=[string]::Join([char]10,$lines[($marker+1)..($lines.Length-1)])+[char]10; $utf8=[Text.UTF8Encoding]::new($false); [IO.File]::WriteAllText('%LOCAL_TEMP%',$payload,$utf8)"
if errorlevel 1 goto local_script_failed
if not exist "%LOCAL_TEMP%" goto local_script_failed
goto upload_script

:upload_script
echo [준비] 원격 임시 경로로 배포 스크립트를 전송합니다.
scp -P "%VPS_PORT%" "%LOCAL_TEMP%" "%VPS_USER%@%VPS_HOST%:%REMOTE_TEMP%"
if errorlevel 1 goto upload_failed
goto run_remote_script

:run_remote_script
echo [실행] VPS 배포를 시작합니다.
ssh -p "%VPS_PORT%" "%VPS_USER%@%VPS_HOST%" "bash %REMOTE_TEMP% '%REMOTE_PATH%' '%BRANCH%' '%PM2_APP%' '%SERVICE_URL%'"
set "DEPLOY_EXIT=%ERRORLEVEL%"
goto cleanup_remote

:cleanup_remote
echo [정리] 원격 임시 파일을 정리합니다.
ssh -p "%VPS_PORT%" "%VPS_USER%@%VPS_HOST%" "rm -f %REMOTE_TEMP%"
set "REMOTE_CLEANUP_EXIT=%ERRORLEVEL%"
call :cleanup_local
set "LOCAL_CLEANUP_EXIT=%ERRORLEVEL%"
if not "%DEPLOY_EXIT%"=="0" goto deploy_failed
if not "%REMOTE_CLEANUP_EXIT%"=="0" goto remote_cleanup_failed
if not "%LOCAL_CLEANUP_EXIT%"=="0" goto local_cleanup_failed
goto success

:cleanup_local
if not defined LOCAL_TEMP exit /b 0
if not exist "%LOCAL_TEMP%" exit /b 0
del /q "%LOCAL_TEMP%" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:success
echo [완료] 배포가 완료되었습니다.
echo(
echo [성공] Git 최신 코드, 의존성, Prisma, 빌드 및 PM2 반영이 완료되었습니다.
echo [서비스 주소] %SERVICE_URL%
set "EXIT_CODE=0"
goto end

:cancelled
echo(
echo [취소] 사용자가 배포를 취소했습니다.
set "EXIT_CODE=0"
goto end

:local_path_failed
echo(
echo [실패] BAT 파일이 있는 프로젝트 폴더로 이동하지 못했습니다.
goto end

:ssh_missing
echo(
echo [실패] ssh 명령을 찾을 수 없습니다. Windows OpenSSH Client를 설치하세요.
goto end

:scp_missing
echo(
echo [실패] scp 명령을 찾을 수 없습니다. Windows OpenSSH Client를 설치하세요.
goto end

:powershell_missing
echo(
echo [실패] powershell.exe 명령을 찾을 수 없습니다.
goto end

:ssh_failed
set "EXIT_CODE=%ERRORLEVEL%"
echo(
echo [실패] VPS SSH 연결 테스트에 실패했습니다. 오류 코드: %EXIT_CODE%
echo 접속 주소, 포트, SSH 키 또는 비밀번호를 확인하세요.
goto end

:local_script_failed
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="0" set "EXIT_CODE=1"
call :cleanup_local
echo(
echo [실패] 로컬 임시 배포 스크립트를 생성하지 못했습니다. 오류 코드: %EXIT_CODE%
goto end

:upload_failed
set "EXIT_CODE=%ERRORLEVEL%"
ssh -p "%VPS_PORT%" "%VPS_USER%@%VPS_HOST%" "rm -f %REMOTE_TEMP%" >nul 2>&1
call :cleanup_local
echo(
echo [실패] 배포 스크립트를 VPS로 전송하지 못했습니다. 오류 코드: %EXIT_CODE%
goto end

:deploy_failed
set "EXIT_CODE=%DEPLOY_EXIT%"
echo(
echo [배포 실패] VPS 배포가 중단되었습니다. 오류 코드: %EXIT_CODE%
echo 위에 표시된 실패 단계와 명령을 확인하세요.
echo Production Build가 실패한 경우 PM2 재시작은 실행되지 않습니다.
goto end

:remote_cleanup_failed
set "EXIT_CODE=%REMOTE_CLEANUP_EXIT%"
echo(
echo [정리 실패] 배포는 완료되었지만 원격 임시 파일 정리에 실패했습니다. 오류 코드: %EXIT_CODE%
echo 원격 임시 파일: %REMOTE_TEMP%
goto end

:local_cleanup_failed
set "EXIT_CODE=%LOCAL_CLEANUP_EXIT%"
echo(
echo [정리 실패] 배포는 완료되었지만 로컬 임시 파일 정리에 실패했습니다. 오류 코드: %EXIT_CODE%
echo 로컬 임시 파일: %LOCAL_TEMP%
goto end

:end
echo(
pause
endlocal & exit /b %EXIT_CODE%

:remote_script
#!/usr/bin/env bash
set -Eeuo pipefail

trap 'exit_code=$?; echo "[배포 실패] exit=$exit_code line=$LINENO command=$BASH_COMMAND" >&2; exit "$exit_code"' ERR

REMOTE_PATH="${1:?원격 프로젝트 경로가 필요합니다.}"
BRANCH="${2:?배포 브랜치가 필요합니다.}"
PM2_APP="${3:?PM2 앱 이름이 필요합니다.}"
SERVICE_URL="${4:?서비스 확인 주소가 필요합니다.}"

echo "[1/11] 프로젝트 경로와 안전 백업 대상을 확인합니다."
if [[ ! -d "$REMOTE_PATH" ]]; then
  echo "[배포 실패] 프로젝트 경로가 없습니다: $REMOTE_PATH" >&2
  exit 1
fi

cd "$REMOTE_PATH"

if [[ ! -d .git ]]; then
  echo "[배포 실패] Git 저장소가 아닙니다: $REMOTE_PATH" >&2
  exit 1
fi

if [[ -f stayboard-local.dump ]]; then
  mkdir -p /root/stayboard-backups
  BACKUP_FILE="/root/stayboard-backups/stayboard-local-$(date +%Y%m%d-%H%M%S).dump"
  mv -- stayboard-local.dump "$BACKUP_FILE"
  echo "[백업 완료] stayboard-local.dump -> $BACKUP_FILE"
else
  echo "[백업 생략] stayboard-local.dump 파일이 없습니다."
fi

OLD_COMMIT="$(git rev-parse HEAD)"

echo "[2/11] 최신 코드를 fast-forward 방식으로 반영합니다."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

NEW_COMMIT="$(git rev-parse HEAD)"

echo "[3/11] 변경된 파일을 분석합니다."
CHANGED_FILES="$(git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" || true)"
if [[ -n "$CHANGED_FILES" ]]; then
  printf '%s\n' "$CHANGED_FILES"
else
  echo "변경된 파일이 없습니다."
fi

PACKAGE_CHANGED=0
PRISMA_GENERATE_CHANGED=0

if grep -Eq '^(package\.json|package-lock\.json)$' <<<"$CHANGED_FILES"; then
  PACKAGE_CHANGED=1
fi

if grep -Eq '^(prisma/schema\.prisma|prisma\.config\.ts|prisma/migrations/)' <<<"$CHANGED_FILES"; then
  PRISMA_GENERATE_CHANGED=1
fi

echo "[4/11] 운영 환경 파일과 권한 테스트 설정을 확인합니다."
ENV_FILE="$REMOTE_PATH/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[배포 실패] 실제 운영 환경 파일이 없습니다: $ENV_FILE" >&2
  exit 1
fi
if [[ ! -f scripts/ensure-developer-role-switch-env.mjs ]]; then
  echo "[배포 실패] 운영 환경 설정 도구를 찾을 수 없습니다." >&2
  exit 1
fi
node scripts/ensure-developer-role-switch-env.mjs "$ENV_FILE"
node scripts/ensure-developer-role-switch-env.mjs --check "$ENV_FILE"
export ENABLE_DEVELOPER_ROLE_SWITCH=true
echo "[환경 확인] 권한 테스트 모드가 활성화되어 있습니다."

echo "[5/11] 의존성 설치 필요 여부를 확인합니다."
NPM_CI_RAN=0
if [[ ! -d node_modules || "$PACKAGE_CHANGED" -eq 1 ]]; then
  npm ci --include=dev
  NPM_CI_RAN=1
else
  echo "[생략] node_modules가 있고 패키지 파일 변경이 없습니다."
fi

export NODE_ENV=production

echo "[6/11] Prisma 변경 여부를 확인합니다."
if [[ "$NPM_CI_RAN" -eq 1 || "$PRISMA_GENERATE_CHANGED" -eq 1 ]]; then
  npx prisma generate
else
  echo "[생략] Prisma Client 재생성 조건에 해당하지 않습니다."
fi

echo "[적용] 미적용 Prisma migration을 확인하고 적용합니다."
npx prisma migrate deploy

echo "[7/11] Production Build를 실행합니다."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo "[8/11] Build 성공 후 PM2 앱을 갱신된 환경으로 재시작합니다."
pm2 restart "$PM2_APP" --update-env
pm2 save

echo "[9/11] PM2 앱 상태와 최소 환경값을 확인합니다."
pm2 status "$PM2_APP"
pm2 jlist 2>/dev/null | node -e '
let data = "";
process.stdin.on("data", (chunk) => data += chunk);
process.stdin.on("end", () => {
  const [appName, expectedCwd] = process.argv.slice(1);
  const app = JSON.parse(data).find((item) => item.name === appName);
  if (!app) throw new Error(`PM2 앱을 찾을 수 없습니다: ${appName}`);
  const env = app.pm2_env || {};
  const roleSwitchEnabled = String(env.ENABLE_DEVELOPER_ROLE_SWITCH || "").trim().toLowerCase() === "true";
  if (env.status !== "online") throw new Error(`PM2 상태가 online이 아닙니다: ${env.status || "unknown"}`);
  if (env.pm_cwd !== expectedCwd) throw new Error(`PM2 cwd가 올바르지 않습니다: ${env.pm_cwd || "unset"}`);
  if (env.NODE_ENV !== "production") throw new Error(`PM2 NODE_ENV가 production이 아닙니다: ${env.NODE_ENV || "unset"}`);
  if (!roleSwitchEnabled) throw new Error("PM2 프로세스에 권한 테스트 환경변수가 반영되지 않았습니다.");
  console.log(`[환경 확인] PM2 status=${env.status}`);
  console.log(`[환경 확인] PM2 cwd=${env.pm_cwd}`);
  console.log(`[환경 확인] PM2 NODE_ENV=${env.NODE_ENV}`);
  console.log("[환경 확인] ENABLE_DEVELOPER_ROLE_SWITCH=true");
});
' "$PM2_APP" "$REMOTE_PATH"

echo "[10/11] 서비스 응답을 확인합니다."
curl --fail --silent --show-error --max-time 20 "$SERVICE_URL" >/dev/null

echo "[11/11] 배포 후 환경 및 서비스 확인이 완료되었습니다."
