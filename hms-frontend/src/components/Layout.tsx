import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';

export function Layout() {
  const { staffUser, tenantSlug, logout } = useAuth();
  const { isOnline, pendingCount, conflictCount } = useOfflineQueue();

  return (
    <div className="app-shell">
      <aside
        style={{
          background: 'var(--baraka-dark)',
          color: 'var(--paper-raised)',
          padding: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="eyebrow" style={{ color: 'var(--marigold)' }}>
            {tenantSlug}
          </div>
          <h3 style={{ color: 'var(--paper-raised)', marginTop: 'var(--space-1)' }}>Staff Console</h3>
        </div>

        <ConnectivityBadge isOnline={isOnline} pendingCount={pendingCount} conflictCount={conflictCount} />

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
          <SidebarLink to="/patients">Patients</SidebarLink>
          <SidebarLink to="/appointments/new">New appointment</SidebarLink>
          <SidebarLink to="/pharmacy">Pharmacy</SidebarLink>
          <SidebarLink to="/payers">Payers</SidebarLink>
          <SidebarLink to="/inbox">Inbox</SidebarLink>
          <SidebarLink to="/staff-shifts">Staff shifts</SidebarLink>
          {staffUser?.role === 'admin' && <SidebarLink to="/integrations">Integrations</SidebarLink>}
          {(pendingCount > 0 || conflictCount > 0) && (
            <SidebarLink to="/sync-queue">
              Sync queue {conflictCount > 0 ? `(${conflictCount} need attention)` : `(${pendingCount})`}
            </SidebarLink>
          )}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)' }}>
          <div style={{ fontSize: 'var(--text-sm)', opacity: 0.85 }}>
            {staffUser?.firstName} {staffUser?.lastName}
          </div>
          <div className="mono" style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
            {staffUser?.staffNumber}
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{ marginTop: 'var(--space-3)', borderColor: 'rgba(255,255,255,0.3)', color: 'var(--paper-raised)' }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="main-column">
        <Outlet />
      </div>
    </div>
  );
}

function ConnectivityBadge({ isOnline, pendingCount, conflictCount }: { isOnline: boolean; pendingCount: number; conflictCount: number }) {
  const color = !isOnline ? 'var(--marigold)' : conflictCount > 0 ? 'var(--brick)' : 'var(--stamp-ink)';
  const label = !isOnline
    ? 'Offline — changes will sync when reconnected'
    : conflictCount > 0
      ? `${conflictCount} item${conflictCount > 1 ? 's' : ''} need attention`
      : pendingCount > 0
        ? `Syncing ${pendingCount} item${pendingCount > 1 ? 's' : ''}…`
        : 'Online';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: 'var(--text-xs)',
        color: 'var(--paper-raised)',
        opacity: 0.9,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}

function SidebarLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        color: isActive ? 'var(--marigold)' : 'var(--paper-raised)',
        textDecoration: 'none',
        fontSize: 'var(--text-sm)',
        fontWeight: isActive ? 600 : 400,
        padding: '6px 0',
      })}
    >
      {children}
    </NavLink>
  );
}
