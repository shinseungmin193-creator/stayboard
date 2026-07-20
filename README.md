# StayBoard

숙소, 객실, OTA 캘린더와 예약 동기화를 관리하는 Next.js 관리자 애플리케이션입니다.

## 요구 환경

- Node.js 20 이상
- PostgreSQL 16 이상 권장
- Windows 11 또는 Node.js를 실행할 수 있는 환경

## PostgreSQL 데이터베이스 준비

PostgreSQL에 접속할 수 있는 계정으로 다음 명령을 실행합니다. 비밀번호는 명령이나 문서에 직접 기록하지 마세요.

```powershell
createdb -U postgres stayboard
```

`createdb`를 사용할 수 없다면 `psql`에서 다음 SQL을 실행할 수 있습니다.

```sql
CREATE DATABASE stayboard;
```

## 환경 변수

`.env.example`을 참고해 프로젝트 루트에 `.env`를 만들고 실제 PostgreSQL 비밀번호를 입력합니다.

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/stayboard"
```

> `.env`와 실제 `DATABASE_URL`은 절대로 GitHub에 올리지 마세요. `.env.example`에는 예시 값만 유지합니다.

## Prisma

스키마 정리와 검증, Client 생성:

```powershell
npx prisma format
npx prisma validate
npx prisma generate
```

PostgreSQL 연결과 `stayboard` 데이터베이스 준비를 확인한 후에만 초기 마이그레이션을 실행합니다.

```powershell
npx prisma migrate dev --name init_core_entities
npx prisma migrate status
```

기존 데이터가 있는 환경에서 `prisma migrate reset`을 실행하지 마세요.

## Company 준비

숙소는 Company에 소속되므로 활성 Company가 하나 이상 필요합니다. 애플리케이션은 임의 회사를 자동 생성하지 않습니다. 데이터베이스 연결과 마이그레이션을 완료한 뒤 `/properties`의 회사 영역에서 직접 등록·수정·비활성화할 수 있습니다.

# 프로젝트 실행

`실행.bat`을 더블클릭하거나 다음 명령을 실행합니다.

```powershell
npm run dev
```

개발 서버는 [http://localhost:3004](http://localhost:3004)에서 실행됩니다.

# GitHub 저장

`저장.bat`은 현재 변경 전체를 `git add .`로 스테이징한 후 커밋하고 푸시합니다. 실행 전에 `git status`를 확인하고 `.env`, DB dump, 개인정보가 포함되지 않았는지 반드시 검토하세요.

# GitHub 최신 내용 가져오기

`가져오기.bat`은 현재 브랜치에서 `git pull`을 실행합니다. 커밋되지 않은 로컬 변경이 있으면 먼저 백업하거나 저장하고, 충돌 가능성을 확인한 뒤 사용하세요.

## 검사와 프로덕션 빌드

```powershell
npm run lint
npm run typecheck
npm run build
npm run start
```

운영 실행도 3004 포트를 사용합니다.

## CalendarSource 등록과 연결 테스트

1. OTA 관리 화면에서 객실의 iCalendar 또는 ICS 내보내기 주소를 발급합니다.
2. StayBoard의 `/calendar-sources`에서 객실과 Provider를 선택하고 주소를 등록합니다.
3. 저장된 목록에는 전체 주소 대신 마스킹된 주소만 표시됩니다.
4. `연결 테스트`로 다운로드 가능 여부와 VCALENDAR·VEVENT 기본 형식을 확인합니다.

Airbnb는 캘린더 내보내기, Booking.com은 캘린더 동기화, Agoda는 iCalendar 연동 메뉴에서 주소를 발급할 수 있습니다. 메뉴 이름은 OTA 정책에 따라 달라질 수 있습니다.

> ICS URL에는 예약 캘린더 접근 토큰이 포함되므로 비밀번호처럼 취급해야 합니다. 소스코드, README, 로그, 스크린샷, GitHub 이슈나 커밋에 전체 URL을 절대 올리지 마세요.

연결 테스트는 원문을 안전하게 내려받아 형식과 숫자 통계만 검사합니다. Reservation을 생성·수정하거나 동기화 로그를 저장하지 않으며 `lastSyncedAt`도 변경하지 않습니다. `lastSyncedAt`은 다음 단계에서 실제 예약 동기화가 성공한 시각으로만 사용합니다.
