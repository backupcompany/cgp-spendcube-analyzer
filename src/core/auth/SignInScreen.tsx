import React, { useState } from 'react';
import { FileSpreadsheet, Layers, ShieldCheck } from 'lucide-react';
import { signIn } from './auth';

export function SignInScreen({ onSignedIn }: { onSignedIn: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = signIn(username, password);
    if (!user) {
      setError('Username atau password salah.');
      return;
    }
    onSignedIn(user);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl min-h-[36rem] bg-slate-900 rounded-[28px] border border-slate-800 overflow-hidden grid md:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={submit} className="flex flex-col justify-center px-8 py-10 sm:px-14 bg-slate-900">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-semibold tracking-[0.16em] text-blue-400">CGP ENTERPRISE</span>
          </div>
          <p className="mt-8 text-sm text-slate-400">Welcome to</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-100">SpendCube</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Data import tinggal di browser ini, terpisah per akun.
          </p>

          {error && (
            <p className="mt-6 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-xl px-3 py-2">{error}</p>
          )}

          <label className="block mt-8 text-xs font-medium text-slate-400">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-[#071326] text-sm text-slate-100 font-normal focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
            />
          </label>
          <label className="block mt-4 text-xs font-medium text-slate-400">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-[#071326] text-sm text-slate-100 font-normal focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
            />
          </label>
          <button
            type="submit"
            className="mt-6 w-full py-3 text-sm font-semibold tracking-wide bg-slate-800 text-slate-100 border border-slate-700 rounded-lg hover:bg-slate-700"
          >
            SIGN IN
          </button>
        </form>

        <aside className="relative hidden md:flex flex-col justify-center bg-[#071326] text-slate-300 pl-24 pr-10 py-12 overflow-hidden">
          <svg
            className="absolute inset-y-0 -left-px h-full w-28 text-slate-900"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,0 C70,18 70,82 0,100 L0,0 Z" fill="currentColor" />
          </svg>
          <div className="relative">
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-400">PROCUREMENT HUB</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-100">Data tetap di browser</h2>
            <ul className="mt-8 space-y-5 text-sm text-slate-300">
              <li className="flex gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <span>Login tidak menyalin data orang lain. Akun lain di komputer yang sama tetap terpisah.</span>
              </li>
              <li className="flex gap-3">
                <FileSpreadsheet className="w-5 h-5 shrink-0 mt-0.5" />
                <span>Setelah masuk, import Excel atau CSV lewat Quick Action.</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
