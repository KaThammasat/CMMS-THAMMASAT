import React,{useState,useEffect,useCallback}from'react';
import api from'../utils/api';

const S={input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},label:{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4}};
const statusColor={overdue:'var(--danger)',due_soon:'var(--warning)',ok:'var(--success)'};
const statusLabel={overdue:'⚠ เกินกำหนด',due_soon:'📅 ใกล้ถึงกำหนด',ok:'✓ ปกติ'};
const freqLabel={daily:'ทุกวัน',weekly:'ทุกสัปดาห์',monthly:'ทุกเดือน',quarterly:'ทุก 3 เดือน',yearly:'ทุกปี',hours:'ตามชั่วโมงใช้งาน'};

function Modal({title,onClose,children,width=560}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:20,cursor:'pointer'}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

export default function PMPage(){
  const[schedules,setSchedules]=useState([]);
  const[loading,setLoading]=useState(true);
  const[equipment,setEquipment]=useState([]);
  const[filter,setFilter]=useState('');
  const[modal,setModal]=useState(null); // 'create'|'complete'
  const[selected,setSelected]=useState(null);
  const[form,setForm]=useState({equipment_id:'',name:'',description:'',frequency_type:'monthly',frequency_value:1,estimated_hours:'',next_due_date:'',tasks:[]});
  const[completeForm,setCompleteForm]=useState({completed_date:'',actual_hours:'',notes:''});
  const[taskInput,setTaskInput]=useState('');
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[success,setSuccess]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const[pmR,eqR]=await Promise.all([api.get('/pm'),api.get('/equipment')]);
      setSchedules(pmR.data?.data||[]);
      setEquipment(eqR.data?.data||[]);
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const f=v=>setForm(p=>({...p,...v}));
  const cf=v=>setCompleteForm(p=>({...p,...v}));

  const addTask=()=>{
    if(!taskInput.trim())return;
    f({tasks:[...form.tasks,{description:taskInput.trim(),done:false}]});
    setTaskInput('');
  };
  const removeTask=i=>f({tasks:form.tasks.filter((_,idx)=>idx!==i)});

  const openCreate=()=>{
    const today=new Date().toISOString().slice(0,10);
    setForm({equipment_id:equipment[0]?.id||'',name:'',description:'',frequency_type:'monthly',frequency_value:1,estimated_hours:'',next_due_date:today,tasks:[]});
    setTaskInput('');setError('');setModal('create');
  };

  const openComplete=(s)=>{
    setSelected(s);
    setCompleteForm({completed_date:new Date().toISOString().slice(0,10),actual_hours:s.estimated_hours||'',notes:''});
    setError('');setModal('complete');
  };

  const createPM=async()=>{
    if(!form.equipment_id||!form.name.trim()){setError('กรุณาเลือกอุปกรณ์และกรอกชื่อแผน');return;}
    setSaving(true);setError('');
    try{
      await api.post('/pm',{...form,frequency_value:parseInt(form.frequency_value)||1,estimated_hours:parseFloat(form.estimated_hours)||null});
      setModal(null);setSuccess('สร้างแผน PM เรียบร้อยแล้ว');setTimeout(()=>setSuccess(''),3000);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const completePM=async()=>{
    setSaving(true);setError('');
    try{
      const r=await api.post('/pm/'+selected.id+'/complete',{...completeForm,actual_hours:parseFloat(completeForm.actual_hours)||null});
      setModal(null);
      setSuccess(`✓ บันทึกเรียบร้อย! ${r.data?.data?.wo_number||''} — กำหนดครั้งถัดไป: ${r.data?.data?.next_due_date||''}`);
      setTimeout(()=>setSuccess(''),5000);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const deactivate=async(id)=>{
    if(!window.confirm('ปิดแผน PM นี้?'))return;
    try{await api.delete('/pm/'+id);load();}catch(e){alert(e.response?.data?.error||e.message);}
  };

  const filtered=schedules.filter(s=>{
    if(filter==='overdue')return s.status==='overdue';
    if(filter==='due_soon')return s.status==='due_soon';
    if(filter==='active')return s.is_active;
    return true;
  });

  const stats={total:schedules.length,overdue:schedules.filter(s=>s.status==='overdue').length,dueSoon:schedules.filter(s=>s.status==='due_soon').length,ok:schedules.filter(s=>s.status==='ok').length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">🔧 Preventive Maintenance</h1><p className="page-sub">แผนการบำรุงรักษาเชิงป้องกัน</p></div>
      <button className="btn btn-primary"onClick={openCreate}>+ สร้างแผน PM</button>
    </div>

    {success&&<div style={{background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',borderRadius:8,padding:'10px 14px',marginBottom:16,color:'var(--success)',fontSize:13}}>{success}</div>}

    <div className="grid-4 mb-6">
      {[{l:'แผน PM ทั้งหมด',v:stats.total},{l:'เกินกำหนด',v:stats.overdue,c:'var(--danger)'},{l:'ใกล้ถึงกำหนด',v:stats.dueSoon,c:'var(--warning)'},{l:'ปกติ',v:stats.ok,c:'var(--success)'}].map(({l,v,c})=>(
        <div key={l}className="card"><div className="stat-label">{l}</div><div className="stat-value"style={{color:c||'var(--text-primary)'}}>{v}</div></div>
      ))}
    </div>

    <div className="flex gap-2 mb-4">
      {[['','ทั้งหมด'],['overdue','⚠ เกินกำหนด'],['due_soon','📅 ใกล้ถึงกำหนด'],['ok','✓ ปกติ'],['active','เฉพาะที่ใช้งาน']].map(([v,l])=>(
        <button key={v}onClick={()=>setFilter(v)}className={`btn btn-${filter===v?'primary':'secondary'}`}style={{fontSize:12,padding:'6px 12px'}}>{l}</button>
      ))}
      <button onClick={load}className="btn btn-secondary"style={{fontSize:12,marginLeft:'auto'}}>↻</button>
    </div>

    {loading?<div className="grid-2">{[...Array(4)].map((_,i)=><div key={i}className="card"><div className="skeleton"style={{height:140}}/></div>)}</div>:
    filtered.length===0?<div className="card"style={{textAlign:'center',padding:40}}><div style={{fontSize:40,marginBottom:12}}>📋</div><p className="text-muted">ไม่มีแผน PM</p></div>:
    <div className="grid-2">
      {filtered.map(s=>(
        <div key={s.id}className="card"style={{border:`1px solid ${s.status==='overdue'?'rgba(239,68,68,.4)':s.status==='due_soon'?'rgba(245,158,11,.3)':'var(--border)'}`,opacity:s.is_active?1:.6}}>
          <div className="flex justify-between items-start"style={{marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:'var(--text-primary)',fontSize:14,marginBottom:2}}>{s.name}</div>
              <div style={{fontSize:12,color:'var(--accent)',fontFamily:'var(--mono)'}}>{s.asset_code} · {s.equipment_name}</div>
            </div>
            <span style={{fontSize:11,fontWeight:700,color:statusColor[s.status],background:statusColor[s.status]+'18',padding:'3px 8px',borderRadius:12,whiteSpace:'nowrap',marginLeft:8}}>{statusLabel[s.status]||s.status}</span>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            {[['ความถี่',`${s.frequency_value} ${freqLabel[s.frequency_type]||s.frequency_type}`],['ทำครั้งล่าสุด',s.last_done_date||'ยังไม่เคยทำ'],['กำหนดครั้งถัดไป',s.next_due_date||'—'],['เวลาโดยประมาณ',s.estimated_hours?s.estimated_hours+'h':'—']].map(([k,v])=>(
              <div key={k}style={{background:'var(--bg-base)',borderRadius:6,padding:'6px 8px'}}>
                <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:2}}>{k}</div>
                <div style={{fontSize:12,fontWeight:600,color:k==='กำหนดครั้งถัดไป'&&s.status==='overdue'?'var(--danger)':'var(--text-primary)'}}>{v}</div>
              </div>
            ))}
          </div>

          {s.description&&<p style={{fontSize:12,color:'var(--text-muted)',marginBottom:10,lineHeight:1.5}}>{s.description}</p>}
          {s.tasks?.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>รายการตรวจสอบ ({s.tasks.length} รายการ)</div><div style={{fontSize:11,color:'var(--text-secondary)'}}>{s.tasks.slice(0,2).map(t=>t.description).join(' · ')}{s.tasks.length>2&&` · +${s.tasks.length-2} อื่นๆ`}</div></div>}

          <div className="flex gap-2">
            {s.is_active&&<button onClick={()=>openComplete(s)}className="btn btn-primary"style={{flex:1,fontSize:12}}>✓ บันทึกการทำ PM</button>}
            {s.is_active&&<button onClick={()=>deactivate(s.id)}className="btn btn-danger"style={{fontSize:12,padding:'6px 10px'}}>ปิด</button>}
          </div>
        </div>
      ))}
    </div>}

    {/* Create PM Modal */}
    {modal==='create'&&<Modal title="สร้างแผน PM ใหม่"onClose={()=>setModal(null)}>
      <div style={{marginBottom:14}}>
        <label style={S.label}>อุปกรณ์ *</label>
        <select value={form.equipment_id}onChange={e=>f({equipment_id:e.target.value})}style={S.input}>
          <option value="">-- เลือกอุปกรณ์ --</option>
          {equipment.map(eq=><option key={eq.id}value={eq.id}>[{eq.asset_code}] {eq.name}</option>)}
        </select>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>ชื่อแผน PM *</label>
        <input value={form.name}onChange={e=>f({name:e.target.value})}placeholder="เช่น ตรวจสอบน้ำมันหล่อลื่นรายเดือน"style={S.input}/>
      </div>
      <div className="grid-2">
        <div style={{marginBottom:14}}>
          <label style={S.label}>ความถี่ *</label>
          <select value={form.frequency_type}onChange={e=>f({frequency_type:e.target.value})}style={S.input}>
            {Object.entries(freqLabel).map(([v,l])=><option key={v}value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}>
          <label style={S.label}>ทุกๆ</label>
          <input type="number"value={form.frequency_value}onChange={e=>f({frequency_value:e.target.value})}min="1"style={S.input}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={S.label}>เวลาที่ใช้ (ชั่วโมง)</label>
          <input type="number"value={form.estimated_hours}onChange={e=>f({estimated_hours:e.target.value})}placeholder="2"min="0.5"step="0.5"style={S.input}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={S.label}>กำหนดครั้งแรก</label>
          <input type="date"value={form.next_due_date}onChange={e=>f({next_due_date:e.target.value})}style={S.input}/>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>รายละเอียด</label>
        <textarea value={form.description}onChange={e=>f({description:e.target.value})}placeholder="อธิบายงานที่ต้องทำ..."style={{...S.input,minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>รายการตรวจสอบ</label>
        <div className="flex gap-2"style={{marginBottom:8}}>
          <input value={taskInput}onChange={e=>setTaskInput(e.target.value)}onKeyDown={e=>e.key==='Enter'&&addTask()}placeholder="พิมพ์รายการ แล้วกด Enter"style={{...S.input,flex:1}}/>
          <button onClick={addTask}className="btn btn-secondary"style={{fontSize:12}}>+ เพิ่ม</button>
        </div>
        {form.tasks.map((t,i)=><div key={i}style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',background:'var(--bg-base)',borderRadius:5,marginBottom:4}}>
          <span style={{fontSize:12,color:'var(--text-secondary)'}}>• {t.description}</span>
          <button onClick={()=>removeTask(i)}style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:14}}>✕</button>
        </div>)}
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={createPM}disabled={saving}className="btn btn-primary">{saving?'กำลังบันทึก...':'สร้างแผน PM'}</button>
      </div>
    </Modal>}

    {/* Complete PM Modal */}
    {modal==='complete'&&selected&&<Modal title={`บันทึก PM — ${selected.name}`}onClose={()=>setModal(null)}width={460}>
      <div style={{background:'var(--bg-base)',borderRadius:8,padding:12,marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>{selected.asset_code} · {selected.equipment_name}</div>
        <div style={{fontSize:13,color:'var(--text-primary)'}}>กำหนด: <strong style={{color:statusColor[selected.status]}}>{selected.next_due_date||'—'}</strong></div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>วันที่ทำ PM *</label>
        <input type="date"value={completeForm.completed_date}onChange={e=>cf({completed_date:e.target.value})}style={S.input}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>ชั่วโมงที่ใช้จริง</label>
        <input type="number"value={completeForm.actual_hours}onChange={e=>cf({actual_hours:e.target.value})}placeholder={selected.estimated_hours||'2'}min="0.5"step="0.5"style={S.input}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={S.label}>หมายเหตุ</label>
        <textarea value={completeForm.notes}onChange={e=>cf({notes:e.target.value})}placeholder="ผลการตรวจสอบ, อะไหล่ที่ใช้, ปัญหาที่พบ..."style={{...S.input,minHeight:80,resize:'vertical',fontFamily:'inherit'}}/>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={completePM}disabled={saving}className="btn btn-primary">{saving?'กำลังบันทึก...':'✓ ยืนยันทำ PM เสร็จ'}</button>
      </div>
    </Modal>}
  </div>);
}
