/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import SpendCubePage from './pages/SpendCubePage';
import { ErrorBoundary } from './core/ui/ErrorBoundary';
import { currentUser, signOut } from './core/auth/auth';
import { SignInScreen } from './core/auth/SignInScreen';
import { bindSpendDbUser } from './core/db/db';

export default function App() {
  const [user, setUser] = useState<string | null>(() => {
    const existing = currentUser();
    if (existing) bindSpendDbUser(existing);
    return existing;
  });

  if (!user) {
    return (
      <ErrorBoundary>
        <SignInScreen
          onSignedIn={(username) => {
            bindSpendDbUser(username);
            setUser(username);
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SpendCubePage key={user} username={user} onSignOut={signOut} />
    </ErrorBoundary>
  );
}
