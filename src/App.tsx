import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './lib/api';
import Dashboard from './pages/Dashboard';
import CreateCustomer from './pages/CreateCustomer';
import FindCustomer from './pages/FindCustomer';
import BankLookup from './pages/BankLookup';
import Transfer from './pages/Transfer';

interface Health { mock: boolean; authMode: string }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => { api.health().then(setHealth); }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1>PayEngine<span>Console</span></h1>
        <nav>
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/customers/new">Create customer</NavLink>
          <NavLink to="/customers/find">Find customer</NavLink>
          <NavLink to="/transfer">Bank transfer</NavLink>
          <NavLink to="/bank-lookup">Bank lookup</NavLink>
        </nav>
      </aside>
      <main>
        {health && (
          <div className={`banner ${health.mock ? 'mock' : 'live'}`}>
            {health.mock
              ? 'MOCK MODE: no API key configured. Responses are simulated, not from PayEngine.'
              : `SANDBOX: connected to PayEngine sandbox (auth: ${health.authMode}). Use test data only.`}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers/new" element={<CreateCustomer />} />
          <Route path="/customers/find" element={<FindCustomer />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/bank-lookup" element={<BankLookup />} />
        </Routes>
      </main>
    </div>
  );
}
