import React,{useState,useEffect,useCallback}from'react';
import{Link}from'react-router-dom';
import{equipmentAPI}from'../utils/api';

const hc=s=>s>=80?'var(--success)':s>=60?'var(--warning)':'var(--danger)';

const S={
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16},
  modal:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:560,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'},
  body:{padding:20},
  label:{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:4},
  input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
  row:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14},
  field:{marginBottom:14},
};

function AddModal({onClose,onSave,equipment}){
  const[form,setForm]=useState({asset_code:'',name:'',type:'cnc',criticality:'medium',manufacturer:'',model:'',serial_number:'',cost_per_minute:'850'});
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  const submit=async(e)=>{
    e.preventDefault();
    if(!form.asset_code.trim()||!form.name.trim()){setError('กรุณากรอกรหัสและชื่ออุปกรณ์');return;}
    setSaving(true);setError('');
    try{
      const locId=equipment?.[0]?.location_id;
      if(!locId){setError('ไม่พบข้อมูลสถานที่ กรุณาลองใหม่');setSaving(false);return;}
      await equipmentAPI.create({...form,location_id:locId,cost_per_minute:parseFloat(form.cost_per_minute)||0});
      onSave();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <span style={{fontSize:15,fontWeight:700}}>⚙ เพิ่มอุปกรณ์ใหม่</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>
        <form onSubmit={submit} style={S.body}>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>รหัสอุปกรณ์ *</label>
              <input style={S.input} placeholder="CNC-003" value={form.asset_code} onChange={e=>f('asset_code',e.target.value)} autoFocus/>
            </div>
            <div style={S.field}>
              <label style={S.label}>ชื่ออุปกรณ์ *</label>
              <input style={S.input} placeholder="CNC Machining Center #3" value={form.name} onChange={e=>f('name',e.target.value)}/>
            </div>
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>ประเภท</label>
              <select style={S.input} value={form.type} onChange={e=>f('type',e.target.value)}>
                {[['cnc','CNC Machine'],['pump','Pump'],['compressor','Compressor'],['conveyor','Conveyor'],['hvac','HVAC'],['electrical','Electrical']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>ระดับความสำคัญ</label>
              <select style={S.input} value={form.criticality} onChange={e=>f('criticality',e.target.value)}>
                {['critical','high','medium','low'].map(v=><option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>ผู้ผลิต</label>
              <input style={S.input} placeholder="Mazak, Fanuc, etc." value={form.manufacturer} onChange={e=>f('manufacturer',e.target.value)}/>
            </div>
            <div style={S.field}>
              <label style={S.label}>รุ่น</label>
              <input style={S.input} placeholder="VARIAXIS i-700" value={form.model} onChange={e=>f('model',e.target.value)}/>
            </div>
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>Serial Number</label>
              <input style={S.input} placeholder="SN-2024-001" value={form.serial_number} onChange={e=>f('serial_number',e.target.value)}/>
            </div>
            <div style={S.field}>
              <label style={S.label}>ต้นทุนต่อนาที (฿)</label>
              <input style={S.input} type="number" min="0" placeholder="850" value={form.cost_per_minute} onChange={e=>f('cost_per_minute',e.target.value)}/>
            </div>
          </div>
          {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <button type="button" onClick={onClose} className="btn btn-secondary">ยกเลิก</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving?'กำลังบันทึก...':'✓ เพิ่มอุปกรณ์'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EquipmentPage(){
  const[equipment,setEquipment]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[crit,setCrit]=useState('');
  const[showModal,setShowModal]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await equipmentAPI.list({search:search||undefined,criticality:crit||undefined});setEquipment(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[search,crit]);

  useEffect(()=>{const t=setTimeout(load,300);return()=>clearTimeout(t);},[load]);

  const stats={total:equipment.length,critical:equipment.filter(e=>e.criticality==='critical').length,alerts:equipment.filter(e=>e.health_score<70).length,downtime:equipment.filter(e=>e.active_downtime>0).length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">Equipment</h1><p className="page-sub">{stats.total} assets · {stats.critical} critical · {stats.alerts} health alerts</p></div>
      <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Add Equipment</button>
    </div>

    <div className="grid-4 mb-6">
      {[{l:'Total Assets',v:stats.total},{l:'Critical Assets',v:stats.critical,c:'var(--danger)'},{l:'Health Alerts',v:stats.alerts,c:stats.alerts>0?'var(--warning)':'var(--success)'},{l:'Active Downtime',v:stats.downtime,c:stats.downtime>0?'var(--danger)':'var(--success)'}].map(({l,v,c})=>(
        <div key={l} className="card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:c||'var(--text-primary)'}}>{v}</div></div>
      ))}
    </div>

    <div className="flex gap-2 mb-4" style={{flexWrap:'wrap'}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search equipment..."
        style={{flex:1,minWidth:200,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 12px',color:'var(--text-primary)',fontSize:13}}/>
      {['','critical','high','medium','low'].map(v=>(
        <button key={v} onClick={()=>setCrit(v)} className={`btn btn-${crit===v?'primary':'secondary'}`} style={{fontSize:12,padding:'6px 12px'}}>{v||'All Criticality'}</button>
      ))}
    </div>

    {loading?<div className="grid-2">{[...Array(4)].map((_,i)=><div key={i} className="card"><div className="skeleton" style={{height:120}}/></div>)}</div>:
    equipment.length===0?<div className="card" style={{textAlign:'center',padding:40}}><p className="text-muted">No equipment found</p></div>:
    <div className="grid-2">
      {equipment.map(eq=>(
        <Link key={eq.id} to={`/equipment/${eq.id}`} style={{textDecoration:'none'}}>
          <div className="card" style={{cursor:'pointer',border:`1px solid ${eq.criticality==='critical'?'rgba(239,68,68,.3)':'var(--border)'}`,transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.transform='translateY(-1px)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=eq.criticality==='critical'?'rgba(239,68,68,.3)':'var(--border)';e.currentTarget.style.transform=''}}>
            <div className="flex justify-between items-center" style={{marginBottom:12}}>
              <div className="flex items-center gap-2">
                <span style={{fontSize:18}}>{eq.type==='pump'?'💧':'⚙'}</span>
                <div><div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{eq.name}</div><div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{eq.asset_code}</div></div>
              </div>
              <span className={`badge badge-${eq.criticality}`}>{eq.criticality}</span>
            </div>
            <div className="flex justify-between items-center" style={{marginBottom:6}}>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>Health Score</span>
              <span style={{fontSize:14,fontWeight:700,color:hc(eq.health_score)}}>{eq.health_score}%</span>
            </div>
            <div className="health-bar" style={{marginBottom:12}}><div className="health-bar-fill" style={{width:`${eq.health_score}%`,background:hc(eq.health_score)}}/></div>
            <div className="flex justify-between">
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{eq.location_name||eq.location_code}</div>
              <div className="flex gap-2">
                {eq.open_wo_count>0&&<span style={{fontSize:11,color:'var(--accent)'}}>📋 {eq.open_wo_count} WO</span>}
                {eq.active_downtime>0&&<span style={{fontSize:11,color:'var(--danger)'}}>● Down</span>}
                {eq.risk_score&&<span style={{fontSize:11,color:'var(--warning)'}}>Risk: {Math.round(eq.risk_score)}</span>}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>}

    {showModal&&<AddModal equipment={equipment} onClose={()=>setShowModal(false)} onSave={()=>{setShowModal(false);load();}}/>}
  </div>);
}
