import type { Page } from '../lib/types';

const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'providers', label: 'Providers' },
  { key: 'categories', label: 'Categories' },
  { key: 'supportTickets', label: 'Support Tickets' },
];

interface SidebarProps {
  active: Page;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
}

export default function Sidebar({ active, onNavigate, onSignOut }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        Labbe
        <span>Admin</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-link${active === item.key ? ' active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <button type="button" className="sidebar-signout" onClick={onSignOut}>
        Sign Out
      </button>
    </aside>
  );
}
