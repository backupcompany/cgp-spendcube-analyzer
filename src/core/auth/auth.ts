import { closeSpendDb } from '../db/db';

const SESSION_KEY = 'spendcube-user';

// tambah akun di sini
const USERS: { username: string; password: string }[] = [
  { username: 'cgp', password: 'cgp-lokal' },
  { username: 'finance', password: 'finance-lokal' },
];

export function currentUser(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function signIn(username: string, password: string): string | null {
  const name = username.trim().toLowerCase();
  const found = USERS.find((u) => u.username === name && u.password === password);
  if (!found) return null;
  sessionStorage.setItem(SESSION_KEY, found.username);
  return found.username;
}

export function signOut() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
  closeSpendDb();
  window.location.reload();
}
