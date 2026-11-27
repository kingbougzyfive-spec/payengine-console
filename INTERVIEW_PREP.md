# PayEngine Console — Live Coding & Interview Preparation

This guide is designed to help you explain the project accurately. Do not memorise answers mechanically. Understand the idea, then explain it in your own words.

## 1. 60-second project introduction

“I built a PayEngine Console using React, TypeScript and Vite. It demonstrates customer onboarding, automatic wallet provisioning, customer lookup, bank listing, recipient account verification and a staged bank-transfer flow. The frontend calls an Express API layer owned by the application; that server communicates with PayEngine so credentials are not exposed in the browser. I added Zod validation on both client and server, normalised upstream responses, and included a clearly labelled mock mode so the workflows can be demonstrated without live credentials. The payment flow separates initiation, execution and status verification because creating a transfer instruction is not the same as completing a transfer.”

## 2. Architecture: explain the request path

```text
React page / component
       |
       | fetch('/api/...')
       v
Express route (server/index.ts)
       |
       | Zod server-side validation
       v
PayEngine client (server/payengine.ts)
       |
       | server-only API key / Bearer token
       v
PayEngine sandbox
       |
       v
Normalised response -> React state -> user feedback
```

Why this design?

- The browser is an untrusted environment. Anything sent to it can be inspected.
- API credentials therefore stay in Express environment variables.
- Express is a backend-for-frontend (BFF): it adapts the external API to the needs of this UI.
- The server is a central place for validation, masking sensitive fields, rate limits, logging and consistent error handling.

## 3. What each technology does

| Technology | What it does here | How to explain the choice |
|---|---|---|
| React | Builds the interface from reusable components and state | “It lets me split the console into focused screens and components.” |
| TypeScript | Adds static types to data, functions and component contracts | “It catches many shape and type errors before runtime, especially useful when integrating APIs.” |
| Vite | Runs the React development server and builds static frontend assets | “It is lightweight and fast for a client-rendered React assessment.” |
| React Router | Maps URL paths to React pages without full page reloads | “It provides client-side navigation between customer, lookup and transfer screens.” |
| Express | Hosts the application's server-side API routes | “It keeps secrets off the client and centralises integration logic.” |
| Fetch API | Sends HTTP requests | “It is the browser/Node native API for making HTTP requests; I wrap it so error handling is consistent.” |
| React Hook Form | Manages form values, submission and field errors | “It avoids manually wiring every input and gives a structured form state.” |
| Zod | Validates runtime data against schemas | “It checks external/user-provided values at runtime; TypeScript types alone disappear at runtime.” |
| `@hookform/resolvers` | Connects Zod validation to React Hook Form | “It lets the form use the same Zod rules.” |
| dotenv | Loads local environment variables on the server | “It keeps environment-specific configuration out of source code.” |
| concurrently | Runs frontend and backend dev processes together | “One command starts Vite and Express during development.” |
| tsx | Runs TypeScript server files in development | “It lets Node run the Express TypeScript entry point without a separate compile step.” |

## 4. Folder structure and where to look

- `src/App.tsx`: application shell, navigation, routes and mock/live banner.
- `src/main.tsx`: React entry point; mounts the app and router.
- `src/pages/`: page-level UI for dashboard, customer creation, customer lookup, bank lookup and transfer.
- `src/components/ui.tsx`: reusable feedback, field and key/value display components.
- `src/lib/api.ts`: browser-side functions that call this app's `/api/*` routes.
- `src/lib/schemas.ts`: shared Zod validation schemas used by browser forms and Express routes.
- `server/index.ts`: Express routes, server-side validation, masking and transfer safeguards.
- `server/payengine.ts`: single upstream HTTP client, authentication headers, timeout and response normalisation.
- `server/config.ts`: reads environment variables and determines sandbox/mock configuration.
- `server/mock.ts`: in-memory simulated responses for a demo without real credentials.
- `README.md`: setup, configuration, architecture and known limitations.

## 5. Important API concepts

### Customer onboarding

`POST /customer.create` creates the customer and the API response includes a default wallet. That is why the normal onboarding flow does not immediately call `wallet.create` again. `POST /wallet.create` is available when an additional wallet is explicitly needed.

### Bank transfer

The bank transfer is intentionally staged. A separate server route also exposes the documented `CHECKOUT` variant of `payment.initiate`; the assessment UI focuses on bank transfer:

1. `GET /lookup.bankList`: obtain valid bank codes.
2. `POST /lookup.accountNumber`: resolve the account name for the selected bank/account number.
3. `POST /payment.initiate`: create the transfer instruction. It is not yet proof that funds were sent.
4. `POST /payment.bankTransfer`: authorise/execute using the exact initiation reference and sandbox transaction PIN.
5. `POST /payment.verifyStatus`: verify the final/current state.
6. `POST /transaction.findTransaction`: retrieve details using the transaction reference returned by the provider.

The docs say an initiation reference must be 17–18 digits, consecutive initiation requests must be at least 11 seconds apart, and an initiated transfer is valid for 30 minutes. The demo enforces an 11-second per-wallet interval and checks that execution follows a recent initiation. Its in-memory tracking is intentionally not presented as production-grade persistence.

### Never automatically retry an uncertain payment

A timeout only tells us that the client did not receive a response. It does not prove the provider did not process the request. The correct approach is to verify status before attempting another payment. Otherwise, duplicate payouts may occur.

## 6. Likely questions and defensible answers

### Why React + Vite instead of Next.js?

“The task was described as a React task, and the existing solution is a focused client-side console. Vite gives a fast development/build workflow. I kept the stack consistent rather than introducing a framework migration under a short deadline. If the requirements needed server-rendered pages, SEO, or Next.js-specific full-stack routing, I would consider Next.js. The API proxy is currently Express and can be moved to Next.js Route Handlers if that becomes a requirement.”

### Why TypeScript?

“API integrations involve several data shapes and optional fields. TypeScript makes those contracts explicit and helps catch incorrect property access and incompatible function arguments during development. It does not validate incoming JSON at runtime, which is why I also use Zod.”

### Why validate on both frontend and backend?

“Frontend validation improves user experience by showing errors before submission. It cannot be trusted for security because someone can bypass the browser and call the endpoint directly. Server-side validation is the enforcement layer.”

### Why use an Express proxy instead of calling PayEngine directly from React?

“Calling PayEngine from the browser would expose the API key or bearer token. The browser only calls my own server. Express attaches the secret credentials server-side and forwards the request.”

### Why use a shared API client?

“It prevents each route from reimplementing headers, timeouts, JSON parsing and error handling. It also gives the frontend one predictable response shape.”

### Why normalise the PayEngine response?

“The provider's examples have inconsistent status fields and response envelopes. The UI should not need to know every provider-specific variation. The server extracts the status, code, message, request ID and data into a predictable shape.”

### Why not rely only on HTTP status?

“The documentation shows that the HTTP status and the response body's status/code can differ. I inspect the HTTP response and provider response fields together. I also treat the documented pending codes separately from completed success.”

### What is the difference between initiation and execution?

“Initiation creates a pending transfer instruction. Execution is the separate authorisation step. I do not display initiation as a completed payout; I verify the status afterward.”

### Why generate an initiation reference?

“The API requires a unique 17–18 digit numeric reference. It lets the application correlate initiation, execution and status verification. The generated value is sent to the provider and then reused exactly.”

### Why enforce an 11-second interval?

“The PayEngine documentation says consecutive initiation requests should be at least 11 seconds apart to avoid duplicate-transfer detection. The demo applies that rule per wallet. In production I would use a persistent/distributed rate limiter, not an in-memory Map.”

### Why not automatically retry after a timeout?

“Because the provider may have processed the payment even though our request timed out. I would first call the status verification endpoint using the original initiation reference. Only after confirming the state would I decide what action is safe.”

### Why mock mode?

“It allows the UI and integration flow to be demonstrated without credentials or network access. The banner clearly says mock mode, and the README states that simulated success is not a real PayEngine result. Mock mode is for development, not proof of live integration.”

### Why mask BVN and NIN?

“They are sensitive identity data. The UI does not need the full values after lookup, so the server masks them before returning the response. I also avoid logging request bodies or credentials.”

### Why is the webhook route disabled?

“The documentation described the event payload and retry expectations but did not provide a signature-verification mechanism. Accepting credit notifications without authenticating their source could let an attacker forge a credit. I left the route disabled until the provider supplies the signature scheme and the app can persist events durably and deduplicate them.”

### Why no database?

“For this assessment, the primary demonstration is the API integration workflow. Mock records and initiation tracking are in memory, so they reset on restart. A production version needs durable storage for customers/merchant references, payment attempts, idempotency keys, audit records and webhook events. I would choose the database based on the team's existing platform and consistency requirements.”

### Did you use AI?

“Yes. The assessment permits AI, and I used it as a development assistant to accelerate scaffolding and review options. I still reviewed the code against the API documentation, made the integration decisions, and I can explain the request flow, validation, error handling and limitations. I don't want to present generated code as something I understand if I cannot defend it.”

### What would you improve next?

“I would confirm the provider's authentication and transfer payload contract, run end-to-end tests against the sandbox, add automated unit/integration tests, persist payment attempts, implement idempotency and audit logging, add user authentication/authorisation, and implement signed, durable, idempotent webhook processing.”

## 7. Documentation uncertainties — be transparent

The supplied PayEngine docs conflict on several points. Do not invent certainty:

1. Authentication: some tables specify `api-key`; generated requests show Bearer. The app supports `api-key`, `bearer` or `both` through `PAYENGINE_AUTH_MODE`. Confirm the correct setting and how a Bearer token is issued.
2. Transfer initiation body: the field table specifies nested `destination`; the sample uses flat `receiver_*` fields. The app supports both using `PAYENGINE_TRANSFER_PAYLOAD_MODE`. The default `nested` follows the field table but is not live-verified.
3. Account lookup: operation label says `lookup.accountLookup`, while the URL is `/lookup.accountNumber`. The app uses the URL shown in the endpoint documentation.
4. Webhook: signature verification is not documented in the supplied material; the endpoint is deliberately disabled.
5. Sandbox credentials and test PIN must be supplied/confirmed by the employer. Never place secrets in source code or commit them.

Suggested clarification to the employer:

“I've wired the main customer and transfer flows against the endpoint documentation. I noticed two inconsistencies before live sandbox verification: the auth examples alternate between the api-key header and Bearer token, and the transfer initiation payload shows both a nested destination object and flat receiver fields. Could you confirm the expected auth method and canonical payload?”

## 8. Live coding: how to conduct yourself

1. **Clarify before coding.** Repeat the requirement in your own words. Ask about required fields, API contract, success state and edge cases.
2. **State a small plan.** “I'll validate the input, call the server endpoint, handle loading/error/success states, then test the response.”
3. **Think aloud.** Explain why you are choosing a state variable, schema, API function or server route.
4. **Build the smallest vertical slice.** One form → one route → one upstream request → one visible result. Do not scaffold five features before testing the first.
5. **Test failure paths.** Try missing input, invalid account number, unknown customer, provider error and network failure.
6. **Do not hide uncertainty.** If docs conflict, show the exact ambiguity and ask the API owner. Explain the safe configurable approach.
7. **Use AI transparently.** If you consult AI, say what you asked it to help with and then explain the code you accepted or changed.
8. **Narrate verification.** Run typecheck/build and test the actual workflow. Distinguish mock results from sandbox results.

Useful phrases during live coding:

- “Before I implement this, I want to confirm the expected response shape.”
- “I'll keep the external API call out of the component so the UI stays focused on presentation and state.”
- “I'll validate this on the server too, because client-side validation is bypassable.”
- “This is a pending state, not a completed transaction, so I'll verify before showing it as successful.”
- “I don't want to guess the provider's contract; I'll isolate this assumption and confirm it.”
- “Let me test the failure path as well, not just the happy path.”

## 9. Practical mock-mode demonstration checklist

1. Run `npm install`, then `npm run dev`.
2. Confirm the yellow MOCK MODE banner is visible.
3. Create a customer using synthetic values only. Use a fake BVN/NIN accepted by local validation; mock mode does not perform real KYC.
4. Record the returned customer ID and wallet ID.
5. Find the customer and show the automatically provisioned wallet.
6. Optionally create an additional wallet.
7. Open Bank transfer, choose Sandbox Test Bank (`000`) and enter a 10-digit non-zero account number.
8. Resolve the account. Mock mode returns a test account holder.
9. Use the wallet ID from customer creation, enter a small test amount and narration, and initiate.
10. Enter any non-empty mock PIN; mock mode simulates execution. Explain that this is not a real payment.
11. Verify status and use the returned transaction reference to find transaction details.
12. Explain that live sandbox verification still requires provider credentials and the documentation questions to be answered.

## 10. Before the employer call

- Know the architecture diagram and the request flow.
- Know where API credentials are configured and why they are server-only.
- Be able to explain one Zod schema and one Express route.
- Be able to explain why payment initiation and execution are separate.
- Know how you handle pending responses and network timeouts.
- Be honest that the project has not been live-verified unless you actually test it with provider credentials.
- Do not claim production readiness: authentication, persistence, user access control, durable idempotency and signed webhooks remain production work.
