import React,{useState,useEffect,useCallback}from'react';
import{Link}from'react-router-dom';
import{equipmentAPI}from'../utils/api';
import api from'../utils/api';

const hc=s=>s>=80?'var(--success)':s>=60?'var(--warning)':'var(--danger)';
const S={input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},label:{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4}};

function Modal({title,onClose,children,width=520}){
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

function Field({label,value,onChange,type='text',options,required,placeholder}){
  return<div style={{marginBottom:14}}>
    <label style={S.label}>{label}{required&&<span style={{color:'var(--danger)'}}>*</span>}</label>
    {options
      ?<select value={value}onChange={e=>onChange(e.target.value)}style={S.input}>
        {options.map(o=><option key={o.value||o}value={o.value||o}>{o.label||o}</option>)}
      </select>
      :<input type={type}value={value||''}onChange={e=>onChange(e.target.value)}placeholder={placeholder}style={S.input}/>
    }
  </div>;
}

export default function EquipmentPage(){
  const[equipment,setEquipment]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[crit,setCrit]=useState('');
  const[showModal,setShowModal]=useState(false);
  const[form,setForm]=useState({asset_code:'',name:'',type:'cnc',criticality:'medium',manufacturer:'',model:'',location_code:'CNC-BAY-1',cost_per_minute:0});
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await equipmentAPI.list({search:search||undefined,criticality:crit||undefined});setEquipment(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[search,crit]);

  useEffect(()=>{const t=setTimeout(load,300);return()=>clearTimeout(t);},[load]);

  const f=v=>setForm(p=>({...p,...v}));

  const submit=async()=>{
    if(!form.asset_code||!form.name){setError('รหัสอุปกรณ์และชื่อจำเป็น');return;}
    setSaving(true);setError('');
    try{
      // Get location_id from first location
      const locs=await api.get('/equipment').then(r=>r.data?.data);
      // Use default location from existing equipment
      const locId=locs?.[0]?.location_id;
      if(!locId)throw new Error('ไม่พบข้อมูลสถานที่ในระบบ');
      await api.post('/equipment',{...form,location_id:locId,cost_per_minute:parseFloat(form.cost_per_minute)||0});
      setShowModal(false);
      setForm({asset_code:'',name:'',type:'cnc',criticality:'medium',manufacturer:'',model:'',cost_per_minute:0});
      load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const stats={total:equipment.length,critical:equipment.filter(e=>e.criticality==='critical').length,alerts:equipment.filter(e=>e.health_score<70).length,downtime:equipment.filter(e=>e.active_downtime>0).length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">Equipment</h1><p className="page-sub">{stats.total} assets · {stats.critical} critical · {stats.alerts} health alerts</p></div>
      <button className="btn btn-primary"onClick={()=>{setShowModal(true);setError('');}}>+ Add Equipment</button>
    </div>

    <div className="grid-4 mb-6">
      {[{l:'Total Assets',v:stats.total},{l:'Critical Assets',v:stats.critical,c:'var(--danger)'},{l:'Health Alerts',v:stats.alerts,c:stats.alerts>0?'var(--warning)':'var(--success)'},{l:'Active Downtime',v:stats.downtime,c:stats.downtime>0?'var(--danger)':'var(--success)'}].map(({l,v,c})=>(
        <div key={l}className="card"><div className="stat-label">{l}</div><div className="stat-value"style={{color:c||'var(--text-primary)'}}>{v}</div></div>
      ))}
    </div>

    <div className="flex gap-2 mb-4"style={{flexWrap:'wrap'}}>
      <input value={search}onChange={e=>setSearch(e.target.value)}placeholder="Search equipment..."
        style={{flex:1,minWidth:200,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 12px',color:'var(--text-primary)',fontSize:13}}/>
      {['','critical','high','medium','low'].map(v=>(
        <button key={v}onClick={()=>setCrit(v)}className={`btn btn-${crit===v?'primary':'secondary'}`}style={{fontSize:12,padding:'6px 12px'}}>{v||'All Criticality'}</button>
      ))}
    </div>

    {loading?<div className="grid-2">{[...Array(4)].map((_,i)=><div key={i}className="card"><div className="skeleton"style={{height:120}}/></div>)}</div>:
    equipment.length===0?<div className="card"style={{textAlign:'center',padding:40}}><p className="text-muted">No equipment found</p></div>:
    <div className="grid-2">
      {equipment.map(eq=>(
        <Link key={eq.id}to={`/equipment/${eq.id}`}style={{textDecoration:'none'}}>
          <div className="card"style={{cursor:'pointer',border:`1px solid ${eq.criticality==='critical'?'rgba(239,68,68,.3)':'var(--border)'}`,transition:'border-color .15s,transform .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.transform='translateY(-1px)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=eq.criticality==='critical'?'rgba(239,68,68,.3)':'var(--border)';e.currentTarget.style.transform=''}}>
            <div className="flex justify-between items-center"style={{marginBottom:12}}>
              <div className="flex items-center gap-2">
                <span style={{fontSize:18}}>{eq.type==='pump'?'💧':'⚙'}</span>
                <div><div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{eq.name}</div><div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{eq.asset_code}</div></div>
              </div>
              <span className={`badge badge-${eq.criticality}`}>{eq.criticality}</span>
            </div>
            <div className="flex justify-between items-center"style={{marginBottom:6}}>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>Health Score</span>
              <span style={{fontSize:14,fontWeight:700,color:hc(eq.health_score)}}>{eq.health_score}%</span>
            </div>
            <div className="health-bar"style={{marginBottom:12}}><div className="health-bar-fill"style={{width:`${eq.health_score}%`,background:hc(eq.health_score)}}/></div>
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

    {showModal&&<Modal title="เพิ่มอุปกรณ์ใหม่"onClose={()=>setShowModal(false)}>
      <div className="grid-2">
        <Field label="รหัสอุปกรณ์"value={form.asset_code}onChange={v=>f({asset_code:v})}placeholder="CNC-003"required/>
        <Field label="ชื่ออุปกรณ์"value={form.name}onChange={v=>f({name:v})}placeholder="CNC Machining Center #3"required/>
        <Field label="ประเภท"value={form.type}onChange={v=>f({type:v})}options={[{value:'cnc',label:'CNC Machine'},{value:'pump',label:'Pump'},{value:'compressor',label:'Compressor'},{value:'conveyor',label:'Conveyor'},{value:'hvac',label:'HVAC'},{value:'electrical',label:'Electrical'}]}/>
        <Field label="ระดับความสำคัญ"value={form.criticality}onChange={v=>f({criticality:v})}options={[{value:'critical',label:'Critical'},{value:'high',label:'High'},{value:'medium',label:'Medium'},{value:'low',label:'Low'}]}/>
        <Field label="ผู้ผลิต"value={form.manufacturer}onChange={v=>f({manufacturer:v})}placeholder="Mazak, Fanuc, etc."/>
        <Field label="รุ่น"value={form.model}onChange={v=>f({model:v})}placeholder="VARIAXIS i-700"/>
        <Field label="ต้นทุนต่อนาที (฿)"type="number"value={form.cost_per_minute}onChange={v=>f({cost_per_minute:v})}placeholder="850"/>
        <Field label="Serial Number"value={form.serial_number}onChange={v=>f({serial_number:v})}placeholder="SN-2024-001"/>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setShowModal(false)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submit}disabled={saving}className="btn btn-primary">{saving?'กำลังบันทึก...':'เพิ่มอุปกรณ์'}</button>
      </div>
    </Modal>}
  </div>);
}
