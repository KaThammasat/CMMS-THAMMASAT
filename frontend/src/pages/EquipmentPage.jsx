import React,{useState,useEffect,useCallback}from'react';
import{Link}from'react-router-dom';
import api from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};
const Sk=()=><div className="skeleton"style={{height:16}}/>;

function Modal({title,onClose,children,width=580}){
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

const TYPES=['cnc','pump','compressor','conveyor','motor','hydraulic','pneumatic','other'];
const CRITS=['critical','high','medium','low'];

function EqForm({init={},onSave,onCancel,saving,error}){
  const[code,setCode]=useState(init.asset_code||'');
  const[name,setName]=useState(init.name||'');
  const[type,setType]=useState(init.type||'cnc');
  const[crit,setCrit]=useState(init.criticality||'medium');
  const[mfr,setMfr]=useState(init.manufacturer||'');
  const[model,setModel]=useState(init.model||'');
  const[serial,setSerial]=useState(init.serial_number||'');
  const[cpm,setCpm]=useState(init.cost_per_minute||'');
  const[hs,setHs]=useState(init.health_score||100);
  const[installDate,setInstallDate]=useState(init.install_date?init.install_date.slice(0,10):'');
  const isEdit=!!init.id;
  return(<>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
      <div><label style={SL}>รหัสอุปกรณ์ *</label><input style={SI}value={code}onChange={e=>setCode(e.target.value)}placeholder="CNC-003"disabled={isEdit}/></div>
      <div><label style={SL}>ชื่ออุปกรณ์ *</label><input style={SI}value={name}onChange={e=>setName(e.target.value)}placeholder="CNC Machining Center #3"/></div>
      <div><label style={SL}>ประเภท *</label>
        <select style={SI}value={type}onChange={e=>setType(e.target.value)}>
          {TYPES.map(t=><option key={t}value={t}>{t.toUpperCase()}</option>)}
        </select>
      </div>
      <div><label style={SL}>ระดับความสำคัญ *</label>
        <select style={SI}value={crit}onChange={e=>setCrit(e.target.value)}>
          {CRITS.map(c=><option key={c}value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
        </select>
      </div>
      <div><label style={SL}>ผู้ผลิต</label><input style={SI}value={mfr}onChange={e=>setMfr(e.target.value)}placeholder="Mazak, Grundfos..."/></div>
      <div><label style={SL}>รุ่น</label><input style={SI}value={model}onChange={e=>setModel(e.target.value)}placeholder="VARIAXIS i-700"/></div>
      <div><label style={SL}>Serial Number</label><input style={SI}value={serial}onChange={e=>setSerial(e.target.value)}/></div>
      <div><label style={SL}>ต้นทุน/นาที (฿)</label><input type="number"style={SI}value={cpm}onChange={e=>setCpm(e.target.value)}min="0"/></div>
      <div><label style={SL}>Health Score (%)</label><input type="number"style={SI}value={hs}onChange={e=>setHs(e.target.value)}min="0"max="100"/></div>
      <div><label style={SL}>วันที่ติดตั้ง</label><input type="date"style={SI}value={installDate}onChange={e=>setInstallDate(e.target.value)}/></div>
    </div>
    {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:10,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6}}>⚠ {error}</div>}
    <div className="flex gap-2 justify-between">
      <button onClick={onCancel}className="btn btn-secondary">ยกเลิก</button>
      <button onClick={()=>onSave({asset_code:code,name,type,criticality:crit,manufacturer:mfr||undefined,model:model||undefined,serial_number:serial||undefined,cost_per_minute:parseFloat(cpm)||0,health_score:parseInt(hs)||100,install_date:installDate||undefined})}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ บันทึก'}</button>
    </div>
  </>);
}

const critColor={critical:'var(--danger)',high:'var(--orange)',medium:'var(--warning)',low:'var(--success)'};
const hBar=(s)=>{const c=s>=80?'var(--success)':s>=60?'var(--warning)':'var(--danger)';return<div style={{height:4,background:'var(--bg-elevated)',borderRadius:2,marginTop:4}}><div style={{height:'100%',width:`${s}%`,background:c,borderRadius:2}}/></div>;};

export default function EquipmentPage(){
  const[equip,setEquip]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[critFilter,setCritFilter]=useState('');
  const[modal,setModal]=useState(null);
  const[selected,setSelected]=useState(null);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.get('/equipment',{params:{search:search||undefined,criticality:critFilter||undefined,limit:50}});setEquip(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[search,critFilter]);

  useEffect(()=>{const t=setTimeout(load,300);return()=>clearTimeout(t);},[load]);

  const openAdd=()=>{setSelected(null);setError('');setModal('add');};
  const openEdit=(e)=>{setSelected(e);setError('');setModal('edit');};

  const handleSave=async(data)=>{
    if(!data.asset_code?.trim()||!data.name?.trim()){setError('รหัสและชื่ออุปกรณ์จำเป็น');return;}
    setSaving(true);setError('');
    try{
      if(modal==='add') await api.post('/equipment',data);
      else await api.patch('/equipment/'+selected.id,data);
      setModal(null);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const handleDelete=async(e)=>{
    if(!window.confirm(`ลบ "${e.name}" (${e.asset_code})?\n\nจะไม่สามารถยกเลิกได้ และต้องไม่มีใบสั่งงานที่ active อยู่`))return;
    try{await api.delete('/equipment/'+e.id);load();}
    catch(err){alert(err.response?.data?.error||err.message);}
  };

  const total=equip.length, critical=equip.filter(e=>e.criticality==='critical').length;
  const alerts=equip.filter(e=>(e.health_score||100)<70).length;
  const downtime=equip.filter(e=>+e.active_downtime_count>0).length;

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">⚙ อุปกรณ์</h1><p className="page-sub">{total} เครื่อง · {critical} วิกฤต · {alerts} แจ้งเตือน</p></div>
      <button className="btn btn-primary"onClick={openAdd}>+ เพิ่มอุปกรณ์</button>
    </div>

    <div className="grid-4 mb-4">
      {[{l:'ทั้งหมด',v:total},{l:'วิกฤต',v:critical,c:'var(--danger)'},{l:'แจ้งเตือน Health',v:alerts,c:'var(--warning)'},{l:'หยุดเดินเครื่อง',v:downtime,c:downtime>0?'var(--danger)':'var(--success)'}].map(({l,v,c})=>(
        <div key={l}className="card"><div className="stat-label">{l}</div><div className="stat-value"style={{fontSize:24,color:c||'var(--text-primary)'}}>{v}</div></div>
      ))}
    </div>

    <div className="flex gap-2 mb-4"style={{flexWrap:'wrap'}}>
      <input value={search}onChange={e=>setSearch(e.target.value)}placeholder="ค้นหาอุปกรณ์..."style={{flex:1,minWidth:180,...SI,height:34,padding:'4px 10px'}}/>
      {['','critical','high','medium','low'].map(c=>(
        <button key={c}onClick={()=>setCritFilter(c)}className={`btn btn-${critFilter===c?'primary':'secondary'}`}style={{fontSize:12,padding:'4px 12px'}}>
          {c||'ทั้งหมด'}
        </button>
      ))}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
      {loading?[...Array(4)].map((_,i)=><div key={i}className="card"><Sk/></div>):
      equip.length===0?<div className="card"style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:'var(--text-muted)'}}>ไม่พบอุปกรณ์</div>:
      equip.map(e=>(
        <div key={e.id}className="card"style={{border:`1px solid ${critColor[e.criticality]||'var(--border)'}22`,position:'relative'}}>
          <div className="flex justify-between items-start"style={{marginBottom:10}}>
            <div>
              <Link to={`/equipment/${e.id}`}style={{fontWeight:700,color:'var(--text-primary)',fontSize:15,textDecoration:'none'}}>{e.name}</Link>
              <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)',marginTop:2}}>{e.asset_code}</div>
            </div>
            <span className={`badge badge-${e.criticality}`}style={{fontSize:10}}>{e.criticality?.toUpperCase()}</span>
          </div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>
            {e.manufacturer&&<span>{e.manufacturer} {e.model}</span>}
          </div>
          <div style={{fontSize:12,marginBottom:2,display:'flex',justifyContent:'space-between'}}>
            <span style={{color:'var(--text-muted)'}}>Health Score</span>
            <span style={{fontWeight:700,color:(e.health_score||100)>=80?'var(--success)':(e.health_score||100)>=60?'var(--warning)':'var(--danger)'}}>{e.health_score||100}%</span>
          </div>
          {hBar(e.health_score||100)}
          <div className="flex gap-2"style={{marginTop:12}}>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>📋 {e.active_wo_count||0} WO</span>
            {+e.active_downtime_count>0&&<span style={{fontSize:11,color:'var(--danger)'}}>● หยุด</span>}
            {e.risk_score&&<span style={{fontSize:11,color:'var(--warning)'}}>⚠ Risk:{e.risk_score}%</span>}
          </div>
          <div className="flex gap-1"style={{marginTop:10}}>
            <Link to={`/equipment/${e.id}`}className="btn btn-secondary"style={{padding:'4px 8px',fontSize:11,flex:1,textAlign:'center'}}>ดูรายละเอียด</Link>
            <button onClick={()=>openEdit(e)}className="btn btn-secondary"style={{padding:'4px 8px',fontSize:11}}>✏</button>
            <button onClick={()=>handleDelete(e)}className="btn btn-danger"style={{padding:'4px 8px',fontSize:11}}>🗑</button>
          </div>
        </div>
      ))}
    </div>

    {modal==='add'&&<Modal title="⚙ เพิ่มอุปกรณ์ใหม่"onClose={()=>setModal(null)}>
      <EqForm onSave={handleSave}onCancel={()=>setModal(null)}saving={saving}error={error}/></Modal>}
    {modal==='edit'&&selected&&<Modal title={`✏ แก้ไข — ${selected.name}`}onClose={()=>setModal(null)}>
      <EqForm init={selected}onSave={handleSave}onCancel={()=>setModal(null)}saving={saving}error={error}/></Modal>}
  </div>);
}
