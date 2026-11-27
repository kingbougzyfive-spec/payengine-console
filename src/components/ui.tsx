import type { ApiResult } from '../lib/api';

/** Shared success/error display. Shows request_id so a failure can be reported to support. */
export function Feedback({ result }: { result: ApiResult | null }) {
  if (!result || result.ok) return null;
  return (
    <div className="alert error" role="alert">
      <strong>{result.message}</strong>
      <div className="meta">
        {result.code && <span>Code: {result.code}</span>}
        {result.requestId && <span>Request ID: {result.requestId}</span>}
      </div>
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="err">{error}</small>}
    </label>
  );
}

export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v ?? '-'}</dd></div>
      ))}
    </dl>
  );
}
