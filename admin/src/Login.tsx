import { useState } from 'react';
import { supabase } from './lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
  }

  const input = 'w-full rounded-2xl border-2 border-sand bg-white px-4 py-3 text-lg outline-none focus:border-teal';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-[2rem] bg-white/70 p-6 shadow-[0_8px_0_rgba(232,81,42,0.18)]">
        <h1 className="font-display text-3xl font-bold text-tealdark">Marks Admin</h1>
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
        {msg && <p className="font-medium text-tangerine">{msg}</p>}
        <button disabled={busy} onClick={login}
          className="w-full rounded-full bg-tangerine py-3 text-lg font-semibold text-white disabled:opacity-50">
          {busy ? '...' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}