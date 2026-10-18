# SEMILON Electronics — Render 배포

## 준비된 내용

- 외부 접속용 HOST/PORT 설정
- Render HTTPS 주소와 선택적 PUBLIC_BASE_URL에 맞춘 Origin 검사
- `/healthz` 상태 확인, `/api/config` 시연 코드 필요 여부
- 고객지원에 시연 접속 코드 입력칸 (서버 코드가 설정된 경우에만 표시)
- 전체 사용자 합계 시간당 분석 120회 / 동시에 3명, 환경변수로 변경 가능
- 실제 API 키와 시연 코드는 ZIP이나 소스에 포함하지 않음
- `render.yaml`: Python 웹서비스 배포 설정

## 연결을 통한 진행

ChatGPT에서 GitHub와 Render 플러그인을 설치하고 각 계정을 연결하면,
준비된 소스를 저장소에 반영하고 Render 설정을 이어갈 수 있습니다.
아직 저장소 업로드·온라인 배포는 수행되지 않았습니다.

## 직접 설정할 경우

1. GitHub에 배포용 저장소를 준비합니다.
   `server.py`, `render.yaml`, `public/`, `data/` 등이 저장소 루트에 오도록 올립니다.
   ZIP 자체가 아니라 압축을 푼 내용을 올립니다. 기존 로컬 `.env`는 업로드하지 않습니다.
2. Render Dashboard → New → Blueprint → 해당 저장소를 선택합니다.
3. 저장소 루트의 `render.yaml`을 사용합니다.
4. 처음 생성할 때 다음 값을 서버 환경변수로 입력합니다.

| 변수 | 입력할 값 |
| --- | --- |
| OPENAI_API_KEY | 기존 사용 중인 키. 저장소나 공개 화면에 기입하지 않음 |
| OPENAI_MODEL | 기존 .env에서 사용하던 모델 ID. 사진에는 이미지 입력 지원 필요 |
| DEMO_ACCESS_CODE | 직접 정한 시연용 코드. 심사위원에게 이 코드만 안내 |

5. 배포가 성공하면 Render가 발급한 실제 HTTPS 주소를 엽니다.
6. 고객지원에서 시연 코드를 입력하고 한국어·영어·베트남어 민원과 사진을 테스트합니다.
7. 실제 동작 확인 후 발급받은 주소로 QR코드를 만듭니다.

## Blueprint 대신 Web Service로 만들 경우

| 설정 | 값 |
| --- | --- |
| Runtime | Python |
| Root Directory | server.py가 있는 위치. 저장소 루트라면 비워둠 |
| Build Command | python -m py_compile server.py |
| Start Command | python server.py |
| Health Check Path | /healthz |
| HOST | 0.0.0.0 |
| OPEN_BROWSER | 0 |
| OPENAI_API_KEY | 기존 키 |
| OPENAI_MODEL | 기존 사용 모델 |
| DEMO_ACCESS_CODE | 직접 정한 시연 코드 |
| MAX_ANALYSES_PER_HOUR | 120 |
| MAX_CONCURRENT_ANALYSES | 3 |

PORT는 Render가 제공하는 값을 사용하므로 start.cmd는 온라인 배포에서 실행하지 않습니다.
Render 기본 주소는 RENDER_EXTERNAL_URL로 확인합니다.
사용자 지정 도메인을 연결하면 PUBLIC_BASE_URL을 해당 https:// 주소로 설정합니다.

## 시연 전에

- 홈페이지 → 제품 → 고객지원 이동 확인
- 다른 휴대폰에서 접속 코드 입력 후 분석 확인
- 글·사진 분석과 추가 질문 확인
- 실제 주소·시연 코드를 심사위원에게 전달

무료 웹서비스는 15분 동안 요청이 없으면 쉬었다가 다음 접속에서 다시 시작하므로,
시연 전에 접속해 상태를 확인합니다. 상시 가동이 필요하면 해당 서비스의 유료 인스턴스를 선택합니다.
무료/유료 호스팅과 별도로 OpenAI API 사용량 비용은 기존 키의 계정에 부과됩니다.

분석 제한은 API 호출 수나 결제 금액이 아니라 분석 요청 단위입니다.
번역·사진·최종 답변을 합치면 한 분석이 여러 API 호출을 사용할 수 있습니다.
횟수는 단일 서버 프로세스의 메모리에 저장되며 재시작·재배포하면 초기화됩니다.
동시 3명 제한은 분석 작업에 적용되며 홈페이지 열람에는 적용되지 않습니다.

## 검증

기존 기능과 배포 대응을 합쳐 자동 테스트 22개 통과.
DOM 테스트로 시연 코드가 없으면 요청을 보내지 않는 동작과 기존 메뉴·프로필·사진·다국어 흐름 확인.
실제 Render 배포, API 호출과 브라우저 시각 검증은 계정 연결 후 진행해야 합니다.

## 공식 문서

- https://render.com/docs/web-services
- https://render.com/docs/blueprint-spec
- https://render.com/docs/configure-environment-variables
- https://render.com/docs/free
