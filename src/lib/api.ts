// The browser talks only to this application's API. PayEngine credentials remain on Express.
export interface ApiResult<T = any> {
  ok: boolean; httpStatus: number; code?: string; type?: string; message: string;
  requestId?: string; data?: T; mock: boolean; fieldErrors?: Record<string, string[]>;
}
async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const payload = await res.json();
    return { ...payload, httpStatus: payload.httpStatus ?? res.status } as ApiResult<T>;
  } catch {
    return { ok: false, httpStatus: 0, code: 'NETWORK_ERROR', message: 'Cannot reach the app server. Is it running?', mock: false };
  }
}
export interface Wallet { wallet_id: string; account_number: string; account_name?: string; balance?: number; currency?: string }
export interface Bank { code: string; name: string }
export interface TransferData { initiation_reference: string; transaction_reference?: string; status?: string; amount?: number; fee?: number; destination?: Record<string, string>; [key: string]: unknown }
export const api = {
  health: () => request<never>('GET', '/api/health') as Promise<any>,
  createCustomer: (b: unknown) => request<{ customer_id: string; wallet_id: string; account_number: string }>('POST', '/api/customers', b),
  findCustomer: (customer_id: string) => request<any>('POST', '/api/customers/find', { customer_id }),
  createWallet: (b: { customer_id: string; account_name: string }) => request<any>('POST', '/api/wallets', b),
  banks: () => request<Bank[]>('GET', '/api/banks'),
  lookupAccount: (b: { bank_code: string; account_number: string }) => request<{ account_name?: string; full_name?: string; account_number: string; bank_name?: string }>('POST', '/api/accounts/lookup', b),
  initiateTransfer: (b: unknown) => request<TransferData>('POST', '/api/transfers/initiate', b),
  initiateCheckout: (b: unknown) => request<TransferData>('POST', '/api/checkout/initiate', b),
  executeTransfer: (b: { initiation_reference: string; transaction_pin: string }) => request<TransferData>('POST', '/api/transfers/execute', b),
  verifyTransfer: (initiation_reference: string) => request<TransferData>('POST', '/api/transfers/verify', { initiation_reference }),
  findTransaction: (transaction_reference: string) => request<TransferData>('POST', '/api/transactions/find', { transaction_reference }),
};
