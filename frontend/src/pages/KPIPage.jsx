import React, { useEffect, useState } from 'react';
import { kpiAPI } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const S = {
  page: { padding: 24, background: '#0f172a', minHeight: '100%', color: '#f1f5f9' },
  card: { background: '#1e293b', borderRadius: 8, padding: 20, border: '1px solid #334155' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 },
  val: { fontSize: 28, fontWeight: 700 },
  sub: { fontSize: 12, color: '#64748b', marginTop: 4 },
};

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function KPIPage() {
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kpiAPI.summary().then(r => setKpi(r.data?.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={S.page}><p style={{ color: '#64748b' }}>Loading KPI data...</p></div>;

  const oeeData = kpi?.oee ? [
    { name: 'Availability', value: kpi.oee.availability, fill: '#3b82f6' },
    { name: 'Performance', value: kpi.oee.performance, fill: '#22c55e' },
    { name: 'Quality', value: kpi.oee.quality, fill: '#8b5cf6' },
    { name: 'OEE', value: kpi.oee.overall, fill: '#f59e0b' },
  ] : [];

  const downtimeByEquipment = kpi?.downtime?.byEquipment || [];

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>📊 KPI Dashboard</h1>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Key Performance Indicators · MTTR · MTBF · OEE</p>

      {/* KPI Cards */}
      <div style={S.grid4}>
        {[
          { label: 'OEE', value: kpi?.oee?.overall ? `${kpi.oee.overall}%` : '--', color: '#22c55e', sub: 'Overall Equipment Effectiveness' },
          { label: 'MTTR', value: kpi?.mttr?.hours ? `${kpi.mttr.hours}h` : '--', color: '#3b82f6', sub: `${kpi?.mttr?.completedCount || 0} WOs completed` },
          { label: 'MTBF', value: kpi?.mtbf?.hours ? `${kpi.mtbf.hours}h` : '--', color: '#8b5cf6', sub: `${kpi?.mtbf?.intervals || 0} failure intervals` },
          { label: 'Downtime Cost', value: kpi?.downtime?.totalCost ? `฿${Number(kpi.downtime.totalCost).toLocaleString()}` : '฿0', color: '#ef4444', sub: `${Math.round((kpi?.downtime?.totalMinutes || 0) / 60)}h total downtime` },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={S.card}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>{label}</div>
            <div style={{ ...S.val, color }}>{value}</div>
            <div style={S.sub}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={S.grid2}>
        {/* OEE Breakdown Bar Chart */}
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>OEE Components</h3>
          {oeeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={oeeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }} labelStyle={{ color: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {oeeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: '#64748b', fontSize: 13 }}>No OEE data available</p>}
        </div>

        {/* Equipment Availability */}
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Equipment Availability</h3>
          {kpi?.equipmentAvailability?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kpi.equipmentAvailability} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
                <YAxis type="category" dataKey="asset_code" tick={{ fill: '#94a3b8', fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }} />
                <Bar dataKey="availability_pct" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Availability" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: '#64748b', fontSize: 13 }}>No availability data</p>}
        </div>
      </div>

      {/* Downtime Summary */}
      {kpi?.downtime && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Downtime Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { label: 'Total Events', value: kpi.downtime.totalEvents || 0 },
              { label: 'Breakdowns', value: kpi.downtime.breakdowns || 0 },
              { label: 'Total Minutes', value: Math.round(kpi.downtime.totalMinutes || 0) },
              { label: 'Avg Duration', value: kpi.downtime.avgDuration ? `${Math.round(kpi.downtime.avgDuration)}min` : '-' },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center', padding: '12px', background: '#0f172a', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
