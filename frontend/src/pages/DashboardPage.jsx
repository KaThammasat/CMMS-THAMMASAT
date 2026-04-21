import React, { useEffect, useState, useCallback } from 'react';
import { kpiAPI, equipmentAPI, workOrderAPI, alertsAPI } from '../utils/api';
import { Link } from 'react-router-dom';

const statusBadge = s => <span className={`badge badge-${s}`}>{s?.replace('_',' ')}</span>;
const priorityBadge = p => <span className={`badge badge-${p}`}>{p}</span>;
const healthColor = s => s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--danger)';

function StatCard({ label, value, sub, color = 'var(--text-primary)', icon }) {
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {icon && <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 22, opacity: .15 }}>{icon}</div>}
    </div>
  );
}

function Skeleton({ h = 20, w = '100%', mb = 8 }) {
  return <div className="skeleton" style={{ height: h, width: w, marginBottom: mb }} />;
}

export default function DashboardPage() {
  const [state, setState] = useState({ kpi: null, equipment: [], workOrders: [], alerts: [], loading: true, error: null });

  const load = useCallback(async () => {
    try {
      const [k, e, w, a] = await Promise.all([
        kpiAPI.summary(), equipmentAPI.list({ limit: 4 }),
        workOrderAPI.list({ limit: 5 }), alertsAPI.list({ limit: 5 }),
      ]);
      setState({ kpi: k.data?.data, equipment: e.data?.data || [], workOrders: w.data?.data || [], alerts: a.data?.data || [], loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const { kpi, equipment, workOrders, alerts, loading } = state;

  return (
    <div className="page">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-sub">Thammasat Industrial Plant · {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
        </div>
        <button onClick={load} className="btn btn-secondary" style={{ fontSize: 12 }}>↻ Refresh</button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 mb-6">
        {loading ? [...Array(4)].map((_,i) => <div key={i} className="card"><Skeleton h={14} mb={10} /><Skeleton h={32} mb={6} /><Skeleton h={12} w="60%" /></div>) : <>
          <StatCard label="OEE" value={kpi?.oee?.overall ? `${kpi.oee.overall}%` : '—'} sub={`Avail ${kpi?.oee?.availability}% · Perf ${kpi?.oee?.performance}%`} color="var(--success)" icon="📈" />
          <StatCard label="MTTR" value={kpi?.mttr?.hours ? `${kpi.mttr.hours}h` : '—'} sub={`${kpi?.mttr?.completedCount || 0} WOs completed`} color="var(--accent)" icon="⏱" />
          <StatCard label="MTBF" value={kpi?.mtbf?.hours ? `${kpi.mtbf.hours}h` : '—'} sub="Mean time between failures" color="var(--purple)" icon="⚡" />
          <StatCard label="Downtime Cost" value={kpi?.downtime?.totalCost ? `฿${Number(kpi.downtime.totalCost).toLocaleString()}` : '฿0'} sub={`${Math.round((kpi?.downtime?.totalMinutes||0)/60)}h total`} color="var(--danger)" icon="💰" />
        </>}
      </div>

      <div className="grid-2 mb-4">
        {/* Equipment Health */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <span className="section-title">Equipment Health</span>
            <Link to="/equipment" style={{ fontSize: 12, color: 'var(--accent)' }}>View all →</Link>
          </div>
          {loading ? [...Array(4)].map((_,i) => <div key={i} style={{ marginBottom: 14 }}><Skeleton h={12} mb={6} /><Skeleton h={6} /></div>) :
            equipment.map(eq => (
              <Link key={eq.id} to={`/equipment/${eq.id}`} style={{ display: 'block', marginBottom: 14, textDecoration: 'none' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{eq.asset_code}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: healthColor(eq.health_score) }}>{eq.health_score}%</span>
                </div>
                <div className="health-bar">
                  <div className="health-bar-fill" style={{ width: `${eq.health_score}%`, background: healthColor(eq.health_score) }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{eq.name} · <span style={{ textTransform: 'capitalize' }}>{eq.criticality}</span></div>
              </Link>
            ))}
        </div>

        {/* Active Work Orders */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <span className="section-title">Active Work Orders</span>
            <Link to="/work-orders" style={{ fontSize: 12, color: 'var(--accent)' }}>View all →</Link>
          </div>
          {loading ? <Skeleton h={120} /> :
            workOrders.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>No active work orders</p> : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead><tr>
                  <th>WO #</th><th>Equipment</th><th>Status</th><th>Priority</th>
                </tr></thead>
                <tbody>
                  {workOrders.map(wo => (
                    <tr key={wo.id} style={{ cursor: 'pointer' }} onClick={() => {}}>
                      <td><Link to={`/work-orders/${wo.id}`} className="mono" style={{ color: 'var(--accent)' }}>{wo.wo_number}</Link></td>
                      <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wo.equipment_name || wo.asset_code}</td>
                      <td>{statusBadge(wo.status)}</td>
                      <td>{priorityBadge(wo.priority)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <span className="section-title">🔔 Recent Alerts</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{alerts.filter(a => !a.is_read).length} unread</span>
        </div>
        {loading ? [...Array(3)].map((_,i) => <div key={i} className="flex gap-2 mb-3"><Skeleton h={20} w={80} /><div style={{flex:1}}><Skeleton h={14} mb={4}/><Skeleton h={12} w="70%"/></div></div>) :
          alerts.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>No alerts</p> :
          alerts.map(al => (
            <div key={al.id} className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span className={`badge badge-${al.severity}`}>{al.severity}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: al.is_read ? 'var(--text-muted)' : 'var(--text-primary)' }}>{al.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{al.message?.slice(0, 90)}</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(al.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
