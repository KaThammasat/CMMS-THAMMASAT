/**
 * Work Orders Page
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { workOrderAPI } from '../utils/api';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  draft:            { bg: '#F1EFE8', color: '#5F5E5A', label: 'Draft' },
  open:             { bg: '#FAEEDA', color: '#854F0B', label: 'Open' },
  assigned:         { bg: '#E1F5EE', color: '#0F6E56', label: 'Assigned' },
  in_progress:      { bg: '#E6F1FB', color: '#185FA5', label: 'In Progress' },
  pending_approval: { bg: '#EEEDFE', color: '#3C3489', label: 'Pending Approval' },
  loto_prep:        { bg: '#FCEBEB', color: '#791F1F', label: 'LOTO Prep' },
  loto_executed:    { bg: '#FCEBEB', color: '#A32D2D', label: 'LOTO Active' },
  completed:        { bg: '#EAF3DE', color: '#3B6D11', label: 'Completed' },
  closed:           { bg: '#D3D1C7', color: '#444441', label: 'Closed' },
  cancelled:        { bg: '#D3D1C7', color: '#444441', label: 'Cancelled' },
};

const PRIORITY_COLORS = {
  critical: '#E24B4A', high: '#EF9F27', medium: '#378ADD', low: '#639922'
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: '#eee', color: '#666', label: status };
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10,
      background: s.bg, color: s.color, fontWeight: 500, whiteSpace: 'nowrap'
    }}>{s.label}</span>
  );
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', type: '', priority: '' });
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.priority) params.priority = filters.priority;
      const res = await workOrderAPI.list(params);
      setWorkOrders(res.data?.data || []);
    } catch (err) {
      toast.error('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const getSlaStatus = (wo) => {
    if (!wo.sla_due_at || ['completed','closed','cancelled'].includes(wo.status)) return null;
    const hoursLeft = (new Date(wo.sla_due_at) - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < 0) return { label: 'BREACHED', color: '#A32D2D', bg: '#FCEBEB' };
    if (hoursLeft < 1) return { label: `${Math.round(hoursLeft * 60)}m left`, color: '#A32D2D', bg: '#FCEBEB' };
    if (hoursLeft < 4) return { label: `${hoursLeft.toFixed(1)}h left`, color: '#854F0B', bg: '#FAEEDA' };
    return { label: `${hoursLeft.toFixed(1)}h left`, color: 'var(--color-text-tertiary)', bg: 'transparent' };
  };

  const counts = {
    total: workOrders.length,
    open: workOrders.filter(w => w.status === 'open').length,
    in_progress: workOrders.filter(w => w.status === 'in_progress').length,
    critical: workOrders.filter(w => w.priority === 'critical').length,
    breached: workOrders.filter(w => w.sla_breached || getSlaStatus(w)?.label === 'BREACHED').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Work Orders</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {counts.total} total · {counts.open} open · {counts.in_progress} in progress
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: '#185FA5', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500
          }}
        >+ New Work Order</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[
          { label: 'All WOs', value: counts.total, active: !filters.status, onClick: () => setFilters(f => ({ ...f, status: '' })) },
          { label: 'Open', value: counts.open, color: '#854F0B', active: filters.status === 'open', onClick: () => setFilters(f => ({ ...f, status: 'open' })) },
          { label: 'In Progress', value: counts.in_progress, color: '#185FA5', active: filters.status === 'in_progress', onClick: () => setFilters(f => ({ ...f, status: 'in_progress' })) },
          { label: 'Critical', value: counts.critical, color: '#A32D2D', active: filters.priority === 'critical', onClick: () => setFilters(f => ({ ...f, priority: f.priority === 'critical' ? '' : 'critical' })) },
          { label: 'SLA Breach', value: counts.breached, color: '#A32D2D', active: false },
        ].map(card => (
          <div
            key={card.label}
            onClick={card.onClick}
            style={{
              background: card.active ? '#E6F1FB' : 'var(--color-background-primary)',
              border: `0.5px solid ${card.active ? '#185FA5' : 'var(--color-border-tertiary)'}`,
              borderRadius: 8, padding: '10px 14px', cursor: card.onClick ? 'pointer' : 'default',
              transition: 'all 0.12s'
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: card.color || 'var(--color-text-primary)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { key: 'type', options: ['corrective','preventive','predictive','inspection'], label: 'Type' },
        ].map(f => (
          <select
            key={f.key}
            value={filters[f.key]}
            onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            <option value="">All {f.label}</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <button onClick={load} style={{ fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}>Refresh</button>
      </div>

      {/* Work orders table */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 12, overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading...</div>
        ) : workOrders.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No work orders found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                {['WO #', 'Priority', 'Equipment', 'Title', 'Assigned To', 'Status', 'SLA'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontSize: 10, fontFamily: 'monospace', letterSpacing: 1,
                    color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
                    fontWeight: 500, whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workOrders.map(wo => {
                const sla = getSlaStatus(wo);
                return (
                  <tr
                    key={wo.id}
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    style={{
                      borderBottom: '0.5px solid var(--color-border-tertiary)',
                      cursor: 'pointer', transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: '#185FA5' }}>
                      {wo.wo_number}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: PRIORITY_COLORS[wo.priority],
                        display: 'inline-block'
                      }} />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500 }}>{wo.asset_code}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{wo.location_name}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wo.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        {wo.type} · {wo.created_at ? formatDistanceToNow(new Date(wo.created_at), { addSuffix: true }) : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: wo.assigned_to_name ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                      {wo.assigned_to_name || 'Unassigned'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={wo.status} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {sla && (
                        <span style={{
                          fontSize: 10, fontFamily: 'monospace',
                          color: sla.color,
                          background: sla.bg,
                          padding: '2px 6px', borderRadius: 4
                        }}>{sla.label}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
