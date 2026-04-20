/**
 * Equipment Page - List + AI risk indicators
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipmentAPI } from '../utils/api';
import toast from 'react-hot-toast';

const TYPE_ICONS = { cnc:'⚙', pump:'💧', hvac:'❄', compressor:'💨', motor:'⚡', conveyor:'▶', generator:'⚡', boiler:'🔥', crane:'🏗', robot:'🤖' };
const CRIT_COLORS = { critical:'#E24B4A', high:'#EF9F27', medium:'#378ADD', low:'#639922' };
const CRIT_BG = { critical:'#FCEBEB', high:'#FAEEDA', medium:'#E6F1FB', low:'#EAF3DE' };

function HealthBar({ score }) {
  const color = score >= 80 ? '#639922' : score >= 60 ? '#EF9F27' : '#E24B4A';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 70, height: 4, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 500, color }}>{score}</span>
    </div>
  );
}

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCrit, setFilterCrit] = useState('');
  const [filterType, setFilterType] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, [filterCrit, filterType]);

  async function load() {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filterCrit) params.criticality = filterCrit;
      if (filterType) params.type = filterType;
      if (search) params.search = search;
      const res = await equipmentAPI.list(params);
      setEquipment(res.data?.data || []);
    } catch { toast.error('Failed to load equipment'); }
    finally { setLoading(false); }
  }

  const filtered = search
    ? equipment.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.asset_code.toLowerCase().includes(search.toLowerCase()))
    : equipment;

  const summary = {
    total: equipment.length,
    critical: equipment.filter(e => e.criticality === 'critical').length,
    lowHealth: equipment.filter(e => e.health_score < 60).length,
    activeDowntime: equipment.filter(e => parseInt(e.active_downtime) > 0).length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Equipment</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {summary.total} assets · {summary.critical} critical · {summary.lowHealth} health alerts
          </div>
        </div>
        <button
          onClick={() => navigate('/equipment/new')}
          style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
        >+ Add Equipment</button>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Total Assets', value: summary.total },
          { label: 'Critical Assets', value: summary.critical, color: '#A32D2D' },
          { label: 'Health Alerts', value: summary.lowHealth, color: '#854F0B' },
          { label: 'Active Downtime', value: summary.activeDowntime, color: '#A32D2D' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 8, padding: '10px 14px'
          }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: s.color || 'var(--color-text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="Search equipment..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          style={{ flex: 1, maxWidth: 280, fontSize: 13, padding: '6px 10px' }}
        />
        <select value={filterCrit} onChange={e => setFilterCrit(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">All Criticality</option>
          {['critical','high','medium','low'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">All Types</option>
          {['cnc','pump','hvac','compressor','motor','conveyor','generator'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Equipment grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map(eq => (
            <div
              key={eq.id}
              onClick={() => navigate(`/equipment/${eq.id}`)}
              style={{
                background: 'var(--color-background-primary)',
                border: `0.5px solid ${parseInt(eq.active_downtime) > 0 ? '#E24B4A' : 'var(--color-border-tertiary)'}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                transition: 'all 0.12s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: CRIT_BG[eq.criticality],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18
                  }}>{TYPE_ICONS[eq.type] || '⚙'}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{eq.name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{eq.asset_code}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 6,
                  background: CRIT_BG[eq.criticality],
                  color: CRIT_COLORS[eq.criticality],
                  fontWeight: 500, textTransform: 'capitalize'
                }}>{eq.criticality}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <HealthBar score={eq.health_score} />
                {parseInt(eq.active_downtime) > 0 && (
                  <span style={{ fontSize: 10, color: '#A32D2D', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E24B4A', animation: 'pulse 1s infinite' }} />
                    Down
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                <span>{eq.location_name}</span>
                {eq.open_wo_count > 0 && (
                  <span style={{ color: '#854F0B' }}>📋 {eq.open_wo_count} WO</span>
                )}
                {eq.risk_score && (
                  <span style={{ color: eq.risk_score >= 60 ? '#A32D2D' : eq.risk_score >= 30 ? '#854F0B' : '#3B6D11', marginLeft: 'auto' }}>
                    Risk: {Math.round(eq.risk_score)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
}
