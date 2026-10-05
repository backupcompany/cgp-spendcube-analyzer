import React, { useState } from 'react';
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-blue-600">CGP ENTERPRISE</p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">SpendCube</h1>
          <p className="text-xs text-slate-500 mt-1">
            Data import tinggal di browser ini, terpisah per akun. Login tidak menyalin data orang lain.
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}
        <label className="block text-xs font-semibold text-slate-700">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </label>
        <button
          type="submit"
          className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
