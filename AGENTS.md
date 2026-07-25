<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Authentication and authorization

- 인증 및 권한 검사는 서버에서 수행한다. UI 메뉴 숨김만으로 권한을 구현하지 않는다.
- Client에서 전달한 userId, role, companyId를 신뢰하지 않는다.
- 모든 Company/Property/Room 접근은 공통 권한 함수를 사용한다.
- 역할별 Permission Map은 중앙에서 관리하고 STAFF 데이터는 배정 범위로 제한한다.
- 비로그인 사용자는 실제 고객 데이터가 아닌 고정 데모 데이터만 조회한다.
- 공개 데모와 인증 사용자 화면은 동일한 ViewModel과 UI 컴포넌트를 재사용한다.
- 모든 변경 작업에는 인증과 권한 검사가 필요하다.
- 공개 회원가입은 새 Company의 ADMIN만 생성하며 DEVELOPER와 STAFF를 생성하지 않는다.
- passwordHash를 로그, Client Component 또는 Server Action 응답에 노출하지 않는다.
- 계정과 권한 변경은 AuditLog에 기록하고 마지막 활성 DEVELOPER 보호 정책을 유지한다.

# ICS event classification

- ICS의 모든 VEVENT를 Reservation으로 저장하지 않는다.
- OTA별 Provider가 RESERVATION / BLOCKED / CANCELLED / UNKNOWN을 분류한다.
- BLOCKED와 UNKNOWN은 예약으로 저장하지 않는다.
- OTA별 문자열과 판별 규칙은 해당 Provider 내부에만 둔다.
- guestName이 null이어도 실제 예약일 수 있다.
- 다운로드 실패 또는 캘린더 전체 파싱 실패 시 기존 예약을 유지한다.
