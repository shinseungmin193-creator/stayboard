[CmdletBinding()]
param(
    [string]$ConfigPath,
    [Alias("CheckOnly")]
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path $ProjectRoot ".env.server-db-pull"
} elseif (-not [System.IO.Path]::IsPathRooted($ConfigPath)) {
    $ConfigPath = Join-Path $ProjectRoot $ConfigPath
}

$RequiredConfigKeys = @(
    "SSH_HOST",
    "SSH_PORT",
    "SSH_USER",
    "REMOTE_DB_NAME",
    "REMOTE_DB_USER",
    "REMOTE_DUMP_PATH",
    "LOCAL_DB_HOST",
    "LOCAL_DB_PORT",
    "LOCAL_DB_NAME",
    "LOCAL_DB_USER"
)
$ProtectedDatabaseNames = @("postgres", "template0", "template1")
$LoopbackHosts = @("localhost", "127.0.0.1", "::1", "[::1]")
$RestoreAttemptLimit = 2
$RestoreLockTimeoutMilliseconds = 15000
$LocalConnectionTimeoutMilliseconds = 3000

function Write-Step {
    param(
        [Parameter(Mandatory = $true)][int]$Number,
        [Parameter(Mandatory = $true)][int]$Total,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $script:CurrentStage = $Message
    Write-Host ""
    Write-Host "[$Number/$Total] $Message"
}

function Read-DbPullConfig {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "[설정 파일] 설정 파일을 찾을 수 없습니다: $Path`n.env.server-db-pull.example을 복사하여 .env.server-db-pull을 직접 작성해 주세요."
    }

    $values = @{}
    $lineNumber = 0
    foreach ($rawLine in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $lineNumber += 1
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            continue
        }

        $parts = $line -split "=", 2
        if ($parts.Count -ne 2) {
            throw "[설정 파일] ${lineNumber}번째 줄 형식이 올바르지 않습니다. KEY=VALUE 형식으로 작성해 주세요."
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($key -notmatch "^[A-Z][A-Z0-9_]*$") {
            throw "[설정 파일] ${lineNumber}번째 줄의 설정 이름이 올바르지 않습니다: $key"
        }
        if ($values.ContainsKey($key)) {
            throw "[설정 파일] 설정값이 중복되었습니다: $key"
        }

        if ($value.Length -ge 2) {
            $firstCharacter = $value.Substring(0, 1)
            $lastCharacter = $value.Substring($value.Length - 1, 1)
            if (($firstCharacter -eq '"' -and $lastCharacter -eq '"') -or
                ($firstCharacter -eq "'" -and $lastCharacter -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $values[$key] = $value
    }

    return $values
}

function Test-PortNumber {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $port = 0
    if (-not [int]::TryParse($Value, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
        throw "[설정 검증] $Name 값은 1~65535 범위의 포트 번호여야 합니다: $Value"
    }
}

function Assert-SafeConfig {
    param([Parameter(Mandatory = $true)][hashtable]$Config)

    $missingKeys = @(
        $RequiredConfigKeys | Where-Object {
            -not $Config.ContainsKey($_) -or [string]::IsNullOrWhiteSpace([string]$Config[$_])
        }
    )
    if ($missingKeys.Count -gt 0) {
        throw "[설정 검증] 다음 필수 설정값이 누락되었습니다: $($missingKeys -join ', ')"
    }

    Test-PortNumber -Name "SSH_PORT" -Value $Config["SSH_PORT"]
    Test-PortNumber -Name "LOCAL_DB_PORT" -Value $Config["LOCAL_DB_PORT"]

    $sshHost = $Config["SSH_HOST"].Trim()
    $localHost = $Config["LOCAL_DB_HOST"].Trim()
    $localDatabase = $Config["LOCAL_DB_NAME"].Trim()

    if ($sshHost -eq "서버_IP") {
        throw "[설정 검증] SSH_HOST의 예시 값을 실제 운영 서버 주소로 변경해 주세요."
    }
    if ($sshHost -notmatch "^[A-Za-z0-9.-]+$" -or $sshHost.StartsWith("-")) {
        throw "[설정 검증] SSH_HOST 형식이 올바르지 않습니다: $sshHost"
    }
    if ($LoopbackHosts -icontains $sshHost -or $sshHost -imatch "^localhost\.?$" -or
        $sshHost -match "^127\." -or $sshHost -eq "0.0.0.0") {
        throw "[안전 차단] SSH_HOST에 로컬 주소를 사용할 수 없습니다: $sshHost"
    }
    if ($LoopbackHosts -inotcontains $localHost) {
        throw "[안전 차단] LOCAL_DB_HOST는 로컬 PostgreSQL만 허용합니다. localhost 또는 루프백 주소를 입력해 주세요: $localHost"
    }
    if ($sshHost -ieq $localHost) {
        throw "[안전 차단] 운영 서버와 로컬 DB 호스트가 같습니다. 서로 다른 호스트인지 확인해 주세요."
    }
    if ($ProtectedDatabaseNames -icontains $localDatabase) {
        throw "[안전 차단] PostgreSQL 시스템 DB에는 복원할 수 없습니다: $localDatabase"
    }

    foreach ($key in @("SSH_USER", "REMOTE_DB_NAME", "REMOTE_DB_USER", "LOCAL_DB_NAME", "LOCAL_DB_USER")) {
        $value = $Config[$key].Trim()
        if ($value -notmatch "^[A-Za-z0-9_.-]+$" -or $value.StartsWith("-")) {
            throw "[설정 검증] $key 값에는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다: $value"
        }
    }

    $remoteDumpPath = $Config["REMOTE_DUMP_PATH"].Trim()
    if (-not $remoteDumpPath.StartsWith("/") -or $remoteDumpPath -eq "/") {
        throw "[안전 차단] REMOTE_DUMP_PATH는 파일명을 포함한 절대 경로여야 합니다: $remoteDumpPath"
    }
    if ($remoteDumpPath -notmatch "^[A-Za-z0-9_./-]+\.dump$" -or $remoteDumpPath.Contains("..")) {
        throw "[안전 차단] REMOTE_DUMP_PATH는 안전한 .dump 경로여야 하며 '..'을 포함할 수 없습니다: $remoteDumpPath"
    }
}

function Resolve-ApplicationPath {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command -Name $Name -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($null -eq $command) {
        return $null
    }
    return $command.Source
}

function Get-PostgreSqlTools {
    $candidateDirectories = New-Object System.Collections.Generic.List[string]
    $pathDump = Resolve-ApplicationPath -Name "pg_dump.exe"
    if (-not [string]::IsNullOrWhiteSpace($pathDump)) {
        $candidateDirectories.Add((Split-Path -Parent $pathDump))
    }

    $programRoots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique

    foreach ($programRoot in $programRoots) {
        foreach ($pattern in @("PostgreSQL\*\bin", "PostgreSQL*\bin")) {
            $searchPath = Join-Path $programRoot $pattern
            foreach ($directory in Get-Item -Path $searchPath -ErrorAction SilentlyContinue) {
                $candidateDirectories.Add($directory.FullName)
            }
        }
    }

    $validCandidates = foreach ($directory in $candidateDirectories | Select-Object -Unique) {
        $dumpPath = Join-Path $directory "pg_dump.exe"
        $restorePath = Join-Path $directory "pg_restore.exe"
        $psqlPath = Join-Path $directory "psql.exe"
        if ((Test-Path -LiteralPath $dumpPath -PathType Leaf) -and
            (Test-Path -LiteralPath $restorePath -PathType Leaf) -and
            (Test-Path -LiteralPath $psqlPath -PathType Leaf)) {
            $versionText = Split-Path -Leaf (Split-Path -Parent $directory)
            $parsedVersion = [version]"0.0"
            $candidateVersion = $null
            if ([version]::TryParse($versionText, [ref]$candidateVersion)) {
                $parsedVersion = $candidateVersion
            }

            [pscustomobject]@{
                BinDirectory = $directory
                Version = $parsedVersion
                PgDump = $dumpPath
                PgRestore = $restorePath
                Psql = $psqlPath
            }
        }
    }

    $selected = $validCandidates |
        Sort-Object -Property @{ Expression = "Version"; Descending = $true }, @{ Expression = "BinDirectory"; Descending = $true } |
        Select-Object -First 1

    if ($null -eq $selected) {
        throw "[도구 탐색] pg_dump.exe, pg_restore.exe, psql.exe를 찾을 수 없습니다.`nPostgreSQL 클라이언트를 설치하거나 PostgreSQL bin 경로를 PATH에 추가해 주세요.`n자동 탐색 위치: C:\Program Files\PostgreSQL\<버전>\bin"
    }

    return $selected
}

function Test-LocalPostgreSqlTcpEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][int]$TimeoutMilliseconds
    )

    $client = New-Object System.Net.Sockets.TcpClient
    $asyncResult = $null
    try {
        $asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $asyncResult.AsyncWaitHandle.WaitOne($TimeoutMilliseconds)) {
            throw "연결 제한 시간 ${TimeoutMilliseconds}ms를 초과했습니다."
        }
        $client.EndConnect($asyncResult)
    } finally {
        if ($null -ne $asyncResult) {
            $asyncResult.AsyncWaitHandle.Close()
        }
        $client.Close()
    }
}

function ConvertTo-PosixQuotedValue {
    param([Parameter(Mandatory = $true)][string]$Value)

    $singleQuote = [char]39
    $doubleQuote = [char]34
    $replacement = "$singleQuote$doubleQuote$singleQuote$doubleQuote$singleQuote"
    return "$singleQuote$($Value.Replace([string]$singleQuote, $replacement))$singleQuote"
}

function Get-RemotePgDumpDiscoveryCommand {
    $pgDumpVariable = '$PG_DUMP_PATH'
    return "PG_DUMP_PATH=`$(command -v pg_dump 2>/dev/null || true); if [ -z `"$pgDumpVariable`" ] && [ -x /usr/bin/pg_dump ]; then PG_DUMP_PATH=/usr/bin/pg_dump; fi; if [ -z `"$pgDumpVariable`" ]; then echo 'pg_dump 명령을 찾을 수 없습니다.' >&2; exit 127; fi"
}

function Get-RemotePreflightCommand {
    param([Parameter(Mandatory = $true)][string]$RemoteDatabaseUser)

    $quotedRemoteUser = ConvertTo-PosixQuotedValue -Value $RemoteDatabaseUser
    $pgDumpVariable = '$PG_DUMP_PATH'
    $discoveryCommand = Get-RemotePgDumpDiscoveryCommand
    return "set -e; command -v sudo >/dev/null 2>&1 || { echo 'sudo 명령을 찾을 수 없습니다.' >&2; exit 127; }; sudo -n -u $quotedRemoteUser true; $discoveryCommand; printf 'REMOTE_PG_DUMP=%s\n' `"$pgDumpVariable`""
}

function ConvertTo-Base64Utf8 {
    param([Parameter(Mandatory = $true)][string]$Value)

    return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
}

function Get-RemoteDatabaseInspectionCommand {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteDatabaseUser,
        [Parameter(Mandatory = $true)][string]$RemoteDatabaseName
    )

    $quotedRemoteUser = ConvertTo-PosixQuotedValue -Value $RemoteDatabaseUser
    $quotedRemoteDatabase = ConvertTo-PosixQuotedValue -Value $RemoteDatabaseName
    $listSql = "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'template0', 'template1') ORDER BY datname;"
    $coreTableSql = "SELECT count(*) FROM (VALUES (to_regclass('public.`"Company`"')), (to_regclass('public.`"Property`"')), (to_regclass('public.`"Room`"')), (to_regclass('public.`"Reservation`"'))) AS core_table(relation) WHERE relation IS NOT NULL;"
    $quotedListSqlBase64 = ConvertTo-PosixQuotedValue -Value (ConvertTo-Base64Utf8 -Value $listSql)
    $quotedCoreTableSqlBase64 = ConvertTo-PosixQuotedValue -Value (ConvertTo-Base64Utf8 -Value $coreTableSql)

    $inspectionScript = @"
set -e
command -v sudo >/dev/null 2>&1 || { echo 'sudo 명령을 찾을 수 없습니다.' >&2; exit 127; }
sudo -n -u $quotedRemoteUser true
PSQL_PATH=`$(command -v psql 2>/dev/null || true)
if [ -z "`$PSQL_PATH" ] && [ -x /usr/bin/psql ]; then PSQL_PATH=/usr/bin/psql; fi
if [ -z "`$PSQL_PATH" ]; then echo 'psql 명령을 찾을 수 없습니다.' >&2; exit 127; fi
LIST_SQL=`$(printf %s $quotedListSqlBase64 | base64 -d)
CORE_TABLE_SQL=`$(printf %s $quotedCoreTableSqlBase64 | base64 -d)
DATABASES=`$(sudo -n -u $quotedRemoteUser "`$PSQL_PATH" -d postgres -Atc "`$LIST_SQL")
if printf '%s\n' "`$DATABASES" | grep -Fxq -- $quotedRemoteDatabase; then
  printf 'CONFIGURED_DB_EXISTS=1\n'
else
  printf 'CONFIGURED_DB_EXISTS=0\n'
fi
printf '%s\n' "`$DATABASES" | while IFS= read -r DATABASE_NAME; do
  [ -n "`$DATABASE_NAME" ] || continue
  printf 'REMOTE_DATABASE=%s\n' "`$DATABASE_NAME"
  CORE_TABLE_COUNT=`$(sudo -n -u $quotedRemoteUser "`$PSQL_PATH" -d "`$DATABASE_NAME" -Atc "`$CORE_TABLE_SQL" 2>/dev/null || printf 'ERROR')
  if [ "`$CORE_TABLE_COUNT" = '4' ]; then
    printf 'STAYBOARD_CANDIDATE=%s\n' "`$DATABASE_NAME"
  fi
done
"@.Trim()
    $quotedInspectionScriptBase64 = ConvertTo-PosixQuotedValue -Value (ConvertTo-Base64Utf8 -Value $inspectionScript)
    return "printf %s $quotedInspectionScriptBase64 | base64 -d | bash"
}

function Get-RemoteDumpCommand {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteDatabaseUser,
        [Parameter(Mandatory = $true)][string]$RemoteDatabaseName,
        [Parameter(Mandatory = $true)][string]$RemoteDumpPath
    )

    $quotedRemoteUser = ConvertTo-PosixQuotedValue -Value $RemoteDatabaseUser
    $quotedRemoteDatabase = ConvertTo-PosixQuotedValue -Value $RemoteDatabaseName
    $quotedRemoteDump = ConvertTo-PosixQuotedValue -Value $RemoteDumpPath
    $pgDumpVariable = '$PG_DUMP_PATH'
    $discoveryCommand = Get-RemotePgDumpDiscoveryCommand
    return "set -e; umask 077; command -v sudo >/dev/null 2>&1 || { echo 'sudo 명령을 찾을 수 없습니다.' >&2; exit 127; }; sudo -n -u $quotedRemoteUser true; $discoveryCommand; sudo -n -u $quotedRemoteUser `"$pgDumpVariable`" -Fc --no-owner --no-privileges -d $quotedRemoteDatabase -f $quotedRemoteDump"
}

function Get-RemoteCleanupCommand {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteDatabaseUser,
        [Parameter(Mandatory = $true)][string]$RemoteDumpPath
    )

    $quotedRemoteUser = ConvertTo-PosixQuotedValue -Value $RemoteDatabaseUser
    $quotedRemoteDump = ConvertTo-PosixQuotedValue -Value $RemoteDumpPath
    return "set -e; command -v sudo >/dev/null 2>&1 || { echo 'sudo 명령을 찾을 수 없습니다.' >&2; exit 127; }; sudo -n -u $quotedRemoteUser rm -f -- $quotedRemoteDump"
}

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Stage,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    & $FilePath @Arguments
    $commandExitCode = $LASTEXITCODE
    if ($commandExitCode -ne 0) {
        throw "[$Stage] 명령 실행에 실패했습니다. 오류 코드: $commandExitCode"
    }
}

function Invoke-NativeCommandCapture {
    param(
        [Parameter(Mandatory = $true)][string]$Stage,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $output = @(& $FilePath @Arguments 2>&1)
    $commandExitCode = $LASTEXITCODE
    if ($commandExitCode -ne 0) {
        foreach ($line in $output) {
            Write-Host ([string]$line)
        }
        throw "[$Stage] 명령 실행에 실패했습니다. 오류 코드: $commandExitCode"
    }
    return @($output | ForEach-Object { [string]$_ })
}

function Assert-CustomDumpFile {
    param(
        [Parameter(Mandatory = $true)][pscustomobject]$Tools,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Stage
    )

    & $Tools.PgRestore "--list" $Path | Out-Null
    $listExitCode = $LASTEXITCODE
    if ($listExitCode -ne 0) {
        throw "[$Stage] custom-format dump 파일을 읽을 수 없습니다. 오류 코드: $listExitCode, 파일: $Path"
    }
}

function Stop-LocalDatabaseSessions {
    param(
        [Parameter(Mandatory = $true)][pscustomobject]$Tools,
        [Parameter(Mandatory = $true)][hashtable]$Config
    )

    $databaseSqlLiteral = $Config["LOCAL_DB_NAME"].Replace("'", "''")
    $terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseSqlLiteral' AND pid <> pg_backend_pid();"
    $arguments = @(
        "--host=$($Config['LOCAL_DB_HOST'])",
        "--port=$($Config['LOCAL_DB_PORT'])",
        "--username=$($Config['LOCAL_DB_USER'])",
        "--dbname=postgres",
        "--no-password",
        "--set=ON_ERROR_STOP=1",
        "--command=$terminateSql"
    )
    Invoke-NativeCommand -Stage "로컬 DB 연결 종료" -FilePath $Tools.Psql -Arguments $arguments
}

function Get-PowerShellQuotedValue {
    param([Parameter(Mandatory = $true)][string]$Value)

    return "'" + $Value.Replace("'", "''") + "'"
}

function Get-RecoveryInstructions {
    param(
        [Parameter(Mandatory = $true)][pscustomobject]$Tools,
        [Parameter(Mandatory = $true)][hashtable]$Config,
        [Parameter(Mandatory = $true)][string]$BackupPath
    )

    $databaseSqlLiteral = $Config["LOCAL_DB_NAME"].Replace("'", "''")
    $terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseSqlLiteral' AND pid <> pg_backend_pid();"
    $psqlCommand = "& $(Get-PowerShellQuotedValue $Tools.Psql) --host=$(Get-PowerShellQuotedValue $Config['LOCAL_DB_HOST']) --port=$(Get-PowerShellQuotedValue $Config['LOCAL_DB_PORT']) --username=$(Get-PowerShellQuotedValue $Config['LOCAL_DB_USER']) --dbname=postgres --no-password --set=ON_ERROR_STOP=1 --command=$(Get-PowerShellQuotedValue $terminateSql)"
    $restoreCommand = "& $(Get-PowerShellQuotedValue $Tools.PgRestore) --clean --if-exists --no-owner --no-privileges --exit-on-error --host=$(Get-PowerShellQuotedValue $Config['LOCAL_DB_HOST']) --port=$(Get-PowerShellQuotedValue $Config['LOCAL_DB_PORT']) --username=$(Get-PowerShellQuotedValue $Config['LOCAL_DB_USER']) --dbname=$(Get-PowerShellQuotedValue $Config['LOCAL_DB_NAME']) --no-password $(Get-PowerShellQuotedValue $BackupPath)"

    return @($psqlCommand, $restoreCommand)
}

$exitCode = 1
$CurrentStage = "초기화"
$operationCompleted = $false
$cleanupFailed = $false
$remoteDumpMayExist = $false
$localTempDump = $null
$backupPath = $null
$restoreStarted = $false
$restoreCompleted = $false
$prismaGenerated = $false
$sshPath = $null
$scpPath = $null
$tools = $null
$config = $null
$remoteTarget = $null
$originalPgPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
$passwordBstr = [IntPtr]::Zero

try {
    Set-Location -LiteralPath $ProjectRoot

    Write-Step -Number 1 -Total 9 -Message "설정 파일을 읽고 안전 조건을 검증합니다."
    $config = Read-DbPullConfig -Path $ConfigPath
    Assert-SafeConfig -Config $config
    Write-Host "설정 검증 완료: $ConfigPath"

    Write-Step -Number 2 -Total 9 -Message "필수 실행 도구를 탐색합니다."
    $sshPath = Resolve-ApplicationPath -Name "ssh.exe"
    $scpPath = Resolve-ApplicationPath -Name "scp.exe"
    if ([string]::IsNullOrWhiteSpace($sshPath)) {
        throw "[도구 탐색] ssh.exe를 찾을 수 없습니다. Windows OpenSSH Client를 설치해 주세요."
    }
    if ([string]::IsNullOrWhiteSpace($scpPath)) {
        throw "[도구 탐색] scp.exe를 찾을 수 없습니다. Windows OpenSSH Client를 설치해 주세요."
    }
    $tools = Get-PostgreSqlTools
    Write-Host "OpenSSH: $sshPath"
    Write-Host "PostgreSQL bin: $($tools.BinDirectory)"
    $remoteTarget = "$($config['SSH_USER'])@$($config['SSH_HOST'])"

    if ($ValidateOnly) {
        Write-Host "운영 서버 pg_dump 및 sudo 권한을 읽기 전용으로 확인합니다."
        $remotePreflightCommand = Get-RemotePreflightCommand `
            -RemoteDatabaseUser $config["REMOTE_DB_USER"]
        Invoke-NativeCommand -Stage "운영 서버 사전 확인" -FilePath $sshPath -Arguments @(
            "-p", $config["SSH_PORT"], "--", $remoteTarget, $remotePreflightCommand
        )
        Write-Host "운영 서버 DB 이름과 StayBoard 핵심 테이블을 읽기 전용으로 확인합니다."
        $remoteDatabaseInspectionCommand = Get-RemoteDatabaseInspectionCommand `
            -RemoteDatabaseUser $config["REMOTE_DB_USER"] `
            -RemoteDatabaseName $config["REMOTE_DB_NAME"]
        $databaseInspectionOutput = Invoke-NativeCommandCapture `
            -Stage "운영 서버 DB 확인" `
            -FilePath $sshPath `
            -Arguments @("-p", $config["SSH_PORT"], "--", $remoteTarget, $remoteDatabaseInspectionCommand)
        $remoteDatabases = @(
            $databaseInspectionOutput |
                Where-Object { $_.StartsWith("REMOTE_DATABASE=") } |
                ForEach-Object { $_.Substring("REMOTE_DATABASE=".Length) }
        )
        $stayBoardCandidates = @(
            $databaseInspectionOutput |
                Where-Object { $_.StartsWith("STAYBOARD_CANDIDATE=") } |
                ForEach-Object { $_.Substring("STAYBOARD_CANDIDATE=".Length) }
        )
        $configuredDatabaseExists = $databaseInspectionOutput -contains "CONFIGURED_DB_EXISTS=1"

        if (-not $configuredDatabaseExists) {
            Write-Host "설정된 운영 DB를 찾을 수 없습니다: $($config['REMOTE_DB_NAME'])" -ForegroundColor Red
            Write-Host "운영 서버의 비시스템 DB 목록:"
            if ($remoteDatabases.Count -eq 0) {
                Write-Host "- 없음"
            } else {
                foreach ($database in $remoteDatabases) {
                    Write-Host "- $database"
                }
            }
            if ($stayBoardCandidates.Count -eq 1) {
                Write-Host "추천 REMOTE_DB_NAME: $($stayBoardCandidates[0])" -ForegroundColor Yellow
                Write-Host ".env.server-db-pull은 자동으로 변경하지 않았습니다."
            } elseif ($stayBoardCandidates.Count -gt 1) {
                Write-Host "StayBoard 핵심 테이블을 가진 DB가 여러 개입니다: $($stayBoardCandidates -join ', ')" -ForegroundColor Yellow
            } else {
                Write-Host "StayBoard 핵심 테이블을 모두 가진 DB를 찾지 못했습니다." -ForegroundColor Yellow
            }
            throw "[운영 서버 DB 확인] REMOTE_DB_NAME을 확인해 주세요."
        }

        if ($stayBoardCandidates -notcontains $config["REMOTE_DB_NAME"]) {
            if ($stayBoardCandidates.Count -eq 1) {
                Write-Host "추천 REMOTE_DB_NAME: $($stayBoardCandidates[0])" -ForegroundColor Yellow
            }
            throw "[운영 서버 DB 확인] 설정된 DB에 StayBoard 핵심 테이블 4개가 모두 존재하지 않습니다: $($config['REMOTE_DB_NAME'])"
        }
        Write-Host "운영 DB 확인 완료: $($config['REMOTE_DB_NAME']) (Company, Property, Room, Reservation)"
        Write-Host "로컬 PostgreSQL TCP 확인: $($config['LOCAL_DB_HOST']):$($config['LOCAL_DB_PORT'])"
        try {
            Test-LocalPostgreSqlTcpEndpoint `
                -HostName $config["LOCAL_DB_HOST"] `
                -Port ([int]$config["LOCAL_DB_PORT"]) `
                -TimeoutMilliseconds $LocalConnectionTimeoutMilliseconds
        } catch {
            throw "[로컬 DB 연결 확인] PostgreSQL TCP 포트에 연결할 수 없습니다: $($_.Exception.Message)"
        }
        Write-Host "로컬 PostgreSQL TCP 포트 연결: 가능"
        Write-Host ""
        Write-Host "[검증 완료] 설정과 필수 도구를 정상적으로 확인했습니다."
        Write-Host "- 운영 서버에서는 pg_dump 경로, sudo 전환, DB 존재 여부와 핵심 테이블만 읽기 전용으로 확인했습니다."
        Write-Host "- dump 생성, 다운로드, 로컬 PostgreSQL 명령, 백업, 복원은 실행하지 않았습니다."
        $operationCompleted = $true
    } else {
        $npxPath = Resolve-ApplicationPath -Name "npx.cmd"
        if ([string]::IsNullOrWhiteSpace($npxPath)) {
            throw "[도구 탐색] npx.cmd를 찾을 수 없습니다. Node.js와 npm 설치 상태를 확인해 주세요."
        }

        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Yellow
        Write-Host "주의: 서버 DB 가져오기는 로컬 데이터를 교체합니다." -ForegroundColor Yellow
        Write-Host "- 현재 로컬 DB의 기존 데이터가 서버 DB 데이터로 덮어쓰기됩니다." -ForegroundColor Yellow
        Write-Host "- 운영 서버 DB 자체는 수정되지 않습니다." -ForegroundColor Green
        Write-Host "- pg_restore는 로컬 DB에서만 실행됩니다." -ForegroundColor Green
        Write-Host "- 로컬 DB: $($config['LOCAL_DB_NAME'])@$($config['LOCAL_DB_HOST']):$($config['LOCAL_DB_PORT'])" -ForegroundColor Yellow
        Write-Host "============================================================" -ForegroundColor Yellow
        $confirmation = Read-Host "계속하려면 정확히 YES를 입력하세요"
        if ($confirmation -cne "YES") {
            Write-Host "[취소] YES가 입력되지 않아 아무 작업도 실행하지 않았습니다."
            $operationCompleted = $true
        } else {
            $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $tempDirectory = Join-Path $ProjectRoot "tmp\db"
            $backupDirectory = Join-Path $ProjectRoot "backups\db"
            $localTempDump = Join-Path $tempDirectory "server-db-pull-$timestamp.dump"
            $backupPath = Join-Path $backupDirectory "local-before-server-pull-$timestamp.dump"
            New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null
            New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

            $pgPassPath = Join-Path $env:APPDATA "postgresql\pgpass.conf"
            if (-not [string]::IsNullOrEmpty($originalPgPassword)) {
                Write-Host "로컬 PostgreSQL 인증: 현재 프로세스의 PGPASSWORD 사용"
            } elseif (Test-Path -LiteralPath $pgPassPath -PathType Leaf) {
                Write-Host "로컬 PostgreSQL 인증: $pgPassPath 사용"
            } else {
                Write-Host ""
                Write-Host "pgpass.conf가 없어 로컬 PostgreSQL 비밀번호를 안전하게 입력받습니다."
                $securePassword = Read-Host "로컬 DB 사용자 '$($config['LOCAL_DB_USER'])' 비밀번호" -AsSecureString
                $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
                $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
                if ([string]::IsNullOrEmpty($plainPassword)) {
                    throw "[로컬 DB 인증] 비밀번호가 입력되지 않았습니다."
                }
                [Environment]::SetEnvironmentVariable("PGPASSWORD", $plainPassword, "Process")
                $plainPassword = $null
            }

            Write-Step -Number 3 -Total 9 -Message "운영 서버에서 custom-format dump를 생성합니다."
            $remoteDumpCommand = Get-RemoteDumpCommand `
                -RemoteDatabaseUser $config["REMOTE_DB_USER"] `
                -RemoteDatabaseName $config["REMOTE_DB_NAME"] `
                -RemoteDumpPath $config["REMOTE_DUMP_PATH"]
            $remoteDumpMayExist = $true
            Invoke-NativeCommand -Stage "서버 DB dump" -FilePath $sshPath -Arguments @(
                "-p", $config["SSH_PORT"], "--", $remoteTarget, $remoteDumpCommand
            )

            Write-Step -Number 4 -Total 9 -Message "서버 dump 파일을 로컬 임시 폴더로 내려받습니다."
            $remoteScpSource = "${remoteTarget}:$($config['REMOTE_DUMP_PATH'])"
            Invoke-NativeCommand -Stage "서버 dump 다운로드" -FilePath $scpPath -Arguments @(
                "-P", $config["SSH_PORT"], "--", $remoteScpSource, $localTempDump
            )
            if (-not (Test-Path -LiteralPath $localTempDump -PathType Leaf) -or
                (Get-Item -LiteralPath $localTempDump).Length -le 0) {
                throw "[서버 dump 다운로드] 다운로드 파일이 없거나 비어 있습니다: $localTempDump"
            }
            Assert-CustomDumpFile -Tools $tools -Path $localTempDump -Stage "서버 dump 검증"

            Write-Step -Number 5 -Total 9 -Message "현재 로컬 DB를 복원 가능한 dump로 백업합니다."
            Invoke-NativeCommand -Stage "로컬 DB 백업" -FilePath $tools.PgDump -Arguments @(
                "--format=custom",
                "--no-owner",
                "--no-privileges",
                "--no-password",
                "--host=$($config['LOCAL_DB_HOST'])",
                "--port=$($config['LOCAL_DB_PORT'])",
                "--username=$($config['LOCAL_DB_USER'])",
                "--file=$backupPath",
                "--dbname=$($config['LOCAL_DB_NAME'])"
            )
            if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf) -or
                (Get-Item -LiteralPath $backupPath).Length -le 0) {
                throw "[로컬 DB 백업] 백업 파일이 없거나 비어 있습니다. 서버 DB 복원을 중단합니다: $backupPath"
            }
            Assert-CustomDumpFile -Tools $tools -Path $backupPath -Stage "로컬 DB 백업 검증"
            Write-Host "로컬 백업 생성 완료: $backupPath"

            Write-Step -Number 6 -Total 9 -Message "로컬 DB 연결을 종료하고 서버 dump를 복원합니다."
            $restoreArguments = @(
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-privileges",
                "--exit-on-error",
                "--no-password",
                "--host=$($config['LOCAL_DB_HOST'])",
                "--port=$($config['LOCAL_DB_PORT'])",
                "--username=$($config['LOCAL_DB_USER'])",
                "--dbname=$($config['LOCAL_DB_NAME'])",
                $localTempDump
            )
            $restoreStarted = $true
            for ($attempt = 1; $attempt -le $RestoreAttemptLimit; $attempt += 1) {
                Stop-LocalDatabaseSessions -Tools $tools -Config $config
                $originalPgOptions = [Environment]::GetEnvironmentVariable("PGOPTIONS", "Process")
                try {
                    [Environment]::SetEnvironmentVariable(
                        "PGOPTIONS",
                        "-c lock_timeout=$RestoreLockTimeoutMilliseconds",
                        "Process"
                    )
                    & $tools.PgRestore @restoreArguments
                    $restoreExitCode = $LASTEXITCODE
                } finally {
                    [Environment]::SetEnvironmentVariable("PGOPTIONS", $originalPgOptions, "Process")
                }
                if ($restoreExitCode -eq 0) {
                    $restoreCompleted = $true
                    break
                }

                if ($attempt -lt $RestoreAttemptLimit) {
                    Write-Warning "로컬 DB 연결 재생성 등의 이유로 복원이 실패했습니다(오류 코드: $restoreExitCode). 기존 세션을 다시 종료한 뒤 1회 재시도합니다."
                } else {
                    throw "[서버 dump 복원] $RestoreAttemptLimit 회 시도 후에도 복원에 실패했습니다. 오류 코드: $restoreExitCode"
                }
            }

            Write-Step -Number 7 -Total 9 -Message "Prisma Client를 다시 생성합니다."
            Invoke-NativeCommand -Stage "Prisma Client 생성" -FilePath $npxPath -Arguments @("prisma", "generate")
            $prismaGenerated = $true

            Write-Step -Number 8 -Total 9 -Message "복원 결과를 확인합니다."
            Write-Host "복원 대상 로컬 DB: $($config['LOCAL_DB_NAME'])"
            Write-Host "로컬 백업: $backupPath"
            Write-Host "Prisma Client 생성: 완료"
            $operationCompleted = $true
        }
    }
} catch {
    Write-Host ""
    Write-Host "[실패][단계: $CurrentStage] $($_.Exception.Message)" -ForegroundColor Red
    if ($restoreStarted -and -not $restoreCompleted -and
        -not [string]::IsNullOrWhiteSpace($backupPath) -and
        (Test-Path -LiteralPath $backupPath -PathType Leaf) -and
        $null -ne $tools -and $null -ne $config) {
        Write-Host ""
        Write-Host "복원 실패로 로컬 DB가 일부 변경되었을 수 있습니다." -ForegroundColor Yellow
        Write-Host "아래 명령을 PowerShell에서 순서대로 실행하면 생성된 로컬 백업으로 복구할 수 있습니다:"
        foreach ($recoveryCommand in Get-RecoveryInstructions -Tools $tools -Config $config -BackupPath $backupPath) {
            Write-Host $recoveryCommand
        }
    } elseif ($restoreCompleted -and -not $prismaGenerated) {
        Write-Host "로컬 DB 복원은 완료되었지만 Prisma Client 생성 단계가 실패했습니다." -ForegroundColor Yellow
        Write-Host "프로젝트 루트에서 'npx prisma generate'를 다시 실행해 주세요."
    }
} finally {
    if ($remoteDumpMayExist -and -not [string]::IsNullOrWhiteSpace($sshPath) -and
        -not [string]::IsNullOrWhiteSpace($remoteTarget) -and $null -ne $config) {
        Write-Step -Number 9 -Total 9 -Message "운영 서버의 임시 dump 파일을 삭제합니다."
        $remoteCleanupCommand = Get-RemoteCleanupCommand `
            -RemoteDatabaseUser $config["REMOTE_DB_USER"] `
            -RemoteDumpPath $config["REMOTE_DUMP_PATH"]
        & $sshPath "-p" $config["SSH_PORT"] "--" $remoteTarget $remoteCleanupCommand
        $remoteCleanupExitCode = $LASTEXITCODE
        if ($remoteCleanupExitCode -ne 0) {
            $cleanupFailed = $true
            Write-Host "[정리 실패] 운영 서버 임시 dump를 삭제하지 못했습니다. 오류 코드: $remoteCleanupExitCode" -ForegroundColor Red
            Write-Host "확인이 필요한 원격 파일: $($config['REMOTE_DUMP_PATH'])"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($localTempDump) -and
        (Test-Path -LiteralPath $localTempDump -PathType Leaf)) {
        try {
            Remove-Item -LiteralPath $localTempDump -Force
            Write-Host "로컬 임시 dump 삭제 완료: $localTempDump"
        } catch {
            $cleanupFailed = $true
            Write-Host "[정리 실패] 로컬 임시 dump를 삭제하지 못했습니다: $localTempDump" -ForegroundColor Red
        }
    }

    [Environment]::SetEnvironmentVariable("PGPASSWORD", $originalPgPassword, "Process")
    if ($passwordBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr)
    }
}

if ($operationCompleted -and -not $cleanupFailed) {
    if (-not $ValidateOnly -and $restoreCompleted) {
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "서버 DB 가져오기 완료" -ForegroundColor Green
        Write-Host "복원 대상 로컬 DB: $($config['LOCAL_DB_NAME'])"
        Write-Host "생성된 로컬 백업: $backupPath"
        Write-Host "Prisma Client 생성 완료: 예"
        Write-Host "============================================================" -ForegroundColor Green
    }
    $exitCode = 0
}

exit $exitCode
