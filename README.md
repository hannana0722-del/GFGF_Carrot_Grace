# GFGF - 2026 경기 청년 사다리 프로그램 관리 대시보드

경기 청년 사다리 프로그램 참여자 및 운영 현황을 통합 관리하는 웹 기반 어드민 대시보드입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **통합 관리자 대시보드** | 실시간 KPI(출석률·제출률·적신호), 국가별 비교 차트, 알림 센터 |
| **공지사항** | 기수·팀·국가 대상별 발송, 읽음 확인, 예약 발송, 재공지 |
| **건강/심리 체크** | 일일·주간 설문, 신호등(녹·황·적) 자동 판정, 긴급 상담 요청 |
| **과제 관리** | 파일·링크 제출, 인솔자 피드백·점수 입력, 미제출 자동 처리 |
| **출결 관리** | QR·수기 체크인, 지각·결석 사유 기록, 개인별 출석률 자동 계산 |
| **일일 보고** | 활동 내용, 감정 태그, 만족도 평가, 사진 첨부 |
| **리스크 신호등 관리** | 이슈 분류·우선순위, 조치 이력 기록, 신호등 상태 수동 변경 |

### 공통 기능
- **권한 관리 (RBAC):** 관리자 / 인솔자 / 참여자 3단계 역할
- **실시간 알림:** WebSocket 기반 실시간 푸시
- **감사 로그:** 주요 행위 및 변경 이력 자동 기록
- **파일 관리:** 이미지·문서 업로드 및 미리보기

---

## 기술 스택

### 백엔드
- **Python 3.11+** / **FastAPI** — REST API 서버
- **SQLAlchemy** — ORM
- **SQLite** — 기본 데이터베이스 (PostgreSQL 전환 가능)
- **JWT** — 인증
- **WebSocket** — 실시간 알림

### 프론트엔드
- **React 18** / **TypeScript** — UI
- **Vite** — 빌드 도구
- **Tailwind CSS** — 스타일링 (다크 테마)
- **Recharts** — 데이터 시각화
- **TanStack Query** — 서버 상태 관리

---

## 시작하기

### 사전 준비

아래 도구가 설치되어 있어야 합니다.

| 도구 | 권장 버전 | 확인 명령어 |
|------|-----------|-------------|
| Python | 3.11 이상 | `python --version` |
| Node.js | 18 이상 | `node --version` |
| npm | 9 이상 | `npm --version` |

---

### 1. 저장소 클론

```bash
git clone <저장소-URL>
cd gsdf-dashboard
```

---

### 2. 백엔드 설정

```bash
cd backend
```

#### 가상환경 생성 및 활성화

```bash
# macOS / Linux
python -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

#### 패키지 설치

```bash
pip install -r requirements.txt
```

#### 환경변수 설정 (선택)

`.env` 파일이 없어도 개발용 기본값으로 바로 실행됩니다.

운영 환경이나 보안이 중요한 경우에는 아래와 같이 직접 설정하세요.

```bash
cp .env.example .env
```

```bash
# 랜덤 키 생성 (macOS/Linux)
openssl rand -hex 32
```

```dotenv
# backend/.env
SECRET_KEY=여기에-위에서-생성한-키를-붙여넣으세요
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./gsdf.db
UPLOAD_DIR=uploads
```

> **개발 환경**에서는 `.env` 없이도 실행됩니다. **운영 배포 시**에는 반드시 `SECRET_KEY`를 변경하세요.

#### 서버 실행

```bash
uvicorn app.main:app --reload --port 8000
```

> 서버가 정상 실행되면 `http://localhost:8000/docs` 에서 API 문서를 확인할 수 있습니다.

#### (선택) 샘플 데이터 생성

```bash
python seed_data.py
```

참여자 30명, 인솔자 3명, 공지사항·과제·출결·건강 체크 등 실제와 유사한 데이터가 생성됩니다.

---

### 3. 프론트엔드 설정

새 터미널을 열고 진행합니다.

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 터미널에 표시된 주소(기본 `http://localhost:3000`)로 접속합니다. 
** npm run dev 실행 시 terminal에서 확인이 가능한 포트번호로 접속합니다. 3000번이 아닐 수 있습니다. ** 

---

### 4. 로그인

| 역할 | 아이디 | 비밀번호 | 설명 |
|------|--------|----------|------|
| 관리자 | `admin` | `password` | 전체 기능 접근 가능 |
| 인솔자 | `manager_us` | `password` | 담당 팀 관리 |
| 참여자 | `participant_미국_01` | `password` | 개인 데이터 조회·입력 |

> seed_data.py를 실행하지 않은 경우 `admin / admin123` 계정만 자동 생성됩니다.

---

## 프로젝트 구조

```
gsdf-dashboard/
├── backend/
│   ├── app/
│   │   ├── core/           # 설정, 보안(JWT)
│   │   ├── models/         # SQLAlchemy ORM 모델
│   │   ├── schemas/        # Pydantic 스키마
│   │   ├── routers/        # API 라우터 (기능별)
│   │   ├── database.py
│   │   └── main.py
│   ├── .env.example        # 환경변수 예시 (이걸 복사해서 .env 생성)
│   ├── requirements.txt
│   └── seed_data.py
└── frontend/
    ├── src/
    │   ├── components/     # 공통 UI 컴포넌트
    │   ├── pages/          # 페이지별 컴포넌트
    │   ├── contexts/       # 인증 컨텍스트
    │   ├── lib/            # API 클라이언트, 유틸
    │   └── types/          # TypeScript 타입 정의
    ├── package.json
    └── vite.config.ts
```

---

## API 문서

백엔드 실행 후 아래 주소에서 Swagger UI를 통해 전체 API를 확인하고 테스트할 수 있습니다.

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 문의

이슈 및 기능 제안은 GitHub Issues를 이용해 주세요.


## 