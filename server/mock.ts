import type { Normalized } from './payengine.js';

interface MockCustomer {
  customer_id: string; first_name: string; last_name: string; email: string; phone_number: string;
  bvn: string; nin?: string; gender?: string; status: string; kyc_level: number;
  wallets: { wallet_id: string; account_number: string; account_name: string; balance: number; currency: string }[];
}
interface MockTransfer { initiation_reference: string; transaction_reference: string; status: string; amount: number; fee: number; destination: Record<string, string>; narration: string; created_at: string }
const customers = new Map<string, MockCustomer>();
const transfers = new Map<string, MockTransfer>();
const rid = () => `mock-${Math.random().toString(36).slice(2, 10)}`;
const num = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
const ok = (type: string, data: unknown): Normalized => ({ ok: true, httpStatus: 200, code: '00', type, message: 'Successful (mock)', requestId: rid(), data, mock: true });
const fail = (httpStatus: number, code: string, type: string, message: string): Normalized => ({ ok: false, httpStatus, code, type, message, requestId: rid(), mock: true });
const BANKS = [
  { code: '000', name: 'Sandbox Test Bank' }, { code: '011', name: 'First Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' }, { code: '044', name: 'Access Bank' },
  { code: '050', name: 'Ecobank Nigeria' }, { code: '057', name: 'Zenith Bank' },
  { code: '058', name: 'Guaranty Trust Bank' }, { code: '070', name: 'Fidelity Bank' },
  { code: '214', name: 'First City Monument Bank' },
];

export function mockCall(method: string, path: string, body: any): Normalized {
  switch (`${method} ${path}`) {
    case 'POST /customer.create': {
      const dup = [...customers.values()].find((c) => c.email === body.email || c.bvn === body.bvn);
      if (dup) return fail(409, '3008', 'CUSTOMER_ALREADY_EXISTS', 'Customer already exists');
      const customer_id = `CUS-${num(8)}`;
      const wallet = { wallet_id: `WAL-${num(8)}`, account_number: num(10), account_name: `${body.first_name} ${body.last_name}`, balance: 0, currency: 'NGN' };
      customers.set(customer_id, { customer_id, first_name: body.first_name, last_name: body.last_name, email: body.email, phone_number: body.phone_number, bvn: body.bvn, nin: body.nin, gender: body.gender, status: 'ACTIVE', kyc_level: 1, wallets: [wallet] });
      return ok('CUSTOMER_REQUEST_SUCCESSFUL', { customer_id, wallet_id: wallet.wallet_id, account_number: wallet.account_number });
    }
    case 'POST /customer.findCustomer': {
      const c = customers.get(body.customer_id);
      return c ? ok('CUSTOMER_REQUEST_SUCCESSFUL', c) : fail(404, 'MOCK_NOT_FOUND', 'CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    case 'POST /wallet.create': {
      const customer = customers.get(body.customer_id);
      if (!customer) return fail(404, 'MOCK_NOT_FOUND', 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
      const wallet = { wallet_id: `WAL-${num(8)}`, account_number: num(10), account_name: body.account_name, balance: 0, currency: 'NGN' };
      customer.wallets.push(wallet);
      return ok('WALLET_CREATED', wallet);
    }
    case 'GET /lookup.bankList': return ok('LOOKUP_REQUEST_SUCCESSFUL', BANKS);
    case 'POST /lookup.accountNumber': {
      const bank = BANKS.find((b) => b.code === body.bank_code);
      if (!bank) return fail(400, 'MOCK_INVALID_BANK', 'INVALID_BANK', 'Unknown bank code');
      if (/^0+$/.test(body.account_number)) return fail(404, 'MOCK_NOT_FOUND', 'ACCOUNT_NOT_FOUND', 'Account could not be resolved');
      return ok('LOOKUP_REQUEST_SUCCESSFUL', { account_number: body.account_number, account_name: 'Test Account Holder', bank_code: bank.code, bank_name: bank.name });
    }
    case 'POST /payment.initiate': {
      const ref = body.initiation_reference;
      if (transfers.has(ref)) return fail(409, '4012', 'DUPLICATE_TRANSFER_DETECTED', 'A transfer with this initiation reference already exists.');
      const destination = body.destination ?? { bank_code: body.receiver_bank_code, account_number: body.receiver_account_number, account_name: body.receiver_account_name };
      const transfer: MockTransfer = { initiation_reference: ref, transaction_reference: `TXN-${num(12)}`, status: 'INITIATED', amount: Number(body.amount), fee: Number(body.fee ?? 0), destination, narration: body.narration, created_at: new Date().toISOString() };
      transfers.set(ref, transfer);
      return ok('PAYMENT_INITIATED', { ...transfer, payment_type: 'BANK_TRANSFER' });
    }
    case 'POST /payment.bankTransfer': {
      const t = transfers.get(body.initiation_reference);
      if (!t) return fail(404, '4415', 'TRANSACTION_NOT_FOUND', 'Initiated transfer was not found.');
      if (t.status === 'SUCCESSFUL') return ok('PAYMENT_ALREADY_APPROVED', t);
      if (!body.transaction_pin) return fail(400, '4405', 'INVALID_PIN', 'A transaction PIN is required.');
      t.status = 'SUCCESSFUL';
      return ok('PAYMENT_SUCCESSFUL', t);
    }
    case 'POST /payment.verifyStatus': {
      const t = transfers.get(body.initiation_reference);
      return t ? ok('PAYMENT_STATUS', t) : fail(404, '4415', 'TRANSACTION_NOT_FOUND', 'Transfer reference was not found.');
    }
    case 'POST /transaction.findTransaction': {
      const t = [...transfers.values()].find((x) => x.transaction_reference === body.transaction_reference);
      return t ? ok('TRANSACTION_DETAILS', t) : fail(404, '4415', 'TRANSACTION_NOT_FOUND', 'Transaction was not found.');
    }
    default: return fail(404, 'MOCK_UNSUPPORTED', 'UNSUPPORTED', `Mock mode does not implement ${method} ${path}`);
  }
}
