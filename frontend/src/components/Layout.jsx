/**
 * Layout - Sidebar + Topbar shell
 */
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useAlertStore } from '../store';

const navItems = [
  { path: '/dashboard',   label: 'Dashboard',    icon: '⬛', section: 'Main' },
  { path: '/equipment',   label: 'Equipment',     icon: '⚙',  section: 'Main' },
  { path: '/work-orders', label: 'Work Orders',   icon: '📋', section: 'Main' },
  { path: '/downtime',    label: 'Downtime',      icon: '🔴', section: 'Operations' },
  { path: '/loto',        label: 'LOTO Safety',   icon: '🔐', section: 'Operations' },
  { path: '/inventory',   label: 'Inventory',     icon: '📦', section: 'Operations' },
  { path: '/kpi',         label: 'KPI Reports',   icon: '📊', section: 'Analytics' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useAlertStore();
  const navigate = useNavigate();
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const sections = [...new Set(navItems.map(n => n.section))];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-background-tertiary)' }}>

      {/* Sidebar */}
      <aside style={{
        width: 210, flexShrink: 0,
        background: 'var(--color-background-primary)',
        borderRight: '0.5px solid var(--color-border-tertiary)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' }}>CMMS</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Thammasat</div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>Industrial v5.0</div>
        </div>

        {/* Nav */}
        {sections.map(section => (
          <div key={section} style={{ padding: '6px 0' }}>
            <div style={{
              fontSize: 10, fontFamily: 'monospace',
              letterSpacing: 1.5, color: 'var(--color-text-tertiary)',
              padding: '8px 16px 4px', textTransform: 'uppercase'
            }}>{section}</div>
            {navItems.filter(n => n.section === section).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 16px', textDecoration: 'none',
                  fontSize: 13, borderLeft: '2px solid',
                  borderLeftColor: isActive ? '#185FA5' : 'transparent',
                  background: isActive ? '#E6F1FB' : 'transparent',
                  color: isActive ? '#185FA5' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                  transition: 'all 0.12s'
                })}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.label === 'Work Orders' && unreadCount > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: '#E24B4A', color: '#fff',
                    fontSize: 10, padding: '1px 5px', borderRadius: 8, fontWeight: 600
                  }}>{unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}

        {/* User footer */}
        <div style={{
          marginTop: 'auto', padding: '12px 14px',
          borderTop: '0.5px solid var(--color-border-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: '#185FA5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0
            }}>
              {user ? `${user.first_name?.[0]}${user.last_name?.[0]}` : '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user ? `${user.first_name} ${user.last_name}` : 'Loading...'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </div>
            <button
              onClick={() => logout().then(() => navigate('/login'))}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, color: 'var(--color-text-tertiary)', padding: 4
              }}
              title="Logout"
            >⬡</button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{
          height: 44, flexShrink: 0,
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 10, fontFamily: 'monospace',
              padding: '2px 8px',
              background: 'var(--color-background-secondary)',
              borderRadius: 4, color: 'var(--color-text-secondary)'
            }}>TU-MAIN · Pathumthani</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: '#639922',
                animation: 'pulse 1.5s infinite'
              }} />
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#3B6D11' }}>Live</span>
            </div>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>
              {now.toLocaleTimeString('th-TH')}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <Outlet />
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .spinner { width:24px;height:24px;border:2px solid var(--color-border-tertiary);
          border-top-color:#185FA5;border-radius:50%;animation:spin .7s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        a { transition: all 0.12s; }
        a:hover { background: var(--color-background-secondary) !important; }
      `}</style>
    </div>
  );
}
