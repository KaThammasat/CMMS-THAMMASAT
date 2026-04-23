import React,{useState,useEffect,useCallback}from'react';
import{pmAPI,equipmentAPI}from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};
const FREQ=[{v:'daily',l:'ทุกวัน'},{v:'weekly',l:'ทุกสัปดาห์'},{v:'monthly',l:'ทุกเดือน'},{v:'quarterly',l:'ทุก 3 เดือน'},{v:'yearly',l:'ทุกปี'},{v:'hours',l:'ตามชั่วโมง'}];

const getDueStatus=(next_due_date,is_active)=>{
  if(!is_active)return'inactive';
  if(!next_due_date)return'ok';
  const days=Math.floor((new Date(next_due_date)-Date.now())/86400000);
  if(days<0)return'overdue';
  if(days<=7)return'due_soon';
  return'ok';
};
const statusColor={overdue:'var(--danger)',due_soon:'var(--warning)',ok:'var(--success)',inactive:'var(--text-muted)'};
const statusText={overdue:'⚠ เกินกำหนด',due_soon:'📅 ใกล้ถึงกำหนด',ok:'✓ ปกติ',inactive:'ปิดใช้งาน'};
const fmtDate=d=>d?new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'—';

function Modal({title,onClose,children}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:580,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

const initForm={equipment_id:'',name:'',description:'',frequency_type:'monthly',frequency_value:1,estimated_hours:'',next_due_date:'',tasks:[]};

export default function PMPage(){
  const[schedules,setSchedules]=useState([]);
  const[loading,setLoading]=useState(true);
  const[equipment,setEquipment]=useState([]);
  const[filter,setFilter]=useState('');
  const[modal,setModal]=useState(null);
  const[selected,setSelected]=useState(null);
  const[form,setForm]=useState(initForm);
  const[completeForm,setCompleteForm]=useState({completed_date:new Date().toISOString().slice(0,10),actual_hours:'',notes:''});
  const[taskInput,setTaskInput]=useState('');
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const[pm,eq]=await Promise.all([pmAPI.list(),equipmentAPI.list({limit:50})]);
      setSchedules(pm.data?.data||[]);
      setEquipment(eq.data?.data||[]);
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const F=(k,v)=>setForm(p=>({...p,[k]:v}));

  const openCreate=()=>{
    setForm({...initForm,next_due_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10)});
    setError('');setTaskInput('');setModal('create');
  };

  const openComplete=(s)=>{
    setSelected(s);
    setCompleteForm({completed_date:new Date().toISOString().slice(0,10),actual_hours:String(s.estimated_hours||''),notes:''});
    setError('');setModal('complete');
  };

  const addTask=()=>{
    if(!taskInput.trim())return;
    F('tasks',[...form.tasks,{name:taskInput.trim(),required:true}]);
    setTaskInput('');
  };

  const removeTask=(i)=>F('tasks',form.tasks.filter((_,idx)=>idx!==i));

  const submitCreate=async()=>{
    if(!form.equipment_id){setError('กรุณาเลือกอุปกรณ์');return;}
    if(!form.name.trim()){setError('กรุณากรอกชื่อแผนบำรุงรักษา');return;}
    if(!form.next_due_date){setError('กรุณาระบุวันที่กำหนดครั้งถัดไป');return;}
    setSaving(true);setError('');
    try{
      await pmAPI.create({
        equipment_id:form.equipment_id,
        name:form.name.trim(),
        description:form.description.trim()||undefined,
        frequency_type:form.frequency_type,
        frequency_value:parseInt(form.frequency_value)||1,
        estimated_hours:parseFloat(form.estimated_hours)||undefined,
        next_due_date:form.next_due_date,
        tasks:form.tasks,
      });
      setModal(null);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const submitComplete=async()=>{
    if(!completeForm.completed_date){setError('กรุณาระบุวันที่ดำเนินการ');return;}
    setSaving(true);setError('');
    try{
      await pmAPI.complete(selected.id,{
        completed_date:completeForm.completed_date,
        actual_hours:parseFloat(completeForm.actual_hours)||undefined,
        notes:completeForm.notes.trim()||undefined,
      });
      setModal(null);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const deactivate=async(s)=>{
    if(!window.confirm(`ปิดการใช้งานแผน "${s.name}"?`))return;
    try{await pmAPI.deactivate(s.id);load();}catch(e){alert(e.response?.data?.error||e.message);}
  };

  const displayed=filter?schedules.filter(s=>getDueStatus(s.next_due_date,s.is_active)===filter):schedules;
  const stats={total:schedules.length,overdue:schedules.filter(s=>getDueStatus(s.next_due_date,s.is_active)==='overdue').length,due_soon:schedules.filter(s=>getDueStatus(s.next_due_date,s.is_active)==='due_soon').length,ok:schedules.filter(s=>getDueStatus(s.next_due_date,s.is_active)==='ok').length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">🛡 Preventive Maintenance</h1><p className="page-sub">แผนการบำรุงรักษาเชิงป้องกัน · {stats.total} แผน</p></div>
      <button className="btn btn-primary"onClick={openCreate}>+ สร้างแผน PM</button>
    </div>

    {/* Stats */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
      {[{l:'ทั้งหมด',v:stats.total,f:'',c:'var(--text-primary)'},{l:'เกินกำหนด',v:stats.overdue,f:'overdue',c:'var(--danger)'},{l:'ใกล้ถึงกำหนด',v:stats.due_soon,f:'due_soon',c:'var(--warning)'},{l:'ปกติ',v:stats.ok,f:'ok',c:'var(--success)'}].map(({l,v,f,c})=>(
        <div key={l}className="card"onClick={()=>setFilter(filter===f?'':f)}style={{cursor:'pointer',border:`1px solid ${filter===f?c:'var(--border)'}`,background:filter===f?`${c}18`:'var(--bg-surface)',transition:'all .15s'}}>
          <div className="stat-label">{l}</div>
          <div className="stat-value"style={{fontSize:28,color:c}}>{v}</div>
        </div>
      ))}
    </div>

    {/* Table */}
    <div className="table-wrapper">
      <table><thead><tr><th>ชื่อแผน</th><th>อุปกรณ์</th><th>ความถี่</th><th>ครั้งล่าสุด</th><th>ครั้งถัดไป</th><th>ชั่วโมง</th><th>สถานะ</th><th>Actions</th></tr></thead>
      <tbody>
        {loading?[...Array(4)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><div className="skeleton"style={{height:16}}/></td>)}</tr>):
        displayed.length===0?<tr><td colSpan={8}style={{textAlign:'center',color:'var(--text-muted)',padding:40}}>ไม่พบแผนบำรุงรักษา · <button onClick={openCreate}style={{color:'var(--accent)',background:'none',border:'none',cursor:'pointer'}}>+ สร้างแผนแรก</button></td></tr>:
        displayed.map(s=>{
          const st=getDueStatus(s.next_due_date,s.is_active);
          const freqUnit=FREQ.find(f=>f.v===s.frequency_type)?.l||s.frequency_type;
          return<tr key={s.id}>
            <td><div style={{fontWeight:600,color:'var(--text-primary)'}}>{s.name}</div>{s.description&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{s.description.slice(0,40)}</div>}</td>
            <td><div style={{fontSize:13,color:'var(--text-primary)'}}>{s.equipment_name}</div><div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{s.asset_code}</div></td>
            <td style={{fontSize:13,color:'var(--text-secondary)'}}>{s.frequency_value} {freqUnit}</td>
            <td style={{fontSize:12,color:'var(--text-muted)'}}>{fmtDate(s.last_done_date)}</td>
            <td style={{fontSize:13,fontWeight:600,color:statusColor[st]}}>{fmtDate(s.next_due_date)}</td>
            <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.estimated_hours?`${s.estimated_hours}h`:'—'}</td>
            <td><span style={{fontSize:11,fontWeight:700,color:statusColor[st]}}>{statusText[st]}</span></td>
            <td>
              <div className="flex gap-2">
                <button onClick={()=>openComplete(s)}className="btn btn-primary"style={{padding:'3px 10px',fontSize:11}}>✓ บันทึก</button>
                {s.is_active&&<button onClick={()=>deactivate(s)}className="btn btn-secondary"style={{padding:'3px 8px',fontSize:11}}>ปิด</button>}
              </div>
            </td>
          </tr>;
        })}
      </tbody>
    </table></div>

    {/* Modal: สร้างแผน PM */}
    {modal==='create'&&<Modal title="🛡 สร้างแผนบำรุงรักษา"onClose={()=>setModal(null)}>
      <div style={{marginBottom:14}}>
        <label style={SL}>อุปกรณ์ <span style={{color:'var(--danger)'}}>*</span></label>
        <select style={SI}value={form.equipment_id}onChange={e=>F('equipment_id',e.target.value)}>
          <option value="">-- เลือกอุปกรณ์ --</option>
          {equipment.map(eq=><option key={eq.id}value={eq.id}>[{eq.asset_code}] {eq.name}</option>)}
        </select>
      </div>
      <div style={{marginBottom:14}}>
        <label style={SL}>ชื่อแผน <span style={{color:'var(--danger)'}}>*</span></label>
        <input style={SI}value={form.name}onChange={e=>F('name',e.target.value)}placeholder="เช่น บำรุงรักษาประจำเดือน CNC-001"/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={SL}>รายละเอียด</label>
        <textarea style={{...SI,minHeight:60,resize:'vertical',fontFamily:'inherit'}}value={form.description}onChange={e=>F('description',e.target.value)}placeholder="อธิบายขอบเขตงาน..."/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
        <div>
          <label style={SL}>ความถี่</label>
          <select style={SI}value={form.frequency_type}onChange={e=>F('frequency_type',e.target.value)}>
            {FREQ.map(f=><option key={f.v}value={f.v}>{f.l}</option>)}
          </select>
        </div>
        <div>
          <label style={SL}>ค่าความถี่</label>
          <input type="number"style={SI}value={form.frequency_value}onChange={e=>F('frequency_value',e.target.value)}min="1"placeholder="1"/>
        </div>
        <div>
          <label style={SL}>ชั่วโมงโดยประมาณ</label>
          <input type="number"style={SI}value={form.estimated_hours}onChange={e=>F('estimated_hours',e.target.value)}min="0.5"step="0.5"placeholder="2"/>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={SL}>วันที่กำหนดครั้งถัดไป <span style={{color:'var(--danger)'}}>*</span></label>
        <input type="date"style={SI}value={form.next_due_date}onChange={e=>F('next_due_date',e.target.value)}/>
      </div>
      {/* Tasks */}
      <div style={{marginBottom:14}}>
        <label style={SL}>รายการงาน (ไม่บังคับ)</label>
        <div className="flex gap-2"style={{marginBottom:8}}>
          <input style={{...SI,flex:1}}value={taskInput}onChange={e=>setTaskInput(e.target.value)}placeholder="เช่น ตรวจสอบน้ำมันหล่อลื่น"onKeyDown={e=>e.key==='Enter'&&addTask()}/>
          <button onClick={addTask}className="btn btn-secondary"style={{whiteSpace:'nowrap',fontSize:12}}>+ เพิ่ม</button>
        </div>
        {form.tasks.length>0&&<div style={{display:'flex',flexDirection:'column',gap:4}}>
          {form.tasks.map((t,i)=>(
            <div key={i}style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-base)',borderRadius:6,padding:'6px 10px',fontSize:13}}>
              <span>✓ {t.name}</span>
              <button onClick={()=>removeTask(i)}style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:16}}>×</button>
            </div>
          ))}
        </div>}
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitCreate}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ สร้างแผน PM'}</button>
      </div>
    </Modal>}

    {/* Modal: บันทึกการทำงาน */}
    {modal==='complete'&&selected&&<Modal title={`✅ บันทึกการทำงาน — ${selected.name}`}onClose={()=>setModal(null)}>
      <div style={{background:'var(--bg-base)',borderRadius:8,padding:12,marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>อุปกรณ์</div>
        <div style={{fontSize:15,fontWeight:600}}>{selected.equipment_name} <span style={{color:'var(--text-muted)',fontFamily:'var(--mono)',fontSize:12}}>({selected.asset_code})</span></div>
        <div style={{marginTop:6,fontSize:12,color:'var(--text-muted)'}}>กำหนดเดิม: <span style={{color:statusColor[getDueStatus(selected.next_due_date,selected.is_active)]}}>{fmtDate(selected.next_due_date)}</span></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <div>
          <label style={SL}>วันที่ดำเนินการ <span style={{color:'var(--danger)'}}>*</span></label>
          <input type="date"style={SI}value={completeForm.completed_date}onChange={e=>setCompleteForm(p=>({...p,completed_date:e.target.value}))}/>
        </div>
        <div>
          <label style={SL}>ชั่วโมงจริง</label>
          <input type="number"style={SI}value={completeForm.actual_hours}onChange={e=>setCompleteForm(p=>({...p,actual_hours:e.target.value}))}placeholder={selected.estimated_hours||'2'}min="0.5"step="0.5"/>
        </div>
      </div>
      {selected.tasks?.length>0&&<div style={{marginBottom:14}}>
        <label style={SL}>รายการงาน</label>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {selected.tasks.map((t,i)=><div key={i}style={{background:'var(--bg-base)',borderRadius:6,padding:'6px 10px',fontSize:13,color:'var(--success)'}}>✓ {t.name||t}</div>)}
        </div>
      </div>}
      <div style={{marginBottom:14}}>
        <label style={SL}>หมายเหตุ</label>
        <textarea style={{...SI,minHeight:70,resize:'vertical',fontFamily:'inherit'}}value={completeForm.notes}onChange={e=>setCompleteForm(p=>({...p,notes:e.target.value}))}placeholder="สิ่งที่พบ, งานที่ทำ, ข้อเสนอแนะ..."/>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitComplete}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✅ ยืนยันการทำงาน'}</button>
      </div>
    </Modal>}
  </div>);
}
