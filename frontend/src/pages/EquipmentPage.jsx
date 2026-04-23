import React,{useState,useEffect,useCallback}from'react';
import{Link}from'react-router-dom';
import{equipmentAPI}from'../utils/api';

const hc=s=>s>=80?'var(--success)':s>=60?'var(--warning)':'var(--danger)';
const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};

function Modal({title,onClose,children}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:560,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

export default function EquipmentPage(){
  const[equipment,setEquipment]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[crit,setCrit]=useState('');
  const[showModal,setShowModal]=useState(false);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[form,setForm]=useState({asset_code:'',name:'',type:'cnc',criticality:'medium',manufacturer:'',model:'',serial_number:'',cost_per_minute:''});

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await equipmentAPI.list({search:search||undefined,criticality:crit||undefined});setEquipment(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[search,crit]);

  useEffect(()=>{const t=setTimeout(load,300);return()=>clearTimeout(t);},[load]);

  const F=(k,v)=>setForm(p=>({...p,[k]:v}));

  const openModal=()=>{
    setForm({asset_code:'',name:'',type:'cnc',criticality:'medium',manufacturer:'',model:'',serial_number:'',cost_per_minute:''});
    setError('');
    setShowModal(true);
  };

  const submit=async()=>{
    if(!form.asset_code.trim()||!form.name.trim()){setError('กรุณากรอกรหัสอุปกรณ์และชื่อ');return;}
    setSaving(true);setError('');
    try{
      // ดึง location_id จากอุปกรณ์ที่มีอยู่แล้ว หรือส่ง null ถ้าไม่มี
      const existing=equipment[0];
      const payload={
        asset_code:form.asset_code.trim(),
        name:form.name.trim(),
        type:form.type,
        criticality:form.criticality,
        manufacturer:form.manufacturer.trim()||undefined,
        model:form.model.trim()||undefined,
        serial_number:form.serial_number.trim()||undefined,
        cost_per_minute:parseFloat(form.cost_per_minute)||0,
        location_id:existing?.location_id||null,
      };
      await equipmentAPI.create(payload);
      setShowModal(false);
      load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const stats={total:equipment.length,critical:equipment.filter(e=>e.criticality==='critical').length,alerts:equipment.filter(e=>e.health_score<70).length,downtime:equipment.filter(e=>e.active_downtime>0).length};

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">Equipment</h1><p className="page-sub">{stats.total} assets · {stats.critical} critical · {stats.alerts} health alerts</p></div>
      <button className="btn btn-primary"onClick={openModal}>+ Add Equipment</button>
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

    {showModal&&<Modal title="➕ เพิ่มอุปกรณ์ใหม่"onClose={()=>setShowModal(false)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={{gridColumn:'1/-1'}}>
          <label style={SL}>รหัสอุปกรณ์ <span style={{color:'var(--danger)'}}>*</span></label>
          <input style={SI}value={form.asset_code}onChange={e=>F('asset_code',e.target.value)}placeholder="เช่น CNC-003, PUMP-003"/>
        </div>
        <div style={{gridColumn:'1/-1'}}>
          <label style={SL}>ชื่ออุปกรณ์ <span style={{color:'var(--danger)'}}>*</span></label>
          <input style={SI}value={form.name}onChange={e=>F('name',e.target.value)}placeholder="เช่น CNC Machining Center #3"/>
        </div>
        <div>
          <label style={SL}>ประเภท</label>
          <select style={SI}value={form.type}onChange={e=>F('type',e.target.value)}>
            <option value="cnc">CNC Machine</option>
            <option value="pump">Pump</option>
            <option value="compressor">Compressor</option>
            <option value="conveyor">Conveyor</option>
            <option value="hvac">HVAC</option>
            <option value="electrical">Electrical</option>
            <option value="robot">Robot</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label style={SL}>ระดับความสำคัญ</label>
          <select style={SI}value={form.criticality}onChange={e=>F('criticality',e.target.value)}>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
        <div>
          <label style={SL}>ผู้ผลิต</label>
          <input style={SI}value={form.manufacturer}onChange={e=>F('manufacturer',e.target.value)}placeholder="เช่น Mazak, Fanuc, SMC"/>
        </div>
        <div>
          <label style={SL}>รุ่น</label>
          <input style={SI}value={form.model}onChange={e=>F('model',e.target.value)}placeholder="เช่น VARIAXIS i-700"/>
        </div>
        <div>
          <label style={SL}>Serial Number</label>
          <input style={SI}value={form.serial_number}onChange={e=>F('serial_number',e.target.value)}placeholder="เช่น SN-2024-001"/>
        </div>
        <div>
          <label style={SL}>ต้นทุนต่อนาที (฿)</label>
          <input type="number"style={SI}value={form.cost_per_minute}onChange={e=>F('cost_per_minute',e.target.value)}placeholder="850"min="0"/>
        </div>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginTop:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between"style={{marginTop:16}}>
        <button onClick={()=>setShowModal(false)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submit}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ เพิ่มอุปกรณ์'}</button>
      </div>
    </Modal>}
  </div>);
}
