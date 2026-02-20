# Telegram Notification Bot

NestJS 기반 텔레그램 알림봇입니다. Polling 방식으로 동작하며, Swagger API를 통해 알림 메시지를 전송할 수 있습니다.

## 프로젝트 구조

```
src/
├── bot/                        # 텔레그램 봇 모듈
│   ├── bot.module.ts           # 봇 모듈 설정 (Polling)
│   ├── bot.service.ts          # 봇 메시지 전송 서비스
│   └── bot.update.ts           # 봇 커맨드 핸들러 (/start, /help 등)
├── notification/               # 알림 모듈
│   ├── notification.module.ts
│   ├── notification.controller.ts  # REST API 엔드포인트
│   └── notification.service.ts     # 알림 비즈니스 로직
├── common/
│   └── dto/
│       └── send-message.dto.ts # 메시지 전송 DTO
├── app.module.ts               # 루트 모듈
└── main.ts                     # 앱 엔트리포인트 + Swagger 설정
```

## 시작하기

### 1. 텔레그램 봇 생성

1. 텔레그램에서 [@BotFather](https://t.me/BotFather)를 검색합니다.
2. `/newbot` 명령어로 봇을 생성합니다.
3. 발급받은 **Bot Token**을 복사합니다.

### 2. 환경 변수 설정

```bash
cp .env.sample .env
```

`.env` 파일을 열고 값을 입력합니다:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_DEFAULT_CHAT_ID=your_chat_id_here
```

> Chat ID는 봇 실행 후 텔레그램에서 `/start` 또는 `/chatid` 명령어를 통해 확인할 수 있습니다.

### 3. 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run start:dev

# 프로덕션 빌드 & 실행
npm run build
npm run start:prod
```

### 4. Swagger API 문서

서버 실행 후 브라우저에서 접속:

```
http://localhost:3000/api
```

## API 엔드포인트

### `POST /notification/send` - 알림 메시지 전송

```json
{
  "message": "🔔 <b>서버 알림</b>\n배포가 완료되었습니다.",
  "chatId": "123456789"
}
```

- `message` (필수): 전송할 메시지 (HTML 태그 지원)
- `chatId` (선택): 미입력 시 `.env`의 `TELEGRAM_DEFAULT_CHAT_ID` 사용

### `GET /notification/health` - 봇 상태 확인

봇 연결 상태와 봇 정보를 반환합니다.

## 봇 명령어

| 명령어     | 설명                  |
| ---------- | --------------------- |
| `/start`   | 봇 시작 + Chat ID 확인 |
| `/help`    | 사용 가능한 명령어 목록 |
| `/chatid`  | 현재 Chat ID 확인     |
| `/ping`    | 봇 상태 확인          |

## 기술 스택

- **NestJS** - 백엔드 프레임워크
- **nestjs-telegraf** - NestJS 텔레그램 통합
- **Telegraf** - Telegram Bot API 라이브러리
- **Swagger** - API 문서화
- **class-validator** - DTO 유효성 검사
