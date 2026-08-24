import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useAdminAuth } from './lib/useAdminAuth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Bookings from './pages/Bookings';
import Providers from './pages/Providers';
import Categories from './pages/Categories';
import SupportTickets from './pages/SupportTickets';
import type { Page } from './lib/types';

const PAGES: Record<Page, React.ComponentType> = {
  dashboard: Dashboard,
  users: Users,
  bookings: Bookings,
  providers: Providers,
  categories: Categories,
  supportTickets: SupportTickets,
};

export default function App() {
  const [active, setActive] = useState<Page>('dashboard');
  const { user, authChecked, isAdmin } = useAdminAuth();

  // Wait for the initial auth check before deciding what to render — otherwise
  // there's a flash of the login screen (or worse, the dashboard) before Firebase
  // has restored any existing session.
  if (!authChecked) {
    return <div className="page-loading">Loading…</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (!isAdmin) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            Labbe
            <span>Admin</span>
          </div>
          <div className="login-error">
            {user.email} is signed in but isn't on the admin list for this panel.
          </div>
          <button type="button" className="login-submit" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const ActivePage = PAGES[active];

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} onSignOut={() => signOut(auth)} />
      <main className="app-main">
        <ActivePage />
      </main>
    </div>
  );
}
