import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { workOrderAPI } from '../utils/api';

const slaColor = (sla, status) => {
  if (['completed','closed','cancelled'].includes(status)) return 'var(--text-muted)';
  if (!sla) return 'var(--text-muted)';
  const h = (new Date(sla) - Date.now()) / 3600000;
  if (h < 0) return 'var(--danger)';
  if (h < 4) return 'var(--warning)';
  return 'var(--success)';
};
const slaLabel = (sla, status) => {
  if (['completed','closed','cancelled'].includes(status)) return '—';
  if (!sla) return '—';
  const h = (new Date(sla) - Date.now()) / 3600000;
  if (h < 0) return `${Math.round(-h)}h overdue`;
  return `${Math.round(h)}h left`;
};

export default function WorkOrdersPage() {
  const [wos, setWos] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await workOrderAPI.list({ status: status||undefined, type: type||undefined, page, limit: 20 });
      setWos(r.data?.data || []);
      setPagination(r.pagination || {});
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [status, type, page]);

  useEffect(() => { load(); }, [load]);

  const stats = { total: pagination.total || 0, open: wos.filter(w => w.status==='open').length, inProgress: wos.filter(w => w.status==='in_progress').length, critical: wos.filter(w => w.priority==='critical').length, sla: wos.filter(w => { const h=(new Date(w.sla_due_at)-Date.now())/3600000; return h<0 && !['completed','closed','cancelled'].includes(w.status); }).length };

  return (
    <div className="page">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p className="page-sub">{stats.total} total · {stats.open} open · {stats.inProgress} in progress</p>
        </div>
        <button className="btn btn-primary">+ New Work Order</button>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-6" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { label: 'All WOs', value: stats.total, active: !status, onClick: () => setStatus('') },
          { label: 'Open', value: stats.open, active: status==='open', onClick: () => setStatus('open'), color: 'var(--accent)' },
          { label: 'In Progress', value: stats.inProgress, active: status==='in_progress', onClick: () => setStatus('in_progress'), color: 'var(--warning)' },
          { label: 'Critical', value: stats.critical, active: false, color: 'var(--danger)' },
          { label: 'SLA Breach', value: stats.sla, active: false, color: stats.sla > 0 ? 'var(--danger)' : 'var(--success)' },
        ].map(({ label, value, active, onClick, color }) => (
          <div key={label} className="card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'rgba(59,130,246,.05)' : 'var(--bg-surface)' }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: 24, color: color || 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 13 }}>
          <option value="">All Types</option>
          {['corrective','preventive','predictive','inspection','project'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={load} className="btn btn-secondary" style={{ fontSize: 12 }}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead><tr>
            <th>WO #</th><th>Equipment</th><th>Title</th><th>Type</th><th>Status</th><th>Priority</th><th>Assigned</th><th>SLA</th>
          </tr></thead>
          <tbody>
            {loading ? [...Array(5)].map((_,i) => (
              <tr key={i}>{[...Array(8)].map((_,j) => <td key={j}><div className="skeleton" style={{height:16}} /></td>)}</tr>
            )) : wos.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No work orders found</td></tr>
            ) : wos.map(wo => (
              <tr key={wo.id}>
                <td><Link to={`/work-orders/${wo.id}`} className="mono" style={{ color: 'var(--accent)' }}>{wo.wo_number}</Link></td>
                <td style={{ maxWidth: 120 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wo.equipment_name || wo.asset_code}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wo.location_name}</div>
                </td>
                <td style={{ maxWidth: 200 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{wo.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wo.type} · {new Date(wo.created_at).toLocaleDateString('th-TH')}</div>
                </td>
                <td><span className="badge badge-medium" style={{ textTransform: 'capitalize' }}>{wo.type}</span></td>
                <td><span className={`badge badge-${wo.status}`}>{wo.status?.replace('_',' ')}</span></td>
                <td><span className={`badge badge-${wo.priority}`}>{wo.priority}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{wo.assigned_to_name || '—'}</td>
                <td style={{ color: slaColor(wo.sla_due_at, wo.status), fontSize: 12, fontWeight: 600 }}>{slaLabel(wo.sla_due_at, wo.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
