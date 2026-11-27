import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { createCustomerSchema, type CreateCustomerInput } from '../lib/schemas';
import { api, type ApiResult } from '../lib/api';
import { Feedback, Field, KV } from '../components/ui';

export default function CreateCustomer() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const {
    register, handleSubmit, setError, reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCustomerInput>({ resolver: zodResolver(createCustomerSchema) });

  const onSubmit = async (values: CreateCustomerInput) => {
    setResult(null);
    const r = await api.createCustomer(values);
    setResult(r);
    if (r.ok) reset();
    // Map server-side field errors back onto the matching inputs.
    if (r.fieldErrors) {
      for (const [name, msgs] of Object.entries(r.fieldErrors)) {
        setError(name as keyof CreateCustomerInput, { message: msgs?.[0] });
      }
    }
  };

  return (
    <section>
      <h2>Create customer</h2>
      <p className="hint">Registers a customer. A default wallet is created automatically. Use synthetic test data only.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card grid">
        <Field label="First name *" error={errors.first_name?.message}><input {...register('first_name')} /></Field>
        <Field label="Middle name" error={errors.middle_name?.message}><input {...register('middle_name')} /></Field>
        <Field label="Last name *" error={errors.last_name?.message}><input {...register('last_name')} /></Field>
        <Field label="Email *" error={errors.email?.message}><input type="email" {...register('email')} /></Field>
        <Field label="Phone *" error={errors.phone_number?.message}><input placeholder="08000000000" {...register('phone_number')} /></Field>
        <Field label="Gender" error={errors.gender?.message}>
          <select {...register('gender')}>
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Date of birth" error={errors.date_of_birth?.message}><input placeholder="YYYY-MM-DD" {...register('date_of_birth')} /></Field>
        <Field label="BVN * (11 digits)" error={errors.bvn?.message}><input inputMode="numeric" autoComplete="off" {...register('bvn')} /></Field>
        <Field label="NIN (11 digits)" error={errors.nin?.message}><input inputMode="numeric" autoComplete="off" {...register('nin')} /></Field>
        <div className="actions">
          <button disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create customer'}</button>
        </div>
      </form>

      <Feedback result={result} />
      {result?.ok && result.data && (
        <div className="alert success">
          <strong>Customer created</strong>
          <KV rows={[
            ['Customer ID', <code>{result.data.customer_id}</code>],
            ['Wallet ID', <code>{result.data.wallet_id}</code>],
            ['Account number', <code>{result.data.account_number}</code>],
          ]} />
          <Link to={`/customers/find?id=${encodeURIComponent(result.data.customer_id)}`}>View this customer →</Link>
        </div>
      )}
    </section>
  );
}
