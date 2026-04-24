import React,{useState,useEffect,useCallback}from'react';
import{Link}from'react-router-dom';
import api from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};
const Sk=()=><div className="skeleton"style={{height:16}}/>;

function Modal({title,onClose,children,width=560}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width,maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
      </div>
      <div style={{padding:18}}>{children}</div>
    </div>
  </div>;
}

const slaColor=(due,st)=>{if(!due||['completed','closed','cancelled'].includes(st))return'var(--text-muted)';const h=(new Date(due)-Date.now())/3600000;return h<0?'var(--danger)':h<4?'var(--warning)':'var(--success)';};
const slaText=(due,st)=>{if(!due||['completed','closed','cancelled'].includes(st))return'—';const h=(new Date(due)-Date.now())/3600000;return h<0?`${Math.abs(Math.round(h))}h overdue`:h<1?`${Math.round(h*60)}m left`:`${Math.round(h)}h left`;};

export default function WorkOrdersPage(){
  const[wos,setWos]=useState([]);
  const[pagination,setPagination]=useState({});
  const[equipment,setEquipment]=useState([]);
  const[loading,setLoading]=useState(true);
  const[statusFilter,setStatusFilter]=useState('');
  const[typeFilter,setTypeFilter]=useState('');
  const[showCreate,setShowCreate]=useState(false);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  // Create fields
  const[eqId,setEqId]=useState('');
  const[woType,setWoType]=useState('corrective');
  const[priority,setPriority]=useState('medium');
  const[title,setTitle]=useState('');
  const[desc,setDesc]=useState('');
  const[estHrs,setEstHrs]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await api.get('/work-orders',{params:{status:statusFilter||undefined,type:typeFilter||undefined,limit:50}});
      setWos(r.data?.data||[]);setPagination(r.data?.pagination||{});
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[statusFilter,typeFilter]);

  useEffect(()=>{load();},[load]);

  const openCreate=async()=>{
    setEqId('');setWoType('corrective');setPriority('medium');setTitle('');setDesc('');setEstHrs('');setError('');
    if(!equipment.length){try{const r=await api.get('/equipment',{params:{limit:50}});setEquipment(r.data?.data||[]);}catch(e){console.error(e);}}
    setShowCreate(true);
  };

  const submit=async()=>{
    if(!eqId){setError('กรุณาเลือกอุปกรณ์');return;}
    if(!title.trim()){setError('กรุณากรอกหัวข้องาน');return;}
    setSaving(true);setError('');
    try{
      await api.post('/work-orders',{equipment_id:eqId,type:woType,priority,title:title.trim(),description:desc.trim()||undefined,estimated_hours:parseFloat(estHrs)||undefined});
      setShowCreate(false);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const stats={
    total:pagination.total||0,
    open:wos.filter(w=>w.status==='open').length,
    inProg:wos.filter(w=>w.status==='in_progress').length,
    crit:wos.filter(w=>w.priority==='critical').length,
    sla:wos.filter(w=>{const h=(new Date(w.sla_due_at)-Date.now())/3600000;return h<0&&!['completed','closed','cancelled'].includes(w.status);}).length
  };

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">📋 ใบสั่งงาน</h1><p className="page-sub">{stats.total} รายการ · {stats.open} เปิด · {stats.inProg} กำลังทำ</p></div>
      <button className="btn btn-primary"onClick={openCreate}>+ สร้างใบสั่งงาน</button>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:16}}>
      {[{l:'ทั้งหมด',v:stats.total,f:''},{l:'เปิด',v:stats.open,f:'open',c:'var(--accent)'},{l:'กำลังทำ',v:stats.inProg,f:'in_progress',c:'var(--warning)'},{l:'วิกฤต',v:stats.crit,c:'var(--danger)'},{l:'SLA Breach',v:stats.sla,c:stats.sla>0?'var(--danger)':'var(--success)'}].map(({l,v,f,c})=>(
        <div key={l}className="card"onClick={f!==undefined?()=>setStatusFilter(statusFilter===f?'':f):undefined}style={{cursor:f!==undefined?'pointer':'default',border:`1px solid ${statusFilter===f&&f!==undefined?'var(--accent)':'var(--border)'}`}}>
          <div className="stat-label">{l}</div><div className="stat-value"style={{fontSize:24,color:c||'var(--text-primary)'}}>{v}</div>
        </div>
      ))}
    </div>

    <div className="flex gap-2 mb-4">
      <select value={typeFilter}onChange={e=>setTypeFilter(e.target.value)}style={{...SI,height:34,padding:'4px 8px',width:'auto'}}>
        <option value="">ประเภทงาน</option>
        {['corrective','preventive','predictive','inspection','project'].map(t=><option key={t}value={t}>{t}</option>)}
      </select>
      <button onClick={load}className="btn btn-secondary"style={{fontSize:12}}>↻ รีเฟรช</button>
    </div>

    <div className="table-wrapper"><table>
      <thead><tr><th>WO #</th><th>อุปกรณ์</th><th>หัวข้อ</th><th>ประเภท</th><th>สถานะ</th><th>ความสำคัญ</th><th>ผู้รับผิดชอบ</th><th>SLA</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><Sk/></td>)}</tr>):
        wos.length===0?<tr><td colSpan={8}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>ไม่พบใบสั่งงาน</td></tr>:
        wos.map(wo=><tr key={wo.id}>
          <td><Link to={`/work-orders/${wo.id}`}className="mono"style={{color:'var(--accent)',fontWeight:600,fontSize:12}}>{wo.wo_number}</Link></td>
          <td><div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{wo.equipment_name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{wo.location_name}</div></td>
          <td style={{maxWidth:200}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13,color:'var(--text-primary)'}}>{wo.title}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{wo.type} · {new Date(wo.created_at).toLocaleDateString('th-TH')}</div></td>
          <td><span className="badge badge-medium"style={{textTransform:'capitalize'}}>{wo.type}</span></td>
          <td><span className={`badge badge-${wo.status}`}>{wo.status?.replace('_',' ')}</span></td>
          <td><span className={`badge badge-${wo.priority}`}>{wo.priority}</span></td>
          <td style={{color:'var(--text-muted)',fontSize:12}}>{wo.assigned_to_name||'—'}</td>
          <td style={{color:slaColor(wo.sla_due_at,wo.status),fontSize:12,fontWeight:600}}>{slaText(wo.sla_due_at,wo.status)}</td>
        </tr>)}
      </tbody></table></div>

    {showCreate&&<Modal title="📋 สร้างใบสั่งงานใหม่"onClose={()=>setShowCreate(false)}>
      <div style={{marginBottom:14}}>
        <label style={SL}>อุปกรณ์ *</label>
        <select style={SI}value={eqId}onChange={e=>setEqId(e.target.value)}>
          <option value="">-- เลือกอุปกรณ์ --</option>
          {equipment.map(eq=><option key={eq.id}value={eq.id}>[{eq.asset_code}] {eq.name}</option>)}
        </select>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <div><label style={SL}>ประเภทงาน *</label>
          <select style={SI}value={woType}onChange={e=>setWoType(e.target.value)}>
            <option value="corrective">🔧 Corrective</option>
            <option value="preventive">🛡 Preventive</option>
            <option value="predictive">🤖 Predictive</option>
            <option value="inspection">🔍 Inspection</option>
            <option value="project">📦 Project</option>
          </select>
        </div>
        <div><label style={SL}>ความสำคัญ *</label>
          <select style={SI}value={priority}onChange={e=>setPriority(e.target.value)}>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
      </div>
      <div style={{marginBottom:14}}><label style={SL}>หัวข้องาน *</label><input style={SI}value={title}onChange={e=>setTitle(e.target.value)}placeholder="เช่น เปลี่ยน Bearing CNC-001"/></div>
      <div style={{marginBottom:14}}><label style={SL}>รายละเอียด</label><textarea style={{...SI,minHeight:70,resize:'vertical',fontFamily:'inherit'}}value={desc}onChange={e=>setDesc(e.target.value)}placeholder="รายละเอียดงาน..."/></div>
      <div style={{marginBottom:14}}><label style={SL}>ชั่วโมงประมาณ</label><input type="number"style={SI}value={estHrs}onChange={e=>setEstHrs(e.target.value)}placeholder="2.5"min="0.5"step="0.5"/></div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:10,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setShowCreate(false)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submit}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังสร้าง...':'✓ สร้างใบสั่งงาน'}</button>
      </div>
    </Modal>}
  </div>);
}
