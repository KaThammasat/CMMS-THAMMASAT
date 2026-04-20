import React, { useEffect, useState } from 'react';
import { kpiAPI, equipmentAPI, workOrderAPI, alertsAPI } from '../utils/api';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [kpi, setKpi] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      kpiAPI.summary(),
      equipmentAPI.list({ limit: 4 }),
      workOrderAPI.list({ limit: 5, status: 'in_progress,open,assigned' }),
      alertsAPI.list({ limit: 5, unread: true }),
    ]).then(([k, e, w, a]) => {
      setKpi(k.data?.data);
      setEquipment(e.data?.data || []);
      setWorkOrders(w.data?.data || []);
      setAlerts(a.data?.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const S = {
    page: { padding: '24px', background: '#0f172a', minHeight: '100%', color: '#f1f5f9' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 },
    card: { background: '#1e293b', borderRadius: 8, padding: 20, border: '1px solid #334155' },
    h2: { fontSize: 14, color: '#94a3b8', marginBottom: 4, fontWeight: 500 },
    val: { fontSize: 28, fontWeight: 700, color: '#f1f5f9' },
    sub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    tbl: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', fontSize: 11, color: '#64748b', padding: '8px 0', borderBottom: '1px solid #334155', fontWeight: 500, textTransform: 'uppercase' },
    td: { padding: '10px 0', fontSize: 13, borderBottom: '1px solid #1e293b', color: '#cbd5e1' },
    badge: (c) => ({ background: c, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#fff', display: 'inline-block' }),
    sectionTitle: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 12 },
    link: { color: '#38bdf8', textDecoration: 'none', fontSize: 12 },
  };

  const statusColor = {open:'#3b82f6',in_progress:'#f59e0b',assigned:'#8b5cf6',completed:'#22c55e',critical:'#ef4444',high:'#f97316',medium:'#eab308',low:'#22c55e'};

  if (loading) return <div style={{...S.page, display:'flex', alignItems:'center', justifyContent:'center'}}><span style={{color:'#64748b'}}>Loading dashboard...</span></div>;

  return (
    <div style={S.page}>
      <div style={{marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'#f1f5f9',margin:0}}>🏭 Operations Dashboard</h1>
          <p style={{fontSize:12,color:'#64748b',marginTop:4}}>Thammasat Industrial Plant · Live data</p>
        </div>
        <span style={{fontSize:12,color:'#64748b'}}>{new Date().toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}</span>
      </div>

      {/* KPI Cards */}
      <div style={S.grid}>
        {[
          { label: 'OEE', value: kpi?.oee?.overall ? `${kpi.oee.overall}%` : '--', sub: `Avail ${kpi?.oee?.availability}% · Perf ${kpi?.oee?.performance}%`, color: '#22c55e' },
          { label: 'MTTR', value: kpi?.mttr?.hours ? `${kpi.mttr.hours}h` : '--', sub: `${kpi?.mttr?.completedCount || 0} WOs completed`, color: '#3b82f6' },
          { label: 'MTBF', value: kpi?.mtbf?.hours ? `${kpi.mtbf.hours}h` : '--', sub: 'Mean time between failures', color: '#8b5cf6' },
          { label: 'Downtime Cost', value: kpi?.downtime?.totalCost ? `฿${Number(kpi.downtime.totalCost).toLocaleString()}` : '฿0', sub: `${kpi?.downtime?.totalMinutes || 0} min total`, color: '#ef4444' },
        ].map(({label,value,sub,color}) => (
          <div key={label} style={S.card}>
            <div style={S.h2}>{label}</div>
            <div style={{...S.val, color}}>{value}</div>
            <div style={S.sub}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={S.row}>
        {/* Equipment Health */}
        <div style={S.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={S.sectionTitle}>Equipment Health</span>
            <Link to="/equipment" style={S.link}>View all →</Link>
          </div>
          {equipment.map(eq => (
            <div key={eq.id} style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:13,fontWeight:500}}>{eq.asset_code}</span>
                <span style={{fontSize:13,color: eq.health_score < 75 ? '#ef4444' : eq.health_score < 85 ? '#f59e0b' : '#22c55e', fontWeight:600}}>{eq.health_score}%</span>
              </div>
              <div style={{height:6,background:'#334155',borderRadius:3}}>
                <div style={{height:'100%',width:`${eq.health_score}%`,background: eq.health_score < 75 ? '#ef4444' : eq.health_score < 85 ? '#f59e0b' : '#22c55e',borderRadius:3}}/>
              </div>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{eq.name} · {eq.criticality}</div>
            </div>
          ))}
        </div>

        {/* Active Work Orders */}
        <div style={S.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={S.sectionTitle}>Active Work Orders</span>
            <Link to="/work-orders" style={S.link}>View all →</Link>
          </div>
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>WO#</th><th style={S.th}>Equipment</th><th style={S.th}>Status</th><th style={S.th}>Priority</th>
            </tr></thead>
            <tbody>
              {workOrders.length === 0 && <tr><td colSpan={4} style={{...S.td,color:'#64748b',textAlign:'center'}}>No active work orders</td></tr>}
              {workOrders.map(wo => (
                <tr key={wo.id}>
                  <td style={S.td}><span style={{fontFamily:'monospace',fontSize:12}}>{wo.wo_number}</span></td>
                  <td style={S.td}>{wo.equipment_name?.slice(0,12)}</td>
                  <td style={S.td}><span style={S.badge(statusColor[wo.status]||'#64748b')}>{wo.status?.replace('_',' ')}</span></td>
                  <td style={S.td}><span style={S.badge(statusColor[wo.priority]||'#64748b')}>{wo.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Alerts */}
      <div style={{...S.card, marginTop:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <span style={S.sectionTitle}>🔔 Recent Alerts</span>
          <span style={{fontSize:12,color:'#64748b'}}>{alerts.length} unread</span>
        </div>
        {alerts.length === 0 && <p style={{color:'#64748b',fontSize:13}}>No unread alerts</p>}
        {alerts.map(al => (
          <div key={al.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid #334155'}}>
            <span style={{...S.badge(statusColor[al.severity]||'#64748b'), minWidth:60, textAlign:'center'}}>{al.severity}</span>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>{al.title}</div>
              <div style={{fontSize:11,color:'#64748b'}}>{al.message?.slice(0,80)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
