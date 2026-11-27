import { config } from './config.js';
import { mockCall } from './mock.js';

/** One shape for every upstream reply, so the UI never has to understand PayEngine's quirks. */
export interface Normalized<T = unknown> {
  ok: boolean;
  httpStatus: number;
  code?: string;
  type?: string;
  message: string;
  requestId?: string;
  data?: T;
  mock: boolean;
  pending?: boolean;
}

// Codes the docs call "success". Everything else is treated as a failure.
const SUCCESS_CODES = new Set(['00', '4000', '4414']);
const PENDING_CODES = new Set(['4408', '4413']);

export async function callPayEngine<T = any>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<Normalized<T>> {
  if (config.mock) return mockCall(method, path, body) as Normalized<T>;

  // The docs disagree on auth (api-key header vs Bearer). PAYENGINE_AUTH_MODE picks which to send.
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if ((config.authMode === 'api-key' || config.authMode === 'both') && config.apiKey) headers['api-key'] = config.apiKey;
  if ((config.authMode === 'bearer' || config.authMode === 'both') && config.bearer) {
    headers.Authorization = `Bearer ${config.bearer}`;
  }

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // Network failure / timeout. Never include headers in this log.
    console.error(`[payengine] ${method} ${path} -> network error: ${(err as Error).name}`);
    return { ok: false, httpStatus: 502, code: 'NETWORK_ERROR', message: 'Could not reach the PayEngine sandbox. Try again.', mock: false };
  }

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = undefined; // non-JSON (e.g. an HTML error page from a proxy)
  }

  if (!json || typeof json !== 'object') {
    console.error(`[payengine] ${method} ${path} -> ${res.status} non-JSON body`);
    return { ok: false, httpStatus: res.status, code: 'BAD_RESPONSE', message: 'PayEngine returned an unreadable response.', mock: false };
  }

  const code = json.response_code != null ? String(json.response_code) : undefined;
  const bodyStatus = typeof json.response_status === 'number' ? json.response_status : res.status;
  // Success needs ALL of: HTTP 2xx, body status 2xx, and (if a code is present) a success code.
  // The docs show HTTP status and body status disagreeing, so we never trust just one.
  const pending = code !== undefined && PENDING_CODES.has(code);
  const ok = res.ok && bodyStatus >= 200 && bodyStatus < 300 && (code === undefined || SUCCESS_CODES.has(code) || pending);

  console.log(`[payengine] ${method} ${path} -> ${res.status} code=${code ?? '-'} request_id=${json.request_id ?? '-'}`);

  return {
    ok,
    httpStatus: res.status,
    code,
    type: json.response_type,
    message: json.response_message || json.response_description || (pending ? 'The transaction is still processing.' : ok ? 'OK' : 'Request failed'),
    pending,
    requestId: json.request_id,
    data: json.data as T,
    mock: false,
  };
}
