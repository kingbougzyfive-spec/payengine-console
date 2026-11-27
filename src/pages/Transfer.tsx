import { useEffect, useMemo, useState } from 'react';
import { api, type ApiResult, type Bank, type TransferData } from '../lib/api';
import { Feedback, Field, KV } from '../components/ui';

const makeReference = () => {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  return `${stamp}${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;
};

export default function Transfer() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankResult, setBankResult] = useState<ApiResult | null>(null);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [recipient, setRecipient] = useState<{ account_name: string; account_number: string; bank_name?: string } | null>(null);
  const [lookupResult, setLookupResult] = useState<ApiResult | null>(null);
  const [transferResult, setTransferResult] = useState<ApiResult<TransferData> | null>(null);
  const [executeResult, setExecuteResult] = useState<ApiResult<TransferData> | null>(null);
  const [verifyResult, setVerifyResult] = useState<ApiResult<TransferData> | null>(null);
  const [transactionResult, setTransactionResult] = useState<ApiResult<TransferData> | null>(null);
  const [pin, setPin] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [busy, setBusy] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => { api.banks().then((r) => { setBankResult(r); if (r.ok && Array.isArray(r.data)) setBanks(r.data); }); }, []);
  const canInitiate = useMemo(() => Boolean(recipient && walletId.trim() && Number(amount) > 0 && narration.trim().length >= 3), [recipient, walletId, amount, narration]);

  const lookup = async () => {
    setBusy('lookup'); setLookupResult(null); setRecipient(null);
    const r = await api.lookupAccount({ bank_code: bankCode, account_number: accountNumber });
    setLookupResult(r);
    const name = r.data?.account_name ?? r.data?.full_name;
    if (r.ok && name) setRecipient({ account_name: name, account_number: r.data?.account_number ?? accountNumber, bank_name: r.data?.bank_name ?? banks.find((b) => b.code === bankCode)?.name });
    setBusy('');
  };
  const initiate = async () => {
    if (!recipient) return;
    const nextReference = makeReference(); setReference(nextReference); setBusy('initiate'); setTransferResult(null); setExecuteResult(null); setVerifyResult(null);
    const r = await api.initiateTransfer({ wallet_id: walletId.trim(), amount: Number(amount), fee: 0, currency: 'NGN', narration: narration.trim(), initiation_reference: nextReference, payment_type: 'BANK_TRANSFER', bank_code: bankCode, account_number: recipient.account_number, account_name: recipient.account_name });
    setTransferResult(r); setBusy('');
  };
  const execute = async () => {
    if (!reference || !pin) return;
    setBusy('execute'); setExecuteResult(null);
    const r = await api.executeTransfer({ initiation_reference: reference, transaction_pin: pin });
    setExecuteResult(r); setPin(''); setBusy('');
    const txn = r.data?.transaction_reference;
    if (txn) setTransactionReference(txn);
  };
  const verify = async () => {
    if (!reference) return;
    setBusy('verify'); setVerifyResult(await api.verifyTransfer(reference)); setBusy('');
  };
  const findTransaction = async () => {
    if (!transactionReference.trim()) return;
    setBusy('transaction'); setTransactionResult(await api.findTransaction(transactionReference.trim())); setBusy('');
  };
  const display = (r: ApiResult<TransferData> | null) => r?.data ? [
    ['Status', r.data.status], ['Initiation reference', <code>{r.data.initiation_reference ?? reference}</code>],
    ['Transaction reference', <code>{r.data.transaction_reference ?? '-'}</code>], ['Amount', r.data.amount != null ? `NGN ${Number(r.data.amount).toLocaleString()}` : '-'],
  ] as [string, React.ReactNode][] : [];

  return <section>
    <h2>Bank transfer</h2>
    <p className="hint">Sandbox workflow: resolve recipient → initiate → authorise → verify. Use synthetic test data and sandbox credentials only.</p>
    <Feedback result={bankResult} />
    <div className="card grid">
      <h3 className="span-all">1. Resolve recipient account</h3>
      <Field label="Destination bank"><select value={bankCode} onChange={(e) => { setBankCode(e.target.value); setRecipient(null); }}><option value="">Select bank</option>{banks.map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}</select></Field>
      <Field label="Account number"><input value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setRecipient(null); }} inputMode="numeric" maxLength={10} /></Field>
      <div className="actions"><button disabled={busy === 'lookup' || !bankCode || !/^\d{10}$/.test(accountNumber)} onClick={lookup}>{busy === 'lookup' ? 'Resolving…' : 'Resolve account'}</button></div>
      <Feedback result={lookupResult} />
      {recipient && <div className="alert success span-all"><strong>Recipient resolved</strong><KV rows={[["Account name", recipient.account_name], ["Account number", recipient.account_number], ["Bank", recipient.bank_name]]} /></div>}
    </div>
    <div className="card grid">
      <h3 className="span-all">2. Initiate transfer</h3>
      <Field label="Source wallet ID"><input value={walletId} onChange={(e) => setWalletId(e.target.value)} placeholder="WAL-..." /></Field>
      <Field label="Amount (NGN)"><input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Narration"><input value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={100} /></Field>
      <div className="actions"><button disabled={!canInitiate || busy === 'initiate'} onClick={initiate}>{busy === 'initiate' ? 'Initiating…' : 'Initiate transfer'}</button></div>
      <p className="hint span-all">The initiation reference is generated by the app. The API documentation requires 17–18 digits and an 11-second interval between initiations from the same wallet.</p>
      <Feedback result={transferResult} />
      {transferResult?.ok && <div className="alert success span-all"><strong>Transfer initiated (not yet executed)</strong><KV rows={display(transferResult)} /></div>}
    </div>
    {transferResult?.ok && <div className="card grid">
      <h3 className="span-all">3. Authorise and execute</h3>
      <Field label="Sandbox transaction PIN"><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" /></Field>
      <div className="actions"><button disabled={!pin || busy === 'execute'} onClick={execute}>{busy === 'execute' ? 'Submitting…' : 'Authorise transfer'}</button></div>
      <p className="hint span-all">The PIN is sent to the server for this request only. It is not saved in browser storage or application logs.</p>
      <Feedback result={executeResult} />
      {executeResult?.ok && <div className="alert success span-all"><strong>Execution response received</strong><KV rows={display(executeResult)} /></div>}
      <div className="actions"><button className="secondary" disabled={busy === 'verify'} onClick={verify}>{busy === 'verify' ? 'Checking…' : 'Verify transfer status'}</button></div>
      <Feedback result={verifyResult} />
      {verifyResult?.data && <div className="alert success span-all"><strong>Latest status</strong><KV rows={display(verifyResult)} /></div>}
    </div>}
    <div className="card grid">
      <h3 className="span-all">4. Find transaction details</h3>
      <Field label="Transaction reference"><input value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="Reference returned by execution" /></Field>
      <div className="actions"><button disabled={!transactionReference.trim() || busy === 'transaction'} onClick={findTransaction}>{busy === 'transaction' ? 'Searching…' : 'Find transaction'}</button></div>
      <Feedback result={transactionResult} />
      {transactionResult?.data && <div className="alert success span-all"><strong>Transaction details</strong><KV rows={display(transactionResult)} /></div>}
    </div>
    <p className="hint">Important: mock mode simulates this workflow. A successful mock response is not evidence of a real bank transfer. Do not retry an uncertain live transfer until you have checked its status.</p>
  </section>;
}
