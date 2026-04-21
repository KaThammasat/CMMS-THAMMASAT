import React, { useEffect, useState, useCallback } from 'react';
import { kpiAPI } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.fill || p.color }}>{p.name}: {p.value}{p.unit || '%'}</p>)}
    </div>
  );
};

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function KPIPage() {
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(Date.now() - range * 86400000).toISOString();
      const r = await kpiAPI.summary({ from });
      setKpi(r.data?.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const oeeData = kpi?.oee ? [
    { name: 'Availability', value: kpi.oee.availability, fill: '#3b82f6' },
    { name: 'Performance', value: kpi.oee.performance, fill: '#10b981' },
    { name: 'Quality', value: kpi.oee.quality, fill: '#8b5cf6' },
    { name: 'OEE', value: kpi.oee.overall, fill: '#f59e0b' },
  ] : [];

  const availData = kpi?.equipmentAvailability?.map(e => ({
    name: e.asset_code, value: Math.min(100, Math.max(0, parseFloat(e.availability_pct) || 0))
  })) || [];

  return (
    <div className="page">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📊 KPI Dashboard</h1>
          <p className="page-sub">Key Performance Indicators · MTTR · MTBF · OEE</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setRange(d)} className={`btn btn-${range===d?'primary':'secondary'}`} style={{ fontSize: 12, padding: '6px 12px' }}>{d}d</button>
          ))}
        </div>
      </div>

      <div className="grid-4 mb-6">
        {loading ? [...Array(4)].map((_,i) => <div key={i} className="card"><div className="skeleton" style={{height:14,marginBottom:10}} /><div className="skeleton" style={{height:32}} /></div>) : <>
          <StatCard label="OEE" value={kpi?.oee?.overall ? `${kpi.oee.overall}%` : '—'} sub="Overall Equipment Effectiveness" color="var(--success)" />
          <StatCard label="MTTR" value={kpi?.mttr?.hours ? `${kpi.mttr.hours}h` : '—'} sub={`${kpi?.mttr?.completedCount || 0} corrective WOs`} color="var(--accent)" />
          <StatCard label="MTBF" value={kpi?.mtbf?.hours ? `${kpi.mtbf.hours}h` : '—'} sub={`${kpi?.mtbf?.failureCount || 0} failure intervals`} color="var(--purple)" />
          <StatCard label="Downtime Cost" value={kpi?.downtime?.totalCost ? `฿${Number(kpi.downtime.totalCost).toLocaleString()}` : '฿0'} sub={`${Math.round((kpi?.downtime?.totalMinutes||0)/60)}h total`} color="var(--danger)" />
        </>}
      </div>

      <div className="grid-2 mb-4">
        <div className="card">
          <div className="section-title">OEE Components</div>
          {loading ? <div className="skeleton" style={{height:220}} /> :
            oeeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={oeeData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[6,6,0,0]} name="Value">
                    {oeeData.map((e,i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted" style={{fontSize:13}}>No OEE data</p>
          }
        </div>

        <div className="card">
          <div className="section-title">Equipment Availability</div>
          {loading ? <div className="skeleton" style={{height:220}} /> :
            availData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={availData} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" domain={[0,100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} width={72} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="var(--accent)" radius={[0,6,6,0]} name="Availability" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted" style={{fontSize:13}}>No availability data</p>
          }
        </div>
      </div>

      {kpi && (
        <div className="card">
          <div className="section-title">Work Order Summary</div>
          <div className="grid-4">
            {[
              { label: 'Total WOs', value: kpi.workOrders?.total || 0 },
              { label: 'Open', value: kpi.workOrders?.open_count || 0, color: 'var(--accent)' },
              { label: 'Completed', value: kpi.workOrders?.completed_count || 0, color: 'var(--success)' },
              { label: 'SLA Breached', value: kpi.workOrders?.sla_breached_count || 0, color: 'var(--danger)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-base)', borderRadius: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
