import { z } from 'zod';

const digits = (n: number, label: string) =>
  z.string().regex(new RegExp(`^\\d{${n}}$`), `${label} must be exactly ${n} digits`);
const optionalText = z.string().trim().optional().or(z.literal(''));

export const createCustomerSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  middle_name: optionalText,
  last_name: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Enter a valid email'),
  phone_number: z.string().trim().regex(/^(\+?234|0)\d{10}$/, 'Use a Nigerian number, e.g. 08000000000'),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional().or(z.literal('')),
  bvn: digits(11, 'BVN'),
  nin: digits(11, 'NIN').optional().or(z.literal('')),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const findCustomerSchema = z.object({ customer_id: z.string().trim().min(1, 'Customer ID is required') });
export const createWalletSchema = z.object({ customer_id: z.string().trim().min(1, 'Customer ID is required'), account_name: z.string().trim().min(1, 'Account name is required') });
export type FindCustomerInput = z.infer<typeof findCustomerSchema>;

export const accountLookupSchema = z.object({ bank_code: z.string().trim().min(1, 'Select a bank'), account_number: digits(10, 'Account number') });
export type AccountLookupInput = z.infer<typeof accountLookupSchema>;

export const initiateTransferSchema = z.object({
  wallet_id: z.string().trim().min(1, 'Wallet ID is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero').max(100000000, 'Amount is too large'),
  fee: z.coerce.number().min(0).optional().default(0),
  currency: z.string().trim().default('NGN'),
  narration: z.string().trim().min(3, 'Enter a narration').max(100, 'Narration must be 100 characters or fewer'),
  initiation_reference: z.string().regex(/^\d{17,18}$/, 'Reference must be 17–18 digits'),
  payment_type: z.literal('BANK_TRANSFER'),
  bank_code: z.string().trim().min(1),
  account_number: digits(10, 'Account number'),
  account_name: z.string().trim().min(1, 'Resolve the recipient account first'),
});
export type InitiateTransferInput = z.infer<typeof initiateTransferSchema>;
export const initiateCheckoutSchema = z.object({
  wallet_id: z.string().trim().min(1, 'Wallet ID is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  fee: z.coerce.number().min(0).optional().default(0),
  currency: z.string().trim().default('NGN'),
  narration: z.string().trim().min(3).max(100),
  initiation_reference: z.string().regex(/^\d{17,18}$/),
  payment_type: z.literal('CHECKOUT'),
});

export const executeTransferSchema = z.object({
  initiation_reference: z.string().regex(/^\d{17,18}$/),
  transaction_pin: z.string().min(1, 'Transaction PIN is required'),
});
export const verifyTransferSchema = z.object({ initiation_reference: z.string().regex(/^\d{17,18}$/) });
export const transactionLookupSchema = z.object({ transaction_reference: z.string().trim().min(1, 'Transaction reference is required') });

export function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as Partial<T>;
}
