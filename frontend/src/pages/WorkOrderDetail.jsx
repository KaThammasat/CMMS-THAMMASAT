import React,{useState,useEffect}from'react';
import{useParams,Link,useNavigate}from'react-router-dom';
import api from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};
const Sk=({h=20})=><div className="skeleton"style={{height:h,marginBottom:8}}/>;

const STATUS_FLOW=['open','in_progress','on_hold','loto_prep','completed','closed','cancelled'];
const statusColor={open:'var(--accent)',in_progress:'var(--warning)',on_hold:'var(--text-muted)',loto_prep:'var(--purple)',completed:'var(--success)',closed:'var(--text-muted)',cancelled:'var(--danger)'};

function InfoRow({label,value}){
  return<div style={{display:'flex',gap:16,padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
    <span style={{color:'var(--text-muted)',minWidth:160}}>{label}</span>
    <span style={{color:'var(--text-primary)',fontWeight:500}}>{value||'—'}</span>
  </div>;
}

export default function WorkOrderDetail(){
  const{id}=useParams();
  const navigate=useNavigate();
  const[wo,setWo]=useState(null);
  const[loading,setLoading]=useState(true);
  const[err,setErr]=useState('');
  // Update status
  const[newStatus,setNewStatus]=useState('');
  const[statusNotes,setStatusNotes]=useState('');
  const[actualHrs,setActualHrs]=useState('');
  const[statusSaving,setStatusSaving]=useState(false);
  const[statusErr,setStatusErr]=useState('');
  // Edit WO
  const[showEdit,setShowEdit]=useState(false);
  const[editTitle,setEditTitle]=useState('');
  const[editPriority,setEditPriority]=useState('');
  const[editDesc,setEditDesc]=useState('');
  const[editHrs,setEditHrs]=useState('');
  const[editSaving,setEditSaving]=useState(false);
  const[editErr,setEditErr]=useState('');

  const load=async()=>{
    setLoading(true);setErr('');
    try{const r=await api.get('/work-orders/'+id);setWo(r.data?.data);setNewStatus(r.data?.data?.status);}
    catch(e){setErr(e.response?.data?.error||e.message);}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[id]);

  const updateStatus=async()=>{
    if(!newStatus){setStatusErr('กรุณาเลือกสถานะ');return;}
    setStatusSaving(true);setStatusErr('');
    try{
      await api.patch(`/work-orders/${id}/status`,{status:newStatus,notes:statusNotes.trim()||undefined,actual_hours:parseFloat(actualHrs)||undefined});
      load();
    }catch(e){setStatusErr(e.response?.data?.error||e.message);}
    finally{setStatusSaving(false);}
  };

  const openEdit=()=>{setEditTitle(wo.title);setEditPriority(wo.priority);setEditDesc(wo.description||'');setEditHrs(wo.estimated_hours||'');setEditErr('');setShowEdit(true);};

  const saveEdit=async()=>{
    if(!editTitle.trim()){setEditErr('กรุณากรอกหัวข้อ');return;}
    setEditSaving(true);setEditErr('');
    try{
      await api.patch(`/work-orders/${id}`,{title:editTitle.trim(),priority:editPriority,description:editDesc.trim()||undefined,estimated_hours:parseFloat(editHrs)||undefined});
      setShowEdit(false);load();
    }catch(e){setEditErr(e.response?.data?.error||e.message);}
    finally{setEditSaving(false);}
  };

  const handleDelete=async()=>{
    if(!window.confirm(`ลบใบสั่งงาน ${wo?.wo_number}?\n\nสามารถลบได้เฉพาะใบที่ยังไม่เริ่มงาน (open/cancelled)`))return;
    try{await api.delete(`/work-orders/${id}`);navigate('/work-orders');}
    catch(e){alert(e.response?.data?.error||e.message);}
  };

  if(loading)return<div className="page"><div style={{padding:20}}><Sk h={30}/><Sk/><Sk/><Sk/></div></div>;
  if(err||!wo)return<div className="page"><div className="card"style={{textAlign:'center',padding:40}}><p style={{color:'var(--danger)'}}>{err||'ไม่พบข้อมูล'}</p><Link to="/work-orders"className="btn btn-secondary"style={{marginTop:12}}>← กลับ</Link></div></div>;

  return(<div className="page">
    <div style={{marginBottom:16}}><Link to="/work-orders"style={{color:'var(--text-muted)',fontSize:13,textDecoration:'none'}}>← กลับรายการ</Link></div>
    <div className="flex justify-between items-center"style={{marginBottom:20,flexWrap:'wrap',gap:12}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:800,color:'var(--text-primary)',marginBottom:4}}>{wo.wo_number}</h1>
        <p style={{color:'var(--text-muted)',fontSize:14}}>{wo.title}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={openEdit}className="btn btn-secondary">✏ แก้ไข</button>
        {['open','cancelled'].includes(wo.status)&&<button onClick={handleDelete}className="btn btn-danger">🗑 ลบ</button>}
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
      <div className="card">
        <div className="section-title"style={{marginBottom:12}}>📋 รายละเอียดใบสั่งงาน</div>
        <InfoRow label="WO Number"value={wo.wo_number}/>
        <InfoRow label="อุปกรณ์"value={`${wo.equipment_name} (${wo.asset_code})`}/>
        <InfoRow label="สถานที่"value={wo.location_name}/>
        <InfoRow label="ประเภทงาน"value={wo.type}/>
        <InfoRow label="ความสำคัญ"value={<span className={`badge badge-${wo.priority}`}>{wo.priority}</span>}/>
        <InfoRow label="สถานะ"value={<span style={{color:statusColor[wo.status],fontWeight:700}}>{wo.status?.replace('_',' ')}</span>}/>
        <InfoRow label="ผู้รับผิดชอบ"value={wo.assigned_to_name}/>
        <InfoRow label="ชั่วโมงประมาณ"value={wo.estimated_hours?wo.estimated_hours+'h':undefined}/>
        <InfoRow label="ชั่วโมงจริง"value={wo.actual_hours?wo.actual_hours+'h':undefined}/>
        <InfoRow label="วันสร้าง"value={new Date(wo.created_at).toLocaleString('th-TH')}/>
        <InfoRow label="SLA ครบกำหนด"value={wo.sla_due_at?new Date(wo.sla_due_at).toLocaleString('th-TH'):undefined}/>
        {wo.completed_at&&<InfoRow label="เสร็จสิ้น"value={new Date(wo.completed_at).toLocaleString('th-TH')}/>}
        {wo.description&&<div style={{marginTop:12,padding:10,background:'var(--bg-base)',borderRadius:6,fontSize:13,color:'var(--text-secondary)',lineHeight:1.6}}>{wo.description}</div>}
        {wo.notes&&<div style={{marginTop:8,padding:10,background:'rgba(59,130,246,.06)',borderRadius:6,fontSize:13,color:'var(--text-primary)',lineHeight:1.6}}><strong>Notes:</strong> {wo.notes}</div>}
      </div>

      <div className="card">
        <div className="section-title"style={{marginBottom:12}}>🔄 อัพเดตสถานะ</div>
        <div style={{marginBottom:12}}>
          <label style={SL}>เปลี่ยนสถานะเป็น</label>
          <select style={SI}value={newStatus}onChange={e=>setNewStatus(e.target.value)}>
            {STATUS_FLOW.map(s=><option key={s}value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
        {['completed','closed'].includes(newStatus)&&
          <div style={{marginBottom:12}}>
            <label style={SL}>ชั่วโมงจริง</label>
            <input type="number"style={SI}value={actualHrs}onChange={e=>setActualHrs(e.target.value)}placeholder="2.5"min="0"step="0.5"/>
          </div>}
        <div style={{marginBottom:12}}>
          <label style={SL}>บันทึก / หมายเหตุ</label>
          <textarea style={{...SI,minHeight:70,resize:'vertical',fontFamily:'inherit'}}value={statusNotes}onChange={e=>setStatusNotes(e.target.value)}placeholder="รายละเอียดการดำเนินการ..."/>
        </div>
        {statusErr&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:10,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6}}>⚠ {statusErr}</div>}
        <button onClick={updateStatus}disabled={statusSaving||newStatus===wo.status}className="btn btn-primary"style={{width:'100%'}}>{statusSaving?'⏳ กำลังบันทึก...':'✓ บันทึกสถานะ'}</button>

        {/* Task checklist */}
        {wo.tasks?.length>0&&<>
          <div className="section-title"style={{marginTop:20,marginBottom:10}}>✅ รายการงาน</div>
          {wo.tasks.map((t,i)=><div key={i}style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13,color:'var(--text-primary)'}}>
            <span style={{color:t.completed?'var(--success)':'var(--text-muted)',fontSize:16}}>{t.completed?'✓':'☐'}</span>{t.name||t.description}
          </div>)}
        </>}

        {/* Parts used */}
        {wo.parts_used?.length>0&&<>
          <div className="section-title"style={{marginTop:20,marginBottom:10}}>🔩 อะไหล่ที่ใช้</div>
          {wo.parts_used.map((p,i)=><div key={i}style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
            <span style={{color:'var(--text-primary)'}}>{p.part_name}</span>
            <span style={{color:'var(--text-muted)'}}>{p.quantity_used} pcs</span>
          </div>)}
        </>}
      </div>
    </div>

    {/* Edit Modal */}
    {showEdit&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
      <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:520,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:15,fontWeight:700}}>✏ แก้ไขใบสั่งงาน</span>
          <button onClick={()=>setShowEdit(false)}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{padding:18}}>
          <div style={{marginBottom:12}}><label style={SL}>หัวข้องาน *</label><input style={SI}value={editTitle}onChange={e=>setEditTitle(e.target.value)}/></div>
          <div style={{marginBottom:12}}><label style={SL}>ความสำคัญ</label>
            <select style={SI}value={editPriority}onChange={e=>setEditPriority(e.target.value)}>
              {['critical','high','medium','low'].map(p=><option key={p}value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}><label style={SL}>รายละเอียด</label><textarea style={{...SI,minHeight:80,resize:'vertical',fontFamily:'inherit'}}value={editDesc}onChange={e=>setEditDesc(e.target.value)}/></div>
          <div style={{marginBottom:14}}><label style={SL}>ชั่วโมงประมาณ</label><input type="number"style={SI}value={editHrs}onChange={e=>setEditHrs(e.target.value)}min="0"step="0.5"/></div>
          {editErr&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:10,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6}}>⚠ {editErr}</div>}
          <div className="flex gap-2 justify-between">
            <button onClick={()=>setShowEdit(false)}className="btn btn-secondary">ยกเลิก</button>
            <button onClick={saveEdit}disabled={editSaving}className="btn btn-primary">{editSaving?'⏳...':'✓ บันทึก'}</button>
          </div>
        </div>
      </div>
    </div>}
  </div>);
}
