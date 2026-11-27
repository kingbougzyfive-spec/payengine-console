import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { findCustomerSchema, type FindCustomerInput } from '../lib/schemas';
import { api, type ApiResult } from '../lib/api';
import { Feedback, Field, KV } from '../components/ui';

export default function FindCustomer() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [walletResult, setWalletResult] = useState<ApiResult | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FindCustomerInput>({
    resolver: zodResolver(findCustomerSchema),
  });

  const search = async ({ customer_id }: FindCustomerInput) => {
    setLoading(true);
    setResult(null);
    setResult(await api.findCustomer(customer_id));
    setLoading(false);
  };

  // Arriving from "View this customer" pre-fills and runs the lookup.
  useEffect(() => {
    const id = params.get('id');
    if (id) { setValue('customer_id', id); search({ customer_id: id }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = result?.ok ? result.data : null;
  const addWallet = async () => {
    if (!c?.customer_id || !walletName.trim()) return;
    setWalletLoading(true); setWalletResult(null);
    const created = await api.createWallet({ customer_id: c.customer_id, account_name: walletName.trim() });
    setWalletResult(created); setWalletLoading(false);
    if (created.ok) { setWalletName(''); setResult(await api.findCustomer(c.customer_id)); }
  };

  return (
    <section>
      <h2>Find customer</h2>
      <form onSubmit={handleSubmit(search)} noValidate className="card row">
        <Field label="Customer ID" error={errors.customer_id?.message}>
          <input placeholder="CUS-..." {...register('customer_id')} />
        </Field>
        <button disabled={loading}>{loading ? 'Searching…' : 'Find'}</button>
      </form>

      <Feedback result={result} />
      {c && (
        <div className="card">
          <h3>{[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'}</h3>
          <KV rows={[
            ['Customer ID', <code>{c.customer_id}</code>],
            ['Email', c.email],
            ['Phone', c.phone_number],
            ['Status', <span className="pill">{c.status}</span>],
            ['KYC level', c.kyc_level],
            ['BVN (masked)', c.bvn],
            ['NIN (masked)', c.nin],
          ]} />
          <h4>Wallets</h4>
          {(c.wallets ?? []).length === 0 && <p className="hint">No wallets returned.</p>}
          {(c.wallets ?? []).map((w: any) => (
            <div className="wallet" key={w.wallet_id}>
              <KV rows={[
                ['Wallet ID', <code>{w.wallet_id}</code>],
                ['Account number', <code>{w.account_number}</code>],
                ['Balance', w.balance != null ? `${w.currency ?? 'NGN'} ${Number(w.balance).toLocaleString()}` : '-'],
              ]} />
            </div>
          ))}
          <div className="wallet grid">
            <h4 className="span-all">Create an additional wallet</h4>
            <Field label="Account name"><input value={walletName} onChange={(e) => setWalletName(e.target.value)} placeholder="Name for the new wallet" /></Field>
            <div className="actions"><button disabled={!walletName.trim() || walletLoading} onClick={addWallet}>{walletLoading ? 'Creating…' : 'Create wallet'}</button></div>
            <Feedback result={walletResult} />
          </div>
        </div>
      )}
    </section>
  );
}
