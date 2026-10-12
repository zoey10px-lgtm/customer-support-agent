# Carely 제조 품질 고객 불만 Agent

올려준 HTML 화면, 가상 JSON 데이터, OpenAI API 호출 코드를 연결한 로컬 실행 프로젝트입니다.
Python 3.10 이상만 필요하며 별도 패키지 설치는 없습니다.

## 실행

1. 압축을 풀고 Python이 설치되어 있는지 확인합니다.
2. 파일 확장자 표시를 켜고, .env.example을 복사하여 .env라는 이름으로 저장합니다(.env.txt가 아님).
3. .env의 OPENAI_API_KEY= 뒤에 발급받은 키를 입력하고 저장합니다.
4. Windows에서는 start.cmd를 실행합니다. 또는 이 폴더에서 python server.py를 실행합니다.
5. 자동으로 열린 http://127.0.0.1:8000 화면에서 문의를 입력하거나 예시 버튼을 누릅니다.
6. '문의 접수하기'를 누르면 자료를 조회한 뒤 AI 답변이 표시됩니다.

키를 변경하면 서버를 종료(Ctrl+C)하고 다시 실행합니다.
포트 사용 중 오류는 .env의 PORT를 다른 번호로 변경해 해결합니다.
모델 접근 오류는 계정에서 사용 가능한 모델 ID로 OPENAI_MODEL을 변경합니다.
키 발급: https://platform.openai.com/api-keys
크레딧 충전: https://platform.openai.com/settings/organization/billing/overview

## 파일 역할

- public/index.html: 첨부 UI의 스타일과 좌우 화면
- public/app.js: 버튼, 백엔드 요청, 결과 및 추가 대화 표시
- server.py: JSON 검색, OpenAI Responses API 호출, 로컬 웹 서버
- data/manufacturing_complaints_synthetic.json: 첨부한 가상 데이터 원본
- .env.example: 팀원에게 공유하는 빈 설정 양식
- .gitignore: 실제 키 파일을 Git 추적에서 제외

프로젝트 파일을 GitHub에 올리고, 실제 키가 들어 있는 .env는 올리지 않습니다.
처음부터 이미 Git에 추적한 .env는 .gitignore만으로 제외되지 않으므로 추적에서 제거해야 합니다.

## 처리 범위

제품 코드와 LOT는 정확히 매칭하고 불량 키워드로 관련 과거 사례를 최대 3건 조회합니다.
이 버전은 키워드 검색이며 임베딩 검색은 사용하지 않습니다.
AI에 문의·조회 자료·대응 기준을 전달해 분류, 원인 후보, 대응, 회신 초안을 생성합니다.
참고 자료는 펼쳐서 확인할 수 있고, 답변은 화면에서 편집·복사할 수 있습니다.
추가 질문은 기존 문의와 대화를 함께 전달합니다. 긴 대화는 새 문의로 시작합니다.
신규 문의의 expected_review는 시연 검증용이라 AI에 전달하지 않습니다.
사진·PDF 첨부는 이 버전에서 사용하지 않으며 화면에 표시합니다.
회신은 초안 생성만 수행하며 고객에게 자동 발송되지 않습니다.
텍스트는 OpenAI로 전송됩니다. 실제 API 호출마다 사용량 비용이 발생합니다.
이 서버는 개인 PC에서 시연하는 용도이며 외부 배포용 인증 서버는 아닙니다.

## 검증

python -m unittest discover -s tests -v
데이터 검색, HTTP 연결, 키 누락, 비밀 파일 접근 차단, API 응답 추출을 모의 API로 검증합니다.
실제 키를 포함하지 않으며 유료 API 호출 검증은 수행하지 않았습니다.
