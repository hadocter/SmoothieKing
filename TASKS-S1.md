# S1 (로그인 플로우) — 구현 완료 기록

> 대상: **A — 계정 생성 → 정보 수집 → 목표 설정 → DB 저장** + 즐겨찾기 사용자별 분리
> 범위: 수업 프로젝트 데모. 최종 갱신: 2026-08-01

**상태: 코드 작업 완료.** 3개 패키지(libs / api-server / smoothy-king) 타입체크 전부 통과.
아직 실행·DB 반영은 안 됨 → 아래 "실행 절차" 참조.

---

## ✅ 완료한 작업

### 백엔드 — 인메모리 → Postgres

| 파일 | 변경 |
|---|---|
| `lib/db/src/schema/favorites.ts` | `userId` FK 추가, unique를 `(userId, recipeId)`로 변경, 사용자 삭제 시 cascade |
| `artifacts/api-server/src/routes/auth.ts` | `Map` 3개 제거 → `usersTable`. 이메일 정규화, unique 위반(23505) → 409 |
| `artifacts/api-server/src/routes/user.ts` | `Map` 제거 → `userProfilesTable` upsert. FK 위반(23503) → 401 |
| `artifacts/api-server/src/routes/favorites.ts` | 전역 `Set` 제거 → 사용자별 DB 조회/삽입/삭제 |
| `artifacts/api-server/src/middlewares/auth.ts` | `optionalAuth` 추가 (비로그인도 통과, `req.user` 미설정) |
| `artifacts/api-server/src/lib/auth.ts` | `timingSafeEqual` 길이 가드 (throw → false) |

**API 계약은 그대로.** userId를 토큰에서 꺼내므로 `openapi.yaml` 수정도 codegen 재실행도 불필요.

### 프론트엔드

| 파일 | 변경 |
|---|---|
| `src/lib/auth-context.tsx` | 토큰을 `useRef`로 관리(요청 시점에 항상 최신), 로그인·로그아웃 시 `queryClient.clear()` |
| `src/pages/onboarding/index.tsx` | 로그인 가드, 기존 프로필 prefill, 저장 후 캐시 무효화, 수정 모드 문구 |
| `src/pages/favorites.tsx` | 비로그인 시 "Login Required" (기존엔 "저장된 것 없음"으로 오인) |
| `src/pages/recipes.tsx` | 비로그인 하트 클릭 → 토스트 + 로그인 이동 |
| `src/pages/recipe-detail.tsx` | 동일 |
| `src/pages/profile.tsx` | 프로필 404 재시도 끔 (스켈레톤 ~7초 → 즉시) |

### 구현 중 추가로 처리한 것

- **인메모리 시절 토큰 대응** — localStorage에 남은 옛 토큰은 서명이 유효하지만 없는 userId를 가리켜
  FK 위반 500을 낸다. 401 + "Please log in again"으로 매핑.
- **로그인 시에도 캐시 clear** — 비로그인 상태에서 캐시된 빈 즐겨찾기 목록 때문에
  로그인 후에도 하트가 비어 보이는 문제.
- **토큰 ref 전환** — 기존 state 클로저는 `login()` 직후 발생하는 요청에 옛 토큰을 실을 수 있었음.
- **즐겨찾기 조회는 선택적 인증** — 강제했다면 비로그인으로 레시피를 둘러보기만 해도 401이 쏟아짐.

---

## 실행 절차 (Replit에서)

로컬 Windows에는 `pnpm`도 `DATABASE_URL`도 없어 **코드 작성과 타입체크만** 수행했다.
아래는 Replit에서 실행할 것.

```bash
# 1. 테이블 생성 (users, user_profiles, favorites)
pnpm --filter @workspace/db run push

# 2. 타입체크
pnpm run typecheck

# 3. 서버 실행
pnpm --filter @workspace/api-server run dev
```

> ⚠️ **1번에서 favorites 관련 오류가 나면**, 이전 스키마로 만들어진 `favorites` 테이블에
> 행이 남아 있는 경우다. `user_id`가 NOT NULL이라 기존 행에 채울 값이 없어서 실패한다.
> 라우트가 DB를 쓴 적이 없어 유실될 데이터는 없으니 `TRUNCATE TABLE favorites;` 후 재시도.

---

## 검증 시나리오

- [ ] 가입 → 온보딩 4단계 → 완료 화면
- [ ] **서버 재시작 후에도** 같은 계정으로 로그인 (← 핵심)
- [ ] 프로필 "Health Profile" 탭에 입력값 표시
- [ ] `SELECT * FROM users;` / `user_profiles` / `favorites` 에 행 존재
- [ ] 같은 이메일 재가입 → 409 토스트
- [ ] `Test@x.com` 가입 후 `test@x.com` 로그인 성공
- [ ] 프로필 → "Edit Preferences" → **기존 값이 채워진 상태**로 열림
- [ ] 로그아웃 상태로 `/onboarding` 진입 → 즉시 차단
- [ ] 로그아웃 상태로 `/recipes` 열람 → 정상 (하트는 빈 상태)
- [ ] 로그아웃 상태로 하트 클릭 → 토스트 + 로그인 페이지
- [ ] **계정 A 즐겨찾기 → 로그아웃 → 계정 B 로그인 → A 것이 안 보임** (← 이번에 고친 것)

> 기존 브라우저에 옛 토큰이 남아 있으면 첫 요청이 401이 난다. 한 번 로그아웃하거나
> localStorage를 비우고 시작할 것.

---

## 남은 선택 항목

- **데모 계정 시딩** — `seed.ts`에 온보딩까지 완료된 계정 1개. 발표 중 가입 타이핑 생략용. (30분)
- **`creations` 작성자 매칭** — `profile.tsx`가 `authorName === user.nickname` 문자열 비교로
  "내 블렌드"를 찾는다. 닉네임이 같은 사용자가 둘이면 섞인다. 데모에선 대개 무해. (1시간)
- 아래는 수업 범위 밖이라 **의도적으로 제외**: JWT 시크릿 프로덕션 강제, OpenAPI `securitySchemes`,
  온보딩 enum 검증, httpOnly 쿠키 전환, 이메일 인증.
- `recipes`/`ingredients`/`membership` 라우트는 여전히 목업 상수. 화면은 정상 동작하며 S1과 무관.

---

**참고:** `lib/api-zod/src/generated/`, `lib/api-client-react/src/generated/`는 직접 수정 금지.
`lib/api-spec/openapi.yaml` 수정 시에만 `pnpm --filter @workspace/api-spec run codegen` 재실행.
