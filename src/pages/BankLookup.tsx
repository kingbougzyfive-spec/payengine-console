import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accountLookupSchema, type AccountLookupInput } from '../lib/schemas';
import { api, type ApiResult, type Bank } from '../lib/api';
import { Feedback, Field, KV } from '../components/ui';

export default function BankLookup() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksResult, setBanksResult] = useState<ApiResult | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<AccountLookupInput>({
    resolver: zodResolver(accountLookupSchema),
  });

  useEffect(() => {
    api.banks().then((r) => {
      setBanksResult(r);
      if (r.ok && Array.isArray(r.data)) setBanks(r.data);
    });
  }, []);

  const lookup = async (v: AccountLookupInput) => {
    setLoading(true);
    setResult(null);
    setResult(await api.lookupAccount(v));
    setLoading(false);
  };

  return (
    <section>
      <h2>Bank &amp; account lookup</h2>
      <p className="hint">
        Step 1 of a transfer: resolve the recipient's verified name. Initiating and executing a transfer is intentionally
        not enabled yet, because the docs contradict themselves on the request payload.
      </p>

      <Feedback result={banksResult} />
      <form onSubmit={handleSubmit(lookup)} noValidate className="card grid">
        <Field label="Bank" error={errors.bank_code?.message}>
          <select {...register('bank_code')} disabled={banks.length === 0} defaultValue="">
            <option value="" disabled>{banks.length ? 'Select a bank' : 'Loading banks…'}</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
          </select>
        </Field>
        <Field label="Account number (10 digits)" error={errors.account_number?.message}>
          <input inputMode="numeric" {...register('account_number')} />
        </Field>
        <div className="actions"><button disabled={loading}>{loading ? 'Resolving…' : 'Resolve account'}</button></div>
      </form>

      <Feedback result={result} />
      {result?.ok && result.data && (
        <div className="alert success">
          <strong>Account verified</strong>
          <KV rows={[
            ['Account name', result.data.account_name],
            ['Account number', <code>{result.data.account_number}</code>],
            ['Bank', result.data.bank_name],
          ]} />
        </div>
      )}
    </section>
  );
}
