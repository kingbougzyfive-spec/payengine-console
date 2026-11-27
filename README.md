# PayEngine Console

A React + TypeScript console that demonstrates customer onboarding, wallet discovery, bank/account lookup and a staged bank-transfer workflow against the PayEngine sandbox. It is an assessment/demo project, not a production banking application.

## Stack and why

- **React 18**: component-based UI and local interaction state.
- **TypeScript**: explicit API and UI data contracts; catches many integration mistakes during development.
- **Vite**: fast, lightweight React development/build tooling. The task requested React; Next.js was not specified, so this project intentionally remains Vite-based rather than adding migration risk under a short deadline.
- **React Router**: client-side navigation between console screens.
- **React Hook Form + Zod**: form state and shared runtime validation rules. The server validates again because browser validation can be bypassed.
- **Express**: server-side proxy so PayEngine credentials never enter browser JavaScript.
- **Fetch API**: native HTTP requests to the PayEngine service.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm run dev
```

Web UI: `http://localhost:5173`  
Express API: `http://localhost:8787`

Without credentials, the application automatically uses **MOCK MODE**. Mock responses are simulated and are not evidence of successful PayEngine connectivity or real funds movement. To force mock mode, set `MOCK_MODE=true`.

## Configure sandbox access

Fill `.env` with credentials supplied by the provider/employer:

```env
PAYENGINE_BASE_URL=https://sandbox.bankingcomponent.com/payengine/v1
PAYENGINE_API_KEY=your_sandbox_key
PAYENGINE_BEARER_TOKEN=
PAYENGINE_AUTH_MODE=api-key
PAYENGINE_TRANSFER_PAYLOAD_MODE=nested
MOCK_MODE=false
API_PORT=8787
```

The docs provided to the developer conflict about authentication (some tables require `api-key`; generated examples show Bearer). `PAYENGINE_AUTH_MODE` supports `api-key`, `bearer`, or `both`. Do not guess which is correct; confirm with the API owner. The app does not log credentials.

The transfer initiation docs also conflict: the parameter table specifies a nested `destination` object, while the example uses flat `receiver_*` fields. `PAYENGINE_TRANSFER_PAYLOAD_MODE=nested|flat` selects the format. The default is `nested` because that matches the parameter table, not because it has been verified against the live API.

## Implemented workflows

| Screen | App route | PayEngine endpoint(s) |
|---|---|---|
| Overview | `/` | `/api/health` (local server status) |
| Create customer | `/customers/new` | `POST /customer.create` |
| Find customer | `/customers/find` | `POST /customer.findCustomer` |
| Additional wallet | Customer lookup screen | `POST /wallet.create` (only when explicitly requested) |
| Bank lookup | `/bank-lookup` | `GET /lookup.bankList`, `POST /lookup.accountNumber` |
| Bank transfer | `/transfer` | `POST /payment.initiate` (BANK_TRANSFER), `POST /payment.bankTransfer`, `POST /payment.verifyStatus`, `POST /transaction.findTransaction` |
| Checkout initiation | Server API `/api/checkout/initiate` | `POST /payment.initiate` (CHECKOUT variant; API route is available, no dedicated UI screen) |

Customer creation returns the default wallet; the app does not call `wallet.create` unnecessarily. `wallet.create` is an additional-wallet operation and is not part of the main customer onboarding path.

## Transfer workflow and safeguards

1. Load bank list and resolve the recipient account.
2. Enter the source wallet ID, amount and narration.
3. Generate a 17–18 digit initiation reference and call `payment.initiate`.
4. Only after a successful initiation response, request the sandbox transaction PIN and call `payment.bankTransfer`.
5. Verify status with `payment.verifyStatus`; use `transaction.findTransaction` with the returned transaction reference for details.

The backend enforces an 11-second interval between initiation requests for the same wallet in the current process. The docs state that an initiated transaction is valid for 30 minutes. The local initiation tracking is in-memory and is lost on server restart; a production service would persist initiation state and use distributed rate limiting/idempotency.

Never automatically retry an uncertain transfer. A timeout does not prove that the provider rejected it; verify status first to avoid duplicate payment. The transaction PIN is forwarded for the execution request only and is not persisted or logged. Use synthetic test data and sandbox credentials only.

## Security and production limitations

- API keys/tokens are server-only; do not use `VITE_` prefixes for secrets.
- `.env` is git-ignored. Never commit credentials.
- BVN/NIN are masked in the customer lookup response before returning it to the UI.
- Request bodies are size-limited; form data is validated on the server.
- This demo has no user authentication/authorisation, durable database, audit log, distributed idempotency store, or production-grade rate limiting.
- The webhook route returns `501` intentionally. The supplied docs did not specify a signature-verification mechanism. Do not accept inbound credit events or update balances until the provider documents webhook authentication and the app implements signature verification, durable persistence and idempotent processing.
- Do not use production base URLs or real customer identity data for this assessment.

## Deploy to Vercel

1. Import the GitHub repo in Vercel (framework preset: Vite is auto-detected via `vercel.json`).
2. Add environment variables (Project Settings → Environment Variables): `PAYENGINE_BASE_URL`, `PAYENGINE_API_KEY` and/or `PAYENGINE_BEARER_TOKEN`, `PAYENGINE_AUTH_MODE`, `PAYENGINE_TRANSFER_PAYLOAD_MODE`, `MOCK_MODE`. With none set, the app runs in MOCK mode.
3. Deploy. The React app is served from `dist/`; `/api/*` is handled by the Express app in a serverless function (`api/index.ts`).

Serverless caveats: in-memory state (mock-mode customers/transfers, the 11-second local rate limit, and the local initiation check) is per-instance and can reset between requests on Vercel. Mock mode may therefore return "not found" for records created earlier, and the local execute guard is skipped on Vercel (PayEngine enforces the 30-minute window itself). Use real sandbox credentials for a reliable end-to-end demo, or run locally.

## Interview preparation

See [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) for the architecture walkthrough, technology explanations, likely questions and answers, live-coding strategy and mock-mode demo checklist.

## Validation commands

```bash
npm run typecheck
npm run build
```

## Known provider documentation questions

1. Which authentication header(s) are required, and how is a Bearer token issued if applicable?
2. Should `payment.initiate` use `destination: { bank_code, account_number, account_name }` or `receiver_bank_code`, `receiver_account_number`, `receiver_account_name`?
3. Confirm `/lookup.accountNumber` as the canonical account-lookup path; the docs operation label differs.
4. What is the webhook signature/header verification scheme?
5. Confirm the sandbox PIN and test wallet/account details for test scenarios.

## Suggested live walkthrough

Start with the architecture: browser → Express `/api/*` → PayEngine sandbox. Explain that the server proxy protects credentials. Demonstrate customer creation and show that the returned wallet is provisioned by the customer endpoint. Then resolve a bank account, initiate a transfer, execute it in sandbox, verify status and retrieve transaction details. Keep the mock/live banner visible and explicitly state which environment is being used.
