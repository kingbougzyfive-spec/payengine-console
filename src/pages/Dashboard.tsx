import { Link } from 'react-router-dom';

const cards = [
  { to: '/customers/new', title: 'Create customer', text: 'Onboard a customer and get a default wallet.' },
  { to: '/customers/find', title: 'Find customer', text: 'Look up a profile and its wallets by customer ID.' },
  { to: '/bank-lookup', title: 'Bank lookup', text: 'List banks and verify a recipient account name.' },
  { to: '/transfer', title: 'Bank transfer', text: 'Initiate, authorise, verify and inspect a sandbox transfer.' },
];

export default function Dashboard() {
  return (
    <section>
      <h2>Overview</h2>
      <p className="hint">A small console over the PayEngine sandbox API. All calls go through this app's own server.</p>
      <div className="cards">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card link">
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </Link>
        ))}
      </div>
      <div className="card">
        <h3>Integration notes</h3>
        <p>Transfer endpoints are wired into the sandbox/mock workflow. Confirm the provider authentication method and transfer payload shape before live testing. The webhook route intentionally remains disabled until signature verification and durable event storage are available.</p>
      </div>
    </section>
  );
}
