/**
 * KPI Reports Page
 * MTTR, MTBF, OEE, Downtime Cost, Trends
 */
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { kpiAPI } from '../utils/api';
import { format } from 'date-fns';

const COLORS = {
  breakdown: '#E24B4A', planned: '#378ADD',
  mechanical: '#E24B4A', electrical: '#EF9F27',
  hydraulic: '#378ADD', operator: '#639922', software: '#7F77DD'
};

function KPICard({ label, value, unit, sub, color, target, pct }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 12, padding: '14px 16px'
    }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color || 'var(--color-text-primary)', lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, fontWeight: 400, marginLeft: 2 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>{sub}</div>}
      {pct !== undefined && (
        <div style={{ marginTop: 8, height: 3, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color || '#185FA5', borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

export default function KPIPage() {
  const [kpi, setKpi] = useState(null);
  const [trend, setTrend] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    loadData();
  }, [range]);

  async function loadData() {
    setLoading(true);
    try {
      const from = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
      const [kpiRes, trendRes, catRes] = await Promise.all([
        kpiAPI.summary({ from }),
        kpiAPI.downtimeTrend(range),
        kpiAPI.failureByCategory()
      ]);
      setKpi(kpiRes.data);
      setTrend(trendRes.data.map(d => ({
        ...d,
        date: format(new Date(d.date), 'MM/dd'),
        downtime_hours: Math.round((d.downtime_minutes || 0) / 60 * 10) / 10,
        cost: Math.round(d.cost || 0)
      })));
      setCategories(catRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading KPIs...</div>;

  const oee = kpi?.oee || {};
  const downtime = kpi?.downtime || {};
  const mttr = kpi?.mttr || {};
  const mtbf = kpi?.mtbf || {};
  const wo = kpi?.workOrders || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>KPI Reports</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Maintenance performance indicators
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              style={{
                padding: '5px 12px', fontSize: 12, borderRadius: 6,
                border: '0.5px solid var(--color-border-secondary)',
                background: range === d ? '#185FA5' : 'transparent',
                color: range === d ? '#fff' : 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >{d}d</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard
          label="OEE" value={oee.overall?.toFixed(1)} unit="%"
          sub={`Target: 85% | A:${oee.availability?.toFixed(1)} P:${oee.performance} Q:${oee.quality}`}
          color="#185FA5" pct={oee.overall}
        />
        <KPICard
          label="MTTR" value={mttr.hours?.toFixed(1)} unit="hr"
          sub={`${mttr.completedCount} repairs · Target < 4hr`}
          color={mttr.hours > 4 ? '#E24B4A' : '#3B6D11'}
          pct={mttr.hours > 0 ? Math.min(100, (4 / mttr.hours) * 100) : 0}
        />
        <KPICard
          label="MTBF" value={Math.round(mtbf.hours || 0)} unit="hr"
          sub={`${mtbf.failureCount} failures · Target > 200hr`}
          color={mtbf.hours < 200 ? '#E24B4A' : '#3B6D11'}
          pct={Math.min(100, ((mtbf.hours || 0) / 300) * 100)}
        />
        <KPICard
          label="Downtime Cost" value={`฿${((downtime.totalCost || 0) / 1000).toFixed(1)}k`}
          unit="" sub={`${downtime.totalIncidents} incidents · ${Math.round((downtime.totalMinutes || 0) / 60)}hr total`}
          color="#A32D2D"
        />
      </div>

      {/* Work Order summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { label: 'Total WOs', value: wo.total },
          { label: 'Open', value: wo.open_count, color: '#854F0B' },
          { label: 'In Progress', value: wo.in_progress_count, color: '#185FA5' },
          { label: 'Completed', value: wo.completed_count, color: '#3B6D11' },
          { label: 'SLA Breached', value: wo.sla_breached_count, color: '#A32D2D' },
        ].map(item => (
          <div key={item.label} style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 8, padding: '10px 14px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: item.color || 'var(--color-text-primary)' }}>{item.value || 0}</div>
          </div>
        ))}
      </div>

      {/* Downtime Trend Chart */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 12, padding: 16
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Downtime Hours Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v, name) => [name === 'cost' ? `฿${v.toLocaleString()}` : `${v}hr`, name === 'cost' ? 'Cost' : 'Downtime']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="downtime_hours" name="Hours" fill="#E24B4A" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: Category + OEE breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Failure by category */}
        <div style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 12, padding: 16
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Failures by Category</div>
          {categories.length > 0 ? (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <PieChart width={140} height={140}>
                <Pie data={categories} dataKey="count" cx={65} cy={65} innerRadius={40} outerRadius={65}>
                  {categories.map((c, i) => (
                    <Cell key={i} fill={COLORS[c.category] || '#888'} />
                  ))}
                </Pie>
              </PieChart>
              <div style={{ flex: 1 }}>
                {categories.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[c.category] || '#888', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, flex: 1, textTransform: 'capitalize' }}>{c.category}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{c.count}x</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{Math.round((c.total_minutes || 0) / 60)}hr</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13, textAlign: 'center', padding: 40 }}>
              No failure data in this period
            </div>
          )}
        </div>

        {/* OEE breakdown */}
        <div style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 12, padding: 16
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>OEE Breakdown</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              layout="vertical"
              data={[
                { name: 'Availability', value: oee.availability, target: 95, fill: '#639922' },
                { name: 'Performance', value: oee.performance, target: 95, fill: '#185FA5' },
                { name: 'Quality', value: oee.quality, target: 99, fill: '#1D9E75' },
                { name: 'OEE', value: oee.overall, target: 85, fill: '#7F77DD' },
              ]}
              margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
            >
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" horizontal={false} />
              <Tooltip formatter={v => [`${v?.toFixed(1)}%`]} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {[{ fill: '#639922' }, { fill: '#185FA5' }, { fill: '#1D9E75' }, { fill: '#7F77DD' }].map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Equipment availability table */}
          <div style={{ marginTop: 12, borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>Equipment availability (last {range}d)</div>
            {(kpi?.equipmentAvailability || []).slice(0, 4).map((eq, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.asset_code}</span>
                <div style={{ width: 80, height: 3, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${eq.availability_pct || 100}%`,
                    background: eq.availability_pct < 90 ? '#E24B4A' : '#639922'
                  }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', minWidth: 36 }}>
                  {eq.availability_pct?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
