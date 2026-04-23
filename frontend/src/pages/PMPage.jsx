import React,{useState,useEffect,useCallback}from'react';
import{pmAPI,equipmentAPI}from'../utils/api';

const S={
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16},
  modal:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:580,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'},
  body:{padding:20},
  label:{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:5},
  input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
  field:{marginBottom:14},
  row:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
};

const dueColor=(status)=>({overdue:'var(--danger)',due_soon:'var(--warning)',ok:'var(--success)'}[status]||'var(--text-muted)');
const dueLabel=(days,status)=>{
  if(status==='overdue')return`เกินกำหนด ${Math.abs(days)} วัน`;
  if(status==='due_soon')return`อีก ${days} วัน`;
  return`อีก ${days} วัน`;
};

function ModalWrap({title,onClose,children}){
  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <span style={{fontSize:15,fontWeight:700}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>
        <div style={S.body}>{children}</div>
      </div>
    </div>
  );
}

function CreateModal({onClose,onSave}){
  const[eq,setEq]=useState([]);
  const[form,setForm]=useState({equipment_id:'',name:'',description:'',frequency_days:'30',estimated_hours:'2',next_due_date:''});
  const[checklist,setChecklist]=useState(['']);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    equipmentAPI.list({limit:50}).then(r=>setEq(r.data?.data||[])).catch(console.error);
    const d=new Date();d.setDate(d.getDate()+30);
    f('next_due_date',d.toISOString().slice(0,10));
  },[]);

  const addItem=()=>setChecklist(p=>[...p,'']);
  const updateItem=(i,v)=>setChecklist(p=>p.map((x,idx)=>idx===i?v:x));
  const removeItem=(i)=>setChecklist(p=>p.filter((_,idx)=>idx!==i));

  const submit=async(e)=>{
    e.preventDefault();
    if(!form.equipment_id){setError('กรุณาเลือกอุปกรณ์');return;}
    if(!form.name.trim()){setError('กรุณากรอกชื่อแผน PM');return;}
    if(!form.frequency_days||parseInt(form.frequency_days)<1){setError('ความถี่ต้องมากกว่า 0 วัน');return;}
    setSaving(true);setError('');
    try{
      await pmAPI.create({
        ...form,
        frequency_days:parseInt(form.frequency_days),
        estimated_hours:parseFloat(form.estimated_hours)||null,
        checklist:checklist.filter(c=>c.trim()),
        next_due_date:form.next_due_date||undefined
      });
      onSave();
    }catch(e){setError(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  return(
    <ModalWrap title="🔧 สร้างแผน Preventive Maintenance" onClose={onClose}>
      <form onSubmit={submit}>
        <div style={S.field}>
          <label style={S.label}>อุปกรณ์ *</label>
          <select style={S.input} value={form.equipment_id} onChange={e=>f('equipment_id',e.target.value)} autoFocus>
            <option value="">-- เลือกอุปกรณ์ --</option>
            {eq.map(e=><option key={e.id} value={e.id}>[{e.asset_code}] {e.name}</option>)}
          </select>
        </div>
        <div style={S.field}>
          <label style={S.label}>ชื่อแผน PM *</label>
          <input style={S.input} placeholder="เช่น ตรวจสอบประจำเดือน CNC-001" value={form.name} onChange={e=>f('name',e.target.value)}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>รายละเอียด</label>
          <textarea style={{...S.input,minHeight:60,resize:'vertical',fontFamily:'inherit'}} placeholder="รายละเอียดงานที่ต้องทำ..." value={form.description} onChange={e=>f('description',e.target.value)}/>
        </div>
        <div style={{...S.row,marginBottom:0}}>
          <div style={S.field}>
            <label style={S.label}>ความถี่ (วัน) *</label>
            <input style={S.input} type="number" min="1" placeholder="30" value={form.frequency_days} onChange={e=>f('frequency_days',e.target.value)}/>
          </div>
          <div style={S.field}>
            <label style={S.label}>เวลาโดยประมาณ (ชม.)</label>
            <input style={S.input} type="number" min="0.5" step="0.5" placeholder="2" value={form.estimated_hours} onChange={e=>f('estimated_hours',e.target.value)}/>
          </div>
        </div>
        <div style={S.field}>
          <label style={S.label}>วันครบกำหนดครั้งแรก</label>
          <input style={S.input} type="date" value={form.next_due_date} onChange={e=>f('next_due_date',e.target.value)}/>
        </div>

        {/* Checklist */}
        <div style={S.field}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <label style={S.label}>Checklist รายการตรวจสอบ</label>
            <button type="button" onClick={addItem} style={{background:'var(--accent)',color:'#fff',border:'none',borderRadius:4,padding:'3px 10px',fontSize:12,cursor:'pointer'}}>+ เพิ่ม</button>
          </div>
          {checklist.map((item,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:6}}>
              <input style={{...S.input}} placeholder={`รายการที่ ${i+1}`} value={item} onChange={e=>updateItem(i,e.target.value)}/>
              {checklist.length>1&&<button type="button" onClick={()=>removeItem(i)} style={{background:'var(--danger)',color:'#fff',border:'none',borderRadius:4,padding:'0 8px',fontSize:12,cursor:'pointer',flexShrink:0}}>✕</button>}
            </div>
          ))}
        </div>

        {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
        <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
          <button type="button" onClick={onClose} className="btn btn-secondary">ยกเลิก</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving?'กำลังบันทึก...':'✓ สร้างแผน PM'}</button>
        </div>
      </form>
    </ModalWrap>
  );
}

function CompleteModal({pm,onClose,onSave}){
  const[form,setForm]=useState({actual_hours:'2',notes:''});
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  const submit=async(e)=>{
    e.preventDefault();
    if(!form.actual_hours||parseFloat(form.actual_hours)<0.1){setError('กรุณากรอกชั่วโมงทำงาน');return;}
    setSaving(true);setError('');
    try{
      await pmAPI.complete(pm.id,{actual_hours:parseFloat(form.actual_hours),notes:form.notes});
      onSave();
    }catch(e){setError(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  return(
    <ModalWrap title={`✅ บันทึก PM เสร็จสิ้น — ${pm.equipment_name}`} onClose={onClose}>
      <div style={{background:'var(--bg-base)',borderRadius:8,padding:12,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>{pm.name}</div>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>ความถี่: ทุก {pm.frequency_days} วัน · วันถัดไปจะถูกคำนวณอัตโนมัติ</div>
      </div>
      <form onSubmit={submit}>
        <div style={S.field}>
          <label style={S.label}>ชั่วโมงทำงานจริง *</label>
          <input style={S.input} type="number" min="0.1" step="0.5" placeholder="2.0" value={form.actual_hours} onChange={e=>setForm(p=>({...p,actual_hours:e.target.value}))} autoFocus/>
        </div>
        <div style={S.field}>
          <label style={S.label}>บันทึกการทำงาน</label>
          <textarea style={{...S.input,minHeight:80,resize:'vertical',fontFamily:'inherit'}} placeholder="สรุปงานที่ทำ, ชิ้นส่วนที่เปลี่ยน, ปัญหาที่พบ..." value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/>
        </div>
        {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
        <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
          <button type="button" onClick={onClose} className="btn btn-secondary">ยกเลิก</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving?'กำลังบันทึก...':'✓ ยืนยัน PM เสร็จสิ้น'}</button>
        </div>
      </form>
    </ModalWrap>
  );
}

export default function PMPage(){
  const[schedules,setSchedules]=useState([]);
  const[stats,setStats]=useState({});
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState('');
  const[showCreate,setShowCreate]=useState(false);
  const[completing,setCompleting]=useState(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const params={is_active:'true'};
      if(filter==='overdue')params.due_within_days=-1;
      else if(filter==='due_soon')params.due_within_days=7;
      const r=await pmAPI.list(params);
      setSchedules(r.data?.data||[]);
      setStats(r.data?.stats||{});
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{load();},[load]);

  const deactivate=async(id)=>{
    if(!window.confirm('ต้องการปิดใช้งานแผน PM นี้?'))return;
    try{await pmAPI.delete(id);load();}catch(e){alert(e.message);}
  };

  const fmtDate=d=>d?new Date(d).toLocaleDateString('th-TH',{year:'2-digit',month:'short',day:'numeric'}):'—';

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">🔧 Preventive Maintenance</h1><p className="page-sub">แผนบำรุงรักษาเชิงป้องกัน · ลดการหยุดเครื่องโดยไม่คาดคิด</p></div>
      <button className="btn btn-primary" onClick={()=>setShowCreate(true)}>+ สร้างแผน PM</button>
    </div>

    {/* Stats */}
    <div className="grid-4 mb-6">
      {[{l:'แผนทั้งหมด',v:stats.total||0},{l:'เกินกำหนด',v:stats.overdue||0,c:'var(--danger)'},{l:'ใกล้ถึงกำหนด',v:stats.due_soon||0,c:'var(--warning)'},{l:'ปกติ',v:stats.ok||0,c:'var(--success)'}].map(({l,v,c})=>(
        <div key={l} className="card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:c||'var(--text-primary)'}}>{v}</div></div>
      ))}
    </div>

    {/* Filters */}
    <div className="flex gap-2 mb-4">
      {[['','ทั้งหมด'],['overdue','🔴 เกินกำหนด'],['due_soon','🟡 ใกล้ถึงกำหนด']].map(([v,l])=>(
        <button key={v} onClick={()=>setFilter(v)} className={`btn btn-${filter===v?'primary':'secondary'}`} style={{fontSize:12,padding:'6px 14px'}}>{l}</button>
      ))}
      <button onClick={load} className="btn btn-secondary" style={{fontSize:12}}>↻</button>
    </div>

    {/* Table */}
    <div className="table-wrapper">
      <table>
        <thead><tr><th>อุปกรณ์</th><th>ชื่อแผน PM</th><th>ความถี่</th><th>วันครบกำหนด</th><th>สถานะ</th><th>ทำเสร็จล่าสุด</th><th>ชม. ประมาณ</th><th>Actions</th></tr></thead>
        <tbody>
          {loading?[...Array(4)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><div className="skeleton" style={{height:16}}/></td>)}</tr>):
          schedules.length===0?<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-muted)',padding:40}}>ไม่มีแผน PM · กด "+ สร้างแผน PM" เพื่อเริ่มต้น</td></tr>:
          schedules.map(pm=>(
            <tr key={pm.id}>
              <td>
                <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{pm.equipment_name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{pm.asset_code}</div>
              </td>
              <td>
                <div style={{fontWeight:500,color:'var(--text-primary)',fontSize:13}}>{pm.name}</div>
                {pm.description&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:2,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pm.description}</div>}
              </td>
              <td style={{color:'var(--text-muted)',fontSize:13}}>ทุก {pm.frequency_days} วัน</td>
              <td>
                <div style={{fontWeight:600,color:dueColor(pm.due_status),fontSize:13}}>{fmtDate(pm.next_due_date)}</div>
                <div style={{fontSize:11,color:dueColor(pm.due_status)}}>{dueLabel(pm.days_until_due,pm.due_status)}</div>
              </td>
              <td>
                <span style={{display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:`${dueColor(pm.due_status)}22`,color:dueColor(pm.due_status),textTransform:'uppercase'}}>
                  {pm.due_status==='overdue'?'เกินกำหนด':pm.due_status==='due_soon'?'ใกล้ถึงกำหนด':'ปกติ'}
                </span>
              </td>
              <td style={{fontSize:12,color:'var(--text-muted)'}}>{pm.last_completed_at?fmtDate(pm.last_completed_at):'ยังไม่เคยทำ'}</td>
              <td style={{color:'var(--text-muted)',fontSize:13}}>{pm.estimated_hours?`${pm.estimated_hours} ชม.`:'—'}</td>
              <td>
                <div className="flex gap-2">
                  <button onClick={()=>setCompleting(pm)} className="btn btn-primary" style={{padding:'4px 10px',fontSize:11,background:'var(--success)'}}>✓ ทำเสร็จ</button>
                  <button onClick={()=>deactivate(pm.id)} className="btn btn-danger" style={{padding:'4px 10px',fontSize:11}}>ปิด</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {showCreate&&<CreateModal onClose={()=>setShowCreate(false)} onSave={()=>{setShowCreate(false);load();}}/>}
    {completing&&<CompleteModal pm={completing} onClose={()=>setCompleting(null)} onSave={()=>{setCompleting(null);load();}}/>}
  </div>);
}
