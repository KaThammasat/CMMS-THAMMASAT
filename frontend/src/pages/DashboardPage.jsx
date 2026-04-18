// DashboardPage.jsx - redirects to the interactive widget shown in chat
import React from 'react';
export default function DashboardPage() {
  return <div style={{ color: 'var(--color-text-primary)', padding: 20 }}>
    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Dashboard</h2>
    <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
      Real-time CMMS dashboard — connect backend API for live data.
    </p>
  </div>;
}
