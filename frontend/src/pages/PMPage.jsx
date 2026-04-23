import React,{useState,useEffect,useCallback}from'react';
import{useAuthStore}from'../store';
import api from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};

function Modal({title,onClose,children,width=560}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width,maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer'}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

const statusColor={overdue:'var(--danger)',due_soon:'var(--warning)',ok:'var(--success)'};
const statusLabel={overdue:'🔴 เกินกำหนด',due_soon:'🟡 ใกล้กำหนด',ok:'🟢 ปกติ'};
const freqLabel=(t,v)=>{const m={daily:'วัน',weekly:'สัปดาห์',monthly:'เดือน',quarterly:'ไตรมาส',yearly:'ปี'};return`ทุก ${v} ${m[t]||t}`;};
const daysDiff=d=>{if(!d)return null;const diff=Math.round((new Date(d)-Date.now())/86400000);return diff;};

export default function PMPage(){
  const{user}=useAuthStore();
  const isAdmin=user?.role==='admin'||user?.role==='manager';
  const[schedules,setSchedules]=useState([]);
  const[equipment,setEquipment]=useState([]);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState('');   // 'overdue'|'due_soon'|'ok'|''
  const[showCreate,setShowCreate]=useState(false);
  const[showComplete,setShowComplete]=useState(null);
  const[showDetail,setShowDetail]=useState(null);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  // Create form fields
  const[ceqId,setCeqId]=useState('');
  const[cname,setCname]=useState('');
  const[cdesc,setCdesc]=useState('');
  const[cfreqType,setCfreqType]=useState('monthly');
  const[cfreqVal,setCfreqVal]=useState('1');
  const[cestHrs,setCestHrs]=useState('');
  const[cnextDate,setCnextDate]=useState('');
  const[ctasks,setCtasks]=useState('');
  // Complete form fields
  const[doneDate,setDoneDate]=useState(new Date().toISOString().slice(0,10));
  const[doneNotes,setDoneNotes]=useState('');
  const[createWO,setCreateWO]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const[pmR,eqR]=await Promise.all([api.get('/pm'),api.get('/equipment')]);
      setSchedules(pmR.data?.data||[]);
      setEquipment(eqR.data?.data||[]);
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const resetCreate=()=>{setCeqId('');setCname('');setCdesc('');setCfreqType('monthly');setCfreqVal('1');setCestHrs('');setCnextDate('');setCtasks('');setError('');};

  const submitCreate=async()=>{
    if(!ceqId){setError('กรุณาเลือกอุปกรณ์');return;}
    if(!cname.trim()){setError('กรุณากรอกชื่อแผนบำรุงรักษา');return;}
    if(!cnextDate){setError('กรุณาระบุวันที่ครบกำหนดครั้งถัดไป');return;}
    setSaving(true);setError('');
    try{
      const tasksArr=ctasks.trim()?ctasks.split('\n').map(t=>t.trim()).filter(Boolean):[];
      await api.post('/pm',{
        equipment_id:ceqId,name:cname.trim(),description:cdesc.trim()||undefined,
        frequency_type:cfreqType,frequency_value:parseInt(cfreqVal)||1,
        estimated_hours:parseFloat(cestHrs)||undefined,
        next_due_date:cnextDate,
        tasks:tasksArr.map(t=>({description:t,completed:false})),
      });
      setShowCreate(false);resetCreate();load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const submitComplete=async()=>{
    if(!doneDate){setError('กรุณาระบุวันที่เสร็จสิ้น');return;}
    setSaving(true);setError('');
    try{
      await api.post(`/pm/${showComplete.id}/complete`,{completed_date:doneDate,notes:doneNotes.trim()||undefined,create_work_order:createWO});
      setShowComplete(null);setDoneDate(new Date().toISOString().slice(0,10));setDoneNotes('');setCreateWO(true);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const deactivate=async(s)=>{
    if(!window.confirm(`ปิดใช้งานแผน "${s.name}"?`))return;
    try{await api.delete(`/pm/${s.id}`);load();}catch(e){alert(e.response?.data?.error||e.message);}
  };

  const displayed=filter?schedules.filter(s=>s.status===filter):schedules;
  const stats={total:schedules.length,overdue:schedules.filter(s=>s.status==='overdue').length,due_soon:schedules.filter(s=>s.status==='due_soon').length,ok:schedules.filter(s=>s.status==='ok').length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">🛡 Preventive Maintenance</h1><p className="page-sub">แผนบำรุงรักษาเชิงป้องกัน — {stats.total} รายการ · {stats.overdue} เกินกำหนด · {stats.due_soon} ใกล้กำหนด</p></div>
      {isAdmin&&<button className="btn btn-primary"onClick={()=>{resetCreate();setShowCreate(true);}}>+ สร้างแผน PM</button>}
    </div>

    {/* Stats */}
    <div className="grid-4 mb-6">
      {[{l:'แผนทั้งหมด',v:stats.total,f:''},{l:'🔴 เกินกำหนด',v:stats.overdue,c:'var(--danger)',f:'overdue'},{l:'🟡 ใกล้กำหนด',v:stats.due_soon,c:'var(--warning)',f:'due_soon'},{l:'🟢 ปกติ',v:stats.ok,c:'var(--success)',f:'ok'}].map(({l,v,c,f})=>(
        <div key={l}className="card"onClick={()=>setFilter(filter===f?'':f)}style={{cursor:'pointer',border:`1px solid ${filter===f?'var(--accent)':'var(--border)'}`}}>
          <div className="stat-label">{l}</div><div className="stat-value"style={{fontSize:26,color:c||'var(--text-primary)'}}>{v}</div>
        </div>
      ))}
    </div>

    {/* Table */}
    {loading?<div>{[...Array(4)].map((_,i)=><div key={i}className="card mb-2"><div className="skeleton"style={{height:60}}/></div>)}</div>:
    displayed.length===0?<div className="card"style={{textAlign:'center',padding:40}}><p style={{fontSize:14,color:'var(--text-muted)'}}>ไม่พบแผน PM{filter?` ที่มีสถานะ "${filter}"`:''}</p>{isAdmin&&<button className="btn btn-primary"style={{marginTop:16}}onClick={()=>{resetCreate();setShowCreate(true);}}>สร้างแผน PM แรก</button>}</div>:
    <div className="table-wrapper"><table>
      <thead><tr><th>ชื่อแผน PM</th><th>อุปกรณ์</th><th>ความถี่</th><th>ครั้งล่าสุด</th><th>ครั้งถัดไป</th><th>สถานะ</th><th>ชั่วโมง</th><th>Actions</th></tr></thead>
      <tbody>
        {displayed.map(s=>{
          const diff=daysDiff(s.next_due_date);
          return<tr key={s.id}>
            <td>
              <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{s.name}</div>
              {s.description&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{s.description.slice(0,50)}</div>}
              {s.tasks?.length>0&&<div style={{fontSize:11,color:'var(--accent)',marginTop:2}}>{s.tasks.length} tasks</div>}
            </td>
            <td><div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{s.equipment_name}</div><div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{s.asset_code}</div></td>
            <td style={{fontSize:12,color:'var(--text-secondary)'}}>{freqLabel(s.frequency_type,s.frequency_value)}</td>
            <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.last_done_date?new Date(s.last_done_date).toLocaleDateString('th-TH'):'ยังไม่เคยทำ'}</td>
            <td>
              <div style={{fontSize:12,fontWeight:600,color:statusColor[s.status]||'var(--text-muted)'}}>
                {s.next_due_date?new Date(s.next_due_date).toLocaleDateString('th-TH'):'—'}
              </div>
              {diff!==null&&<div style={{fontSize:11,color:statusColor[s.status]}}>{diff<0?`เกิน ${Math.abs(diff)} วัน`:diff===0?'วันนี้':`อีก ${diff} วัน`}</div>}
            </td>
            <td><span style={{fontSize:12,fontWeight:700,color:statusColor[s.status]}}>{statusLabel[s.status]||s.status}</span></td>
            <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.estimated_hours?`${s.estimated_hours}h`:'—'}</td>
            <td>
              <div className="flex gap-1">
                <button onClick={()=>{setShowDetail(s);}}className="btn btn-secondary"style={{padding:'3px 8px',fontSize:11}}>ดู</button>
                <button onClick={()=>{setShowComplete(s);setDoneDate(new Date().toISOString().slice(0,10));setDoneNotes('');setCreateWO(true);setError('');}}className="btn btn-primary"style={{padding:'3px 8px',fontSize:11}}>✓ เสร็จ</button>
                {isAdmin&&<button onClick={()=>deactivate(s)}className="btn btn-danger"style={{padding:'3px 8px',fontSize:11}}>ปิด</button>}
              </div>
            </td>
          </tr>;
        })}
      </tbody></table></div>}

    {/* Modal: Create PM */}
    {showCreate&&<Modal title="🛡 สร้างแผน PM ใหม่"onClose={()=>{setShowCreate(false);resetCreate();}}>
      <div style={{marginBottom:14}}>
        <label style={SL}>อุปกรณ์ <span style={{color:'var(--danger)'}}>*</span></label>
        <select style={SI}value={ceqId}onChange={e=>setCeqId(e.target.value)}>
          <option value="">-- เลือกอุปกรณ์ --</option>
          {equipment.map(eq=><option key={eq.id}value={eq.id}>[{eq.asset_code}] {eq.name}</option>)}
        </select>
      </div>
      <div style={{marginBottom:14}}>
        <label style={SL}>ชื่อแผน PM <span style={{color:'var(--danger)'}}>*</span></label>
        <input style={SI}value={cname}onChange={e=>setCname(e.target.value)}placeholder="เช่น เปลี่ยนน้ำมันหล่อลื่น, ตรวจสอบประจำเดือน"/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={SL}>รายละเอียด</label>
        <textarea style={{...SI,minHeight:60,resize:'vertical',fontFamily:'inherit'}}value={cdesc}onChange={e=>setCdesc(e.target.value)}placeholder="รายละเอียดงานบำรุงรักษา..."/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <div>
          <label style={SL}>ประเภทความถี่ <span style={{color:'var(--danger)'}}>*</span></label>
          <select style={SI}value={cfreqType}onChange={e=>setCfreqType(e.target.value)}>
            <option value="daily">รายวัน</option>
            <option value="weekly">รายสัปดาห์</option>
            <option value="monthly">รายเดือน</option>
            <option value="quarterly">รายไตรมาส</option>
            <option value="yearly">รายปี</option>
          </select>
        </div>
        <div>
          <label style={SL}>ทุกๆ (จำนวน)</label>
          <input type="number"style={SI}value={cfreqVal}onChange={e=>setCfreqVal(e.target.value)}min="1"placeholder="1"/>
        </div>
        <div>
          <label style={SL}>ชั่วโมงประมาณ</label>
          <input type="number"style={SI}value={cestHrs}onChange={e=>setCestHrs(e.target.value)}min="0.5"step="0.5"placeholder="2.5"/>
        </div>
        <div>
          <label style={SL}>วันที่ครบกำหนดครั้งแรก <span style={{color:'var(--danger)'}}>*</span></label>
          <input type="date"style={SI}value={cnextDate}onChange={e=>setCnextDate(e.target.value)}/>
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={SL}>รายการงาน (หนึ่งบรรทัดต่อหนึ่งงาน)</label>
        <textarea style={{...SI,minHeight:80,resize:'vertical',fontFamily:'var(--mono)',fontSize:12}}value={ctasks}onChange={e=>setCtasks(e.target.value)}placeholder={"ตรวจสอบระดับน้ำมัน\nทำความสะอาดฟิลเตอร์\nวัดความสั่นสะเทือน"}/>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>{setShowCreate(false);resetCreate();}}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitCreate}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังสร้าง...':'✓ สร้างแผน PM'}</button>
      </div>
    </Modal>}

    {/* Modal: Mark Complete */}
    {showComplete&&<Modal title={`✓ บันทึกการเสร็จสิ้น — ${showComplete.name}`}onClose={()=>{setShowComplete(null);setError('');}}>
      <div style={{background:'var(--bg-base)',borderRadius:8,padding:12,marginBottom:16,fontSize:13}}>
        <div className="flex justify-between" style={{marginBottom:6}}><span style={{color:'var(--text-muted)'}}>อุปกรณ์:</span><span style={{fontWeight:600}}>{showComplete.equipment_name}</span></div>
        <div className="flex justify-between" style={{marginBottom:6}}><span style={{color:'var(--text-muted)'}}>ความถี่:</span><span>{freqLabel(showComplete.frequency_type,showComplete.frequency_value)}</span></div>
        <div className="flex justify-between"><span style={{color:'var(--text-muted)'}}>กำหนดครั้งถัดไปจะ:</span><span style={{color:'var(--accent)'}}>คำนวณอัตโนมัติ</span></div>
      </div>
      {showComplete.tasks?.length>0&&<div style={{marginBottom:14}}>
        <label style={SL}>รายการงาน ({showComplete.tasks.length} รายการ)</label>
        <div style={{background:'var(--bg-base)',borderRadius:6,padding:'8px 12px'}}>
          {showComplete.tasks.map((t,i)=><div key={i}style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',fontSize:13,borderBottom:'1px solid var(--border)',color:'var(--text-secondary)'}}>
            <span style={{fontSize:16}}>☐</span>{t.description||t}
          </div>)}
        </div>
      </div>}
      <div style={{marginBottom:14}}>
        <label style={SL}>วันที่เสร็จสิ้น <span style={{color:'var(--danger)'}}>*</span></label>
        <input type="date"style={SI}value={doneDate}onChange={e=>setDoneDate(e.target.value)}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={SL}>หมายเหตุ / ผลการตรวจสอบ</label>
        <textarea style={{...SI,minHeight:70,resize:'vertical',fontFamily:'inherit'}}value={doneNotes}onChange={e=>setDoneNotes(e.target.value)}placeholder="สภาพอุปกรณ์, สิ่งที่พบ, การดำเนินการ..."/>
      </div>
      <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'rgba(59,130,246,.08)',borderRadius:8,border:'1px solid rgba(59,130,246,.2)'}}>
        <input type="checkbox"id="createWO"checked={createWO}onChange={e=>setCreateWO(e.target.checked)}style={{width:16,height:16,cursor:'pointer'}}/>
        <label htmlFor="createWO"style={{fontSize:13,color:'var(--text-primary)',cursor:'pointer'}}>สร้าง Work Order บันทึกการทำงานนี้ด้วย</label>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>{setShowComplete(null);setError('');}}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitComplete}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ บันทึกเสร็จสิ้น'}</button>
      </div>
    </Modal>}

    {/* Modal: Detail */}
    {showDetail&&<Modal title={`📋 ${showDetail.name}`}onClose={()=>setShowDetail(null)}>
      <div style={{display:'grid',gap:8,marginBottom:16}}>
        {[['อุปกรณ์',showDetail.equipment_name+' ('+showDetail.asset_code+')'],['ความถี่',freqLabel(showDetail.frequency_type,showDetail.frequency_value)],['ชั่วโมงประมาณ',showDetail.estimated_hours?showDetail.estimated_hours+'h':'—'],['ทำครั้งล่าสุด',showDetail.last_done_date?new Date(showDetail.last_done_date).toLocaleDateString('th-TH'):'ยังไม่เคยทำ'],['ครบกำหนดครั้งถัดไป',showDetail.next_due_date?new Date(showDetail.next_due_date).toLocaleDateString('th-TH'):'—'],['สถานะ',statusLabel[showDetail.status]||showDetail.status]].map(([l,v])=>(
          <div key={l}style={{display:'flex',gap:16,padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
            <span style={{color:'var(--text-muted)',minWidth:140}}>{l}</span>
            <span style={{color:'var(--text-primary)',fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      {showDetail.description&&<div style={{marginBottom:16,padding:12,background:'var(--bg-base)',borderRadius:8,fontSize:13,color:'var(--text-secondary)',lineHeight:1.6}}>{showDetail.description}</div>}
      {showDetail.tasks?.length>0&&<div>
        <div style={{fontSize:12,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>รายการงาน ({showDetail.tasks.length})</div>
        {showDetail.tasks.map((t,i)=><div key={i}style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13,color:'var(--text-primary)'}}>
          <span style={{color:'var(--success)',fontSize:16}}>☐</span>{t.description||t}
        </div>)}
      </div>}
      <div style={{marginTop:16,display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button onClick={()=>setShowDetail(null)}className="btn btn-secondary">ปิด</button>
        <button onClick={()=>{setShowComplete(showDetail);setShowDetail(null);setDoneDate(new Date().toISOString().slice(0,10));setDoneNotes('');setCreateWO(true);setError('');}}className="btn btn-primary">✓ บันทึกเสร็จสิ้น</button>
      </div>
    </Modal>}
  </div>);
}
