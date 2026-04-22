import React,{useState,useEffect,useCallback}from'react';
import{Link}from'react-router-dom';
import{workOrderAPI,equipmentAPI}from'../utils/api';

const slaColor=(sla,status)=>{if(['completed','closed','cancelled'].includes(status))return'var(--text-muted)';if(!sla)return'var(--text-muted)';const h=(new Date(sla)-Date.now())/3600000;return h<0?'var(--danger)':h<4?'var(--warning)':'var(--success)';};
const slaLabel=(sla,status)=>{if(['completed','closed','cancelled'].includes(status))return'—';if(!sla)return'—';const h=(new Date(sla)-Date.now())/3600000;return h<0?`${Math.round(-h)}h overdue`:`${Math.round(h)}h left`;};
const S={input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},label:{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4}};

function Modal({title,onClose,children}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:560,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:20,cursor:'pointer'}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

export default function WorkOrdersPage(){
  const[wos,setWos]=useState([]);
  const[pagination,setPagination]=useState({});
  const[loading,setLoading]=useState(true);
  const[statusFilter,setStatusFilter]=useState('');
  const[typeFilter,setTypeFilter]=useState('');
  const[showModal,setShowModal]=useState(false);
  const[equipment,setEquipment]=useState([]);
  const[form,setForm]=useState({equipment_id:'',type:'corrective',priority:'medium',title:'',description:'',estimated_hours:''});
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await workOrderAPI.list({status:statusFilter||undefined,type:typeFilter||undefined,limit:50});setWos(r.data?.data||[]);setPagination(r.pagination||{});}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[statusFilter,typeFilter]);

  useEffect(()=>{load();},[load]);

  const openModal=async()=>{
    setError('');setForm({equipment_id:'',type:'corrective',priority:'medium',title:'',description:'',estimated_hours:''});
    if(!equipment.length){
      const r=await equipmentAPI.list({limit:50});
      setEquipment(r.data?.data||[]);
    }
    setShowModal(true);
  };

  const submit=async()=>{
    if(!form.equipment_id||!form.title.trim()){setError('กรุณาเลือกอุปกรณ์และกรอกหัวข้อ');return;}
    setSaving(true);setError('');
    try{
      await workOrderAPI.create({...form,estimated_hours:parseFloat(form.estimated_hours)||undefined});
      setShowModal(false);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const f=v=>setForm(p=>({...p,...v}));
  const stats={total:pagination.total||0,open:wos.filter(w=>w.status==='open').length,inProgress:wos.filter(w=>w.status==='in_progress').length,critical:wos.filter(w=>w.priority==='critical').length,sla:wos.filter(w=>{const h=(new Date(w.sla_due_at)-Date.now())/3600000;return h<0&&!['completed','closed','cancelled'].includes(w.status);}).length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">Work Orders</h1><p className="page-sub">{stats.total} total · {stats.open} open · {stats.inProgress} in progress</p></div>
      <button className="btn btn-primary"onClick={openModal}>+ New Work Order</button>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:20}}>
      {[{l:'All WOs',v:stats.total,active:!statusFilter,onClick:()=>setStatusFilter('')},{l:'Open',v:stats.open,active:statusFilter==='open',onClick:()=>setStatusFilter('open'),c:'var(--accent)'},{l:'In Progress',v:stats.inProgress,active:statusFilter==='in_progress',onClick:()=>setStatusFilter('in_progress'),c:'var(--warning)'},{l:'Critical',v:stats.critical,c:'var(--danger)'},{l:'SLA Breach',v:stats.sla,c:stats.sla>0?'var(--danger)':'var(--success)'}].map(({l,v,active,onClick,c})=>(
        <div key={l}className="card"onClick={onClick}style={{cursor:onClick?'pointer':'default',border:`1px solid ${active?'var(--accent)':'var(--border)'}`,background:active?'rgba(59,130,246,.05)':'var(--bg-surface)'}}>
          <div className="stat-label">{l}</div><div className="stat-value"style={{fontSize:24,color:c||'var(--text-primary)'}}>{v}</div>
        </div>
      ))}
    </div>

    <div className="flex gap-2 mb-4">
      <select value={typeFilter}onChange={e=>setTypeFilter(e.target.value)}style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',color:'var(--text-primary)',fontSize:13}}>
        <option value="">All Types</option>
        {['corrective','preventive','predictive','inspection','project'].map(t=><option key={t}value={t}>{t}</option>)}
      </select>
      <button onClick={load}className="btn btn-secondary"style={{fontSize:12}}>↻ Refresh</button>
    </div>

    <div className="table-wrapper">
      <table><thead><tr><th>WO #</th><th>Equipment</th><th>Title</th><th>Type</th><th>Status</th><th>Priority</th><th>Assigned</th><th>SLA</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><div className="skeleton"style={{height:16}}/></td>)}</tr>):
        wos.length===0?<tr><td colSpan={8}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No work orders</td></tr>:
        wos.map(wo=><tr key={wo.id}>
          <td><Link to={`/work-orders/${wo.id}`}className="mono"style={{color:'var(--accent)'}}>{wo.wo_number}</Link></td>
          <td><div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{wo.equipment_name||wo.asset_code}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{wo.location_name}</div></td>
          <td style={{maxWidth:200}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text-primary)'}}>{wo.title}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{wo.type}·{new Date(wo.created_at).toLocaleDateString('th-TH')}</div></td>
          <td><span className="badge badge-medium"style={{textTransform:'capitalize'}}>{wo.type}</span></td>
          <td><span className={`badge badge-${wo.status}`}>{wo.status?.replace('_',' ')}</span></td>
          <td><span className={`badge badge-${wo.priority}`}>{wo.priority}</span></td>
          <td style={{color:'var(--text-muted)',fontSize:12}}>{wo.assigned_to_name||'—'}</td>
          <td style={{color:slaColor(wo.sla_due_at,wo.status),fontSize:12,fontWeight:600}}>{slaLabel(wo.sla_due_at,wo.status)}</td>
        </tr>)}
      </tbody></table>
    </div>

    {showModal&&<Modal title="สร้างใบสั่งงานใหม่"onClose={()=>setShowModal(false)}>
      <div style={{marginBottom:14}}>
        <label style={S.label}>อุปกรณ์ *</label>
        <select value={form.equipment_id}onChange={e=>f({equipment_id:e.target.value})}style={S.input}>
          <option value="">-- เลือกอุปกรณ์ --</option>
          {equipment.map(eq=><option key={eq.id}value={eq.id}>[{eq.asset_code}] {eq.name}</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div style={{marginBottom:14}}>
          <label style={S.label}>ประเภท *</label>
          <select value={form.type}onChange={e=>f({type:e.target.value})}style={S.input}>
            {['corrective','preventive','predictive','inspection','project'].map(t=><option key={t}value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}>
          <label style={S.label}>ความสำคัญ *</label>
          <select value={form.priority}onChange={e=>f({priority:e.target.value})}style={S.input}>
            {['critical','high','medium','low'].map(p=><option key={p}value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>หัวข้อ *</label>
        <input value={form.title}onChange={e=>f({title:e.target.value})}placeholder="เช่น เปลี่ยน Bearing CNC-001"style={S.input}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>รายละเอียด</label>
        <textarea value={form.description}onChange={e=>f({description:e.target.value})}placeholder="อธิบายงานที่ต้องทำ..."style={{...S.input,minHeight:80,resize:'vertical',fontFamily:'inherit'}}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>ประมาณชั่วโมงทำงาน</label>
        <input type="number"value={form.estimated_hours}onChange={e=>f({estimated_hours:e.target.value})}placeholder="2.5"min="0.5"step="0.5"style={S.input}/>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setShowModal(false)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submit}disabled={saving}className="btn btn-primary">{saving?'กำลังบันทึก...':'สร้างใบสั่งงาน'}</button>
      </div>
    </Modal>}
  </div>);
}
