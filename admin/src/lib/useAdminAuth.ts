import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { ADMIN_EMAILS } from './adminAllowlist';

export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
  }, []);

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  return { user, authChecked, isAdmin };
}
