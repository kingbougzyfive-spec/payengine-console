import express from 'express';
import type { Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { config } from './config.js';
import { callPayEngine, type Normalized } from './payengine.js';
import {
  createCustomerSchema, findCustomerSchema, createWalletSchema, accountLookupSchema, initiateTransferSchema,
  executeTransferSchema, verifyTransferSchema, transactionLookupSchema, initiateCheckoutSchema, stripEmpty,
} from '../src/lib/schemas.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

const mask = (v: unknown) => (typeof v === 'string' && v.length > 4 ? `${'•'.repeat(v.length - 4)}${v.slice(-4)}` : v);
function parse<S extends ZodTypeAny>(schema: S, input: unknown, res: Response): ReturnType<S['parse']> | null {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  res.status(422).json({ ok: false, httpStatus: 422, code: 'LOCAL_VALIDATION', message: 'Please fix the highlighted fields.', fieldErrors: result.error.flatten().fieldErrors, mock: config.mock });
  return null;
}
const send = (res: Response, r: Normalized) => res.status(200).json(r);
const lastInitiationAt = new Map<string, number>();
const initiatedAt = new Map<string, number>();
const initiationWindowMs = 11_000;
// On Vercel each request may hit a different serverless instance, so in-memory tracking is unreliable.
// There we skip the local check and rely on PayEngine's own 30-minute validity enforcement.
const serverless = Boolean(process.env.VERCEL);
const validInitiation = (reference: string) => {
  if (serverless) return true;
  const at = initiatedAt.get(reference);
  return at !== undefined && Date.now() - at <= 30 * 60 * 1000;
};

app.get('/api/health', (_req, res) => res.json({
  ok: true, mock: config.mock, authMode: config.authMode,
  transferPayloadMode: config.transferPayloadMode,
  baseUrl: config.mock ? null : config.baseUrl,
}));

app.post('/api/customers', async (req, res) => {
  const input = parse(createCustomerSchema, req.body, res); if (!input) return;
  send(res, await callPayEngine('POST', '/customer.create', stripEmpty(input)));
});
app.post('/api/customers/find', async (req, res) => {
  const input = parse(findCustomerSchema, req.body, res); if (!input) return;
  const r = await callPayEngine<any>('POST', '/customer.findCustomer', input);
  if (r.ok && r.data) r.data = { ...r.data, bvn: mask(r.data.bvn), nin: mask(r.data.nin) };
  send(res, r);
});
app.post('/api/wallets', async (req, res) => {
  const input = parse(createWalletSchema, req.body, res); if (!input) return;
  send(res, await callPayEngine('POST', '/wallet.create', input));
});
app.get('/api/banks', async (_req, res) => send(res, await callPayEngine('GET', '/lookup.bankList')));
app.post('/api/accounts/lookup', async (req, res) => {
  const input = parse(accountLookupSchema, req.body, res); if (!input) return;
  send(res, await callPayEngine('POST', '/lookup.accountNumber', input));
});

app.post('/api/transfers/initiate', async (req, res) => {
  const input = parse(initiateTransferSchema, req.body, res); if (!input) return;
  const previous = lastInitiationAt.get(input.wallet_id) ?? 0;
  const waitMs = initiationWindowMs - (Date.now() - previous);
  if (waitMs > 0) {
    res.status(429).json({ ok: false, httpStatus: 429, code: 'LOCAL_RATE_LIMIT', message: `Wait ${Math.ceil(waitMs / 1000)} seconds before initiating another transfer from this wallet.`, mock: config.mock });
    return;
  }
  const common = {
    initiation_reference: input.initiation_reference,
    wallet_id: input.wallet_id,
    amount: input.amount,
    fee: input.fee,
    currency: input.currency,
    narration: input.narration,
    payment_type: input.payment_type,
  };
  // The API documentation conflicts: its field table says destination{}, while its example uses receiver_*.
  const destination = { bank_code: input.bank_code, account_number: input.account_number, account_name: input.account_name };
  const payload = config.transferPayloadMode === 'nested'
    ? { ...common, destination }
    : { ...common, receiver_bank_code: destination.bank_code, receiver_account_number: destination.account_number, receiver_account_name: destination.account_name };
  lastInitiationAt.set(input.wallet_id, Date.now());
  const result = await callPayEngine('POST', '/payment.initiate', payload);
  if (result.ok) initiatedAt.set(input.initiation_reference, Date.now());
  send(res, result);
});

app.post('/api/checkout/initiate', async (req, res) => {
  const input = parse(initiateCheckoutSchema, req.body, res); if (!input) return;
  const previous = lastInitiationAt.get(input.wallet_id) ?? 0;
  const waitMs = initiationWindowMs - (Date.now() - previous);
  if (waitMs > 0) {
    res.status(429).json({ ok: false, httpStatus: 429, code: 'LOCAL_RATE_LIMIT', message: `Wait ${Math.ceil(waitMs / 1000)} seconds before initiating another payment from this wallet.`, mock: config.mock });
    return;
  }
  lastInitiationAt.set(input.wallet_id, Date.now());
  const result = await callPayEngine('POST', '/payment.initiate', stripEmpty(input));
  if (result.ok) initiatedAt.set(input.initiation_reference, Date.now());
  send(res, result);
});

app.post('/api/transfers/execute', async (req, res) => {
  const input = parse(executeTransferSchema, req.body, res); if (!input) return;
  if (!validInitiation(input.initiation_reference)) {
    res.status(400).json({ ok: false, httpStatus: 400, code: 'INITIATION_EXPIRED_OR_UNKNOWN', message: 'This app has no recent initiation for that reference, or its 30-minute validity window has expired. Verify status before retrying.', mock: config.mock });
    return;
  }
  // The PIN is forwarded only for this request; it is never stored or logged.
  const result = await callPayEngine('POST', '/payment.bankTransfer', input);
  send(res, result);
});
app.post('/api/transfers/verify', async (req, res) => {
  const input = parse(verifyTransferSchema, req.body, res); if (!input) return;
  send(res, await callPayEngine('POST', '/payment.verifyStatus', input));
});
app.post('/api/transactions/find', async (req, res) => {
  const input = parse(transactionLookupSchema, req.body, res); if (!input) return;
  send(res, await callPayEngine('POST', '/transaction.findTransaction', input));
});

// Documentation supplied no webhook signature scheme. This endpoint is an integration placeholder,
// not production-secure: do not process/credit funds until signature verification and durable storage exist.
app.post('/api/webhooks/payengine', (_req, res) => {
  res.status(501).json({ ok: false, code: 'WEBHOOK_VERIFICATION_NOT_CONFIGURED', message: 'Webhook signature verification and durable event storage must be configured before enabling this endpoint.' });
});

export default app;
