import React,{useState,useEffect,useCallback}from'react';
import{Link}from'react-router-dom';
import{workOrderAPI,equipmentAPI}from'../utils/api';

const slaColor=(due,status)=>{
  if(['completed','closed','cancelled'].includes(status))return'var(--text-muted)';
  if(!due)return'var(--text-muted)';
  const h=(new Date(due)-Date.now())/3600000;
  return h<0?'var(--danger)':h<4?'var(--warning)':'var(--success)';
};
const slaLabel=(due,status)=>{
  if(['completed','closed','cancelled'].includes(status))return'—';
  if(!due)return'—';
  const h=(new Date(due)-Date.now())/3600000;
  if(h<0)return`${Math.abs(Math.round(h))}h overdue`;
  if(h<1)return`${Math.round(h*60)}m left`;
  return`${Math.round(h)}h left`;
};

const S={
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16},
  modal:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:560,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'},
  body:{padding:20},
  label:{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:5},
  input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
  field:{marginBottom:14},
};

function NewWOModal({onClose,onSave}){
  const[eq,setEq]=useState([]);
  const[form,setForm]=useState({equipment_id:'',type:'corrective',priority:'medium',title:'',description:'',estimated_hours:''});
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    equipmentAPI.list({limit:50}).then(r=>setEq(r.data?.data||[])).catch(console.error);
  },[]);

  const submit=async(e)=>{
    e.preventDefault();
    if(!form.equipment_id){setError('กรุณาเลือกอุปกรณ์');return;}
    if(!form.title.trim()){setError('กรุณากรอกหัวข้องาน');return;}
    setSaving(true);setError('');
    try{
      await workOrderAPI.create({...form,estimated_hours:parseFloat(form.estimated_hours)||undefined});
      onSave();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <span style={{fontSize:15,fontWeight:700}}>📋 สร้างใบสั่งงานใหม่</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>
        <form onSubmit={submit} style={S.body}>
          <div style={S.field}>
            <label style={S.label}>อุปกรณ์ *</label>
            <select style={S.input} value={form.equipment_id} onChange={e=>f('equipment_id',e.target.value)} autoFocus>
              <option value="">-- เลือกอุปกรณ์ --</option>
              {eq.map(e=><option key={e.id} value={e.id}>[{e.asset_code}] {e.name}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:0}}>
            <div style={S.field}>
              <label style={S.label}>ประเภท *</label>
              <select style={S.input} value={form.type} onChange={e=>f('type',e.target.value)}>
                {['corrective','preventive','predictive','inspection','project'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>ความสำคัญ *</label>
              <select style={S.input} value={form.priority} onChange={e=>f('priority',e.target.value)}>
                {['critical','high','medium','low'].map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>หัวข้อ *</label>
            <input style={S.input} placeholder="เช่น เปลี่ยน Bearing CNC-001" value={form.title} onChange={e=>f('title',e.target.value)}/>
          </div>
          <div style={S.field}>
            <label style={S.label}>รายละเอียด</label>
            <textarea style={{...S.input,minHeight:80,resize:'vertical',fontFamily:'inherit'}} placeholder="อธิบายงานที่ต้องทำ..." value={form.description} onChange={e=>f('description',e.target.value)}/>
          </div>
          <div style={S.field}>
            <label style={S.label}>ประมาณชั่วโมงทำงาน</label>
            <input style={S.input} type="number" placeholder="2.5" min="0.5" step="0.5" value={form.estimated_hours} onChange={e=>f('estimated_hours',e.target.value)}/>
          </div>
          {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ยกเลิก</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving?'กำลังบันทึก...':'✓ สร้างใบสั่งงาน'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkOrdersPage(){
  const[wos,setWos]=useState([]);
  const[pagination,setPagination]=useState({});
  const[loading,setLoading]=useState(true);
  const[statusFilter,setStatusFilter]=useState('');
  const[typeFilter,setTypeFilter]=useState('');
  const[showModal,setShowModal]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await workOrderAPI.list({status:statusFilter||undefined,type:typeFilter||undefined,limit:50});
      setWos(r.data?.data||[]);setPagination(r.data?.pagination||{});
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[statusFilter,typeFilter]);

  useEffect(()=>{load();},[load]);

  const stats={total:pagination.total||0,open:wos.filter(w=>w.status==='open').length,inProgress:wos.filter(w=>w.status==='in_progress').length,critical:wos.filter(w=>w.priority==='critical').length,sla:wos.filter(w=>{const h=(new Date(w.sla_due_at)-Date.now())/3600000;return h<0&&!['completed','closed','cancelled'].includes(w.status);}).length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">Work Orders</h1><p className="page-sub">{stats.total} total · {stats.open} open · {stats.inProgress} in progress</p></div>
      <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ New Work Order</button>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:20}}>
      {[{l:'ALL WOS',v:stats.total,active:!statusFilter,onClick:()=>setStatusFilter('')},{l:'OPEN',v:stats.open,active:statusFilter==='open',onClick:()=>setStatusFilter('open'),c:'var(--accent)'},{l:'IN PROGRESS',v:stats.inProgress,active:statusFilter==='in_progress',onClick:()=>setStatusFilter('in_progress'),c:'var(--warning)'},{l:'CRITICAL',v:stats.critical,c:'var(--danger)'},{l:'SLA BREACH',v:stats.sla,c:stats.sla>0?'var(--danger)':'var(--success)'}].map(({l,v,active,onClick,c})=>(
        <div key={l} className="card" onClick={onClick} style={{cursor:onClick?'pointer':'default',border:`1px solid ${active?'var(--accent)':'var(--border)'}`,background:active?'rgba(59,130,246,.05)':'var(--bg-surface)'}}>
          <div className="stat-label">{l}</div><div className="stat-value" style={{fontSize:24,color:c||'var(--text-primary)'}}>{v}</div>
        </div>
      ))}
    </div>

    <div className="flex gap-2 mb-4">
      <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',color:'var(--text-primary)',fontSize:13}}>
        <option value="">All Types</option>
        {['corrective','preventive','predictive','inspection','project'].map(t=><option key={t} value={t}>{t}</option>)}
      </select>
      <button onClick={load} className="btn btn-secondary" style={{fontSize:12}}>↻ Refresh</button>
    </div>

    <div className="table-wrapper">
      <table><thead><tr><th>WO #</th><th>Equipment</th><th>Title</th><th>Type</th><th>Status</th><th>Priority</th><th>Assigned</th><th>SLA</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><div className="skeleton" style={{height:16}}/></td>)}</tr>):
        wos.length===0?<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No work orders</td></tr>:
        wos.map(wo=><tr key={wo.id}>
          <td><Link to={`/work-orders/${wo.id}`} className="mono" style={{color:'var(--accent)'}}>{wo.wo_number}</Link></td>
          <td><div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{wo.equipment_name||wo.asset_code}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{wo.location_name}</div></td>
          <td style={{maxWidth:200}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text-primary)'}}>{wo.title}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{wo.type}·{new Date(wo.created_at).toLocaleDateString('th-TH')}</div></td>
          <td><span className="badge badge-medium" style={{textTransform:'capitalize'}}>{wo.type}</span></td>
          <td><span className={`badge badge-${wo.status}`}>{wo.status?.replace('_',' ')}</span></td>
          <td><span className={`badge badge-${wo.priority}`}>{wo.priority}</span></td>
          <td style={{color:'var(--text-muted)',fontSize:12}}>{wo.assigned_to_name||'—'}</td>
          <td style={{color:slaColor(wo.sla_due_at,wo.status),fontSize:12,fontWeight:600}}>{slaLabel(wo.sla_due_at,wo.status)}</td>
        </tr>)}
      </tbody></table>
    </div>

    {showModal&&<NewWOModal onClose={()=>setShowModal(false)} onSave={()=>{setShowModal(false);load();}}/>}
  </div>);
}
