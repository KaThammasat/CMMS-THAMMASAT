import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, useAlertStore } from '../store';

const nav = [
  { path: '/dashboard', label: 'Dashboard', icon: '⬛', section: 'MAIN' },
  { path: '/equipment', label: 'Equipment', icon: '⚙', section: 'MAIN' },
  { path: '/work-orders', label: 'Work Orders', icon: '📋', section: 'MAIN' },
  { path: '/downtime', label: 'Downtime', icon: '⏱', section: 'OPERATIONS' },
  { path: '/loto', label: 'LOTO Safety', icon: '🔒', section: 'OPERATIONS' },
  { path: '/inventory', label: 'Inventory', icon: '📦', section: 'OPERATIONS' },
  { path: '/kpi', label: 'KPI Reports', icon: '📊', section: 'ANALYTICS' },
  { path: '/admin', label: 'Admin Settings', icon: '🛠', section: 'ADMIN' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useAlertStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const sections = [...new Set(nav.map(n => n.section))];

  const Sidebar = () => (
    <aside style={{
      width: 220, minWidth: 220, background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)', height: '100vh',
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 2 }}>CMMS</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>Thammasat</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Industrial v5.0</div>
      </div>

      {/* Site badge */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>TU-MAIN · Pathumthani</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {sections.map(section => (
          <div key={section} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', padding: '0 4px 6px', textTransform: 'uppercase' }}>{section}</div>
            {nav.filter(n => n.section === section).map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ marginBottom: 2, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, fontSize: 13, fontWeight: 500, color: location.pathname === item.path ? 'var(--accent)' : 'var(--text-secondary)', background: location.pathname === item.path ? 'rgba(59,130,246,.08)' : 'transparent', borderLeft: location.pathname === item.path ? '2px solid var(--accent)' : '2px solid transparent', paddingLeft: location.pathname === item.path ? 8 : 10, transition: 'all .15s' }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.path === '/work-orders' && unreadCount > 0 && (
                  <span style={{ marginLeft: 'auto', background: 'var(--danger)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.firstName} {user?.lastName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
        </div>
        <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, borderRadius: 4, fontSize: 14, cursor: 'pointer' }}>⏻</button>
      </div>
    </aside>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Mobile hamburger */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ display: 'none', position: 'fixed', top: 12, left: 12, zIndex: 1000, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 18 }}
        className="mobile-menu-btn">☰</button>

      {/* Sidebar - desktop always visible, mobile overlay */}
      <div className="sidebar-wrapper" style={{ display: 'flex' }}>
        <Sidebar />
      </div>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
        {/* Top bar */}
        <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>TU-MAIN</span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span>Pathumthani</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--success)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Live
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
              {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        <React.Suspense fallback={
          <div style={{ padding: 24 }}>
            {[...Array(3)].map((_,i) => (
              <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12, borderRadius: 10 }} />
            ))}
          </div>
        }>
          <Outlet />
        </React.Suspense>
      </main>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
        @media (max-width: 768px) {
          .sidebar-wrapper { position: fixed; left: ${sidebarOpen ? '0' : '-240px'}; top: 0; z-index: 999; height: 100vh; transition: left .25s; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
