/**
 * Login Page
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const [email, setEmail] = useState('manager@thammasat.ac.th');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  const demoUsers = [
    { label: 'Admin', email: 'admin@thammasat.ac.th' },
    { label: 'Manager', email: 'manager@thammasat.ac.th' },
    { label: 'Technician', email: 'tech1@thammasat.ac.th' },
    { label: 'Operator', email: 'operator1@thammasat.ac.th' },
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-background-tertiary)'
    }}>
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 16, padding: '32px 36px', width: 380,
      }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>CMMS Industrial</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Thammasat</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>Sign in to your account</div>
        </div>

        {error && (
          <div style={{
            background: '#FCEBEB', color: '#A32D2D', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, marginBottom: 16,
            border: '0.5px solid #F7C1C1'
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%', padding: '10px',
              background: '#185FA5', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>Demo accounts (password: password123)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {demoUsers.map(u => (
              <button
                key={u.email}
                onClick={() => setEmail(u.email)}
                style={{
                  fontSize: 11, padding: '3px 10px',
                  background: email === u.email ? '#E6F1FB' : 'var(--color-background-secondary)',
                  color: email === u.email ? '#185FA5' : 'var(--color-text-secondary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 6, cursor: 'pointer'
                }}
              >{u.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
