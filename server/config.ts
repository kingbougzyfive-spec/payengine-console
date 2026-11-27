import 'dotenv/config';

type AuthMode = 'api-key' | 'bearer' | 'both';
type TransferPayloadMode = 'nested' | 'flat';
const apiKey = process.env.PAYENGINE_API_KEY?.trim() || '';
const bearer = process.env.PAYENGINE_BEARER_TOKEN?.trim() || '';
const authMode = (process.env.PAYENGINE_AUTH_MODE?.trim() as AuthMode) || 'both';
const payloadMode = (process.env.PAYENGINE_TRANSFER_PAYLOAD_MODE?.trim() as TransferPayloadMode) || 'nested';

export const config = {
  baseUrl: (process.env.PAYENGINE_BASE_URL || 'https://sandbox.bankingcomponent.com/payengine/v1').replace(/\/$/, ''),
  apiKey,
  bearer,
  authMode: ['api-key', 'bearer', 'both'].includes(authMode) ? authMode : 'both',
  transferPayloadMode: ['nested', 'flat'].includes(payloadMode) ? payloadMode : 'nested',
  mock: process.env.MOCK_MODE === 'true' || (!apiKey && !bearer),
  port: Number(process.env.API_PORT) || 8787,
};
