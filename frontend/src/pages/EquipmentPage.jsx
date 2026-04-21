import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { equipmentAPI } from '../utils/api';

const critColor = { critical: 'var(--danger)', high: 'var(--orange)', medium: 'var(--warning)', low: 'var(--success)' };
const healthColor = s => s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--danger)';

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [crit, setCrit] = useState('');
  const [type, setType] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await equipmentAPI.list({ search: search||undefined, criticality: crit||undefined, type: type||undefined });
      setEquipment(r.data?.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, crit, type]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const stats = { total: equipment.length, critical: equipment.filter(e => e.criticality === 'critical').length, alerts: equipment.filter(e => e.health_score < 70).length, downtime: equipment.filter(e => e.active_downtime > 0).length };

  return (
    <div className="page">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-sub">{stats.total} assets · {stats.critical} critical · {stats.alerts} health alerts</p>
        </div>
        <button className="btn btn-primary" onClick={() => {}}>+ Add Equipment</button>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-6">
        {[
          { label: 'Total Assets', value: stats.total },
          { label: 'Critical Assets', value: stats.critical, color: 'var(--danger)' },
          { label: 'Health Alerts', value: stats.alerts, color: stats.alerts > 0 ? 'var(--warning)' : 'var(--success)' },
          { label: 'Active Downtime', value: stats.downtime, color: stats.downtime > 0 ? 'var(--danger)' : 'var(--success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment..."
          style={{ flex: 1, minWidth: 200, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13 }} />
        {[['', 'All Criticality'], ['critical','Critical'], ['high','High'], ['medium','Medium'], ['low','Low']].map(([v, l]) => (
          <button key={v} onClick={() => setCrit(v)} className={`btn btn-${crit===v ? 'primary' : 'secondary'}`} style={{ fontSize: 12, padding: '6px 12px' }}>{l}</button>
        ))}
      </div>

      {/* Equipment Grid */}
      {loading ? (
        <div className="grid-2">
          {[...Array(4)].map((_,i) => <div key={i} className="card"><div className="skeleton" style={{height:120}} /></div>)}
        </div>
      ) : equipment.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="text-muted">No equipment found</p></div>
      ) : (
        <div className="grid-2">
          {equipment.map(eq => (
            <Link key={eq.id} to={`/equipment/${eq.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'border-color .15s, transform .15s', border: `1px solid ${eq.criticality === 'critical' ? 'rgba(239,68,68,.3)' : 'var(--border)'}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = eq.criticality === 'critical' ? 'rgba(239,68,68,.3)' : 'var(--border)'; e.currentTarget.style.transform = ''; }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 18 }}>{eq.type === 'pump' ? '💧' : eq.type === 'cnc' ? '⚙' : '🔧'}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{eq.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{eq.asset_code}</div>
                    </div>
                  </div>
                  <span className={`badge badge-${eq.criticality}`}>{eq.criticality}</span>
                </div>

                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Health Score</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: healthColor(eq.health_score) }}>{eq.health_score}%</span>
                </div>
                <div className="health-bar" style={{ marginBottom: 12 }}>
                  <div className="health-bar-fill" style={{ width: `${eq.health_score}%`, background: healthColor(eq.health_score) }} />
                </div>

                <div className="flex justify-between">
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {eq.location_name || eq.location_code}
                  </div>
                  <div className="flex gap-2">
                    {eq.open_wo_count > 0 && <span style={{ fontSize: 11, color: 'var(--accent)' }}>📋 {eq.open_wo_count} WO</span>}
                    {eq.active_downtime > 0 && <span style={{ fontSize: 11, color: 'var(--danger)' }}>● Down</span>}
                    {eq.risk_score && <span style={{ fontSize: 11, color: 'var(--warning)' }}>Risk: {Math.round(eq.risk_score)}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
