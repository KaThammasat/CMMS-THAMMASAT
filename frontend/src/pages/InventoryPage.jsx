import React,{useEffect,useState,useCallback}from'react';
import api from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};
const Sk=({h=16})=><div className="skeleton"style={{height:h,marginBottom:4}}/>;

function Modal({title,onClose,children,width=540}){
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

function PartForm({init={},onSave,onCancel,saving,error}){
  const[pn,setPn]=useState(init.part_number||'');
  const[pname,setPname]=useState(init.name||'');
  const[cat,setCat]=useState(init.category||'');
  const[cost,setCost]=useState(init.unit_cost||'');
  const[qty,setQty]=useState(init.quantity_on_hand??0);
  const[min,setMin]=useState(init.min_stock||0);
  const[rpt,setRpt]=useState(init.reorder_point||0);
  const[rqty,setRqty]=useState(init.reorder_quantity||0);
  const[sup,setSup]=useState(init.supplier||'');
  const isEdit=!!init.id;
  return(<>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
      <div><label style={SL}>รหัสอะไหล่ *</label><input style={SI}value={pn}onChange={e=>setPn(e.target.value)}placeholder="BRG-6205-2RS"disabled={isEdit}/></div>
      <div><label style={SL}>ชื่ออะไหล่ *</label><input style={SI}value={pname}onChange={e=>setPname(e.target.value)}placeholder="Deep Groove Ball Bearing"/></div>
      <div><label style={SL}>หมวดหมู่</label><input style={SI}value={cat}onChange={e=>setCat(e.target.value)}placeholder="Bearings, Seals, Filters..."/></div>
      <div><label style={SL}>ราคา/หน่วย (฿) *</label><input type="number"style={SI}value={cost}onChange={e=>setCost(e.target.value)}min="0"/></div>
      {!isEdit&&<div><label style={SL}>จำนวนเริ่มต้น</label><input type="number"style={SI}value={qty}onChange={e=>setQty(e.target.value)}min="0"/></div>}
      <div><label style={SL}>Stock ขั้นต่ำ</label><input type="number"style={SI}value={min}onChange={e=>setMin(e.target.value)}min="0"/></div>
      <div><label style={SL}>จุด Reorder</label><input type="number"style={SI}value={rpt}onChange={e=>setRpt(e.target.value)}min="0"/></div>
      <div><label style={SL}>จำนวน Reorder</label><input type="number"style={SI}value={rqty}onChange={e=>setRqty(e.target.value)}min="0"/></div>
    </div>
    <div style={{marginBottom:14}}><label style={SL}>Supplier</label><input style={SI}value={sup}onChange={e=>setSup(e.target.value)}placeholder="SKF Thailand, NSK..."/></div>
    {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:10,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6}}>⚠ {error}</div>}
    <div className="flex gap-2 justify-between">
      <button onClick={onCancel}className="btn btn-secondary">ยกเลิก</button>
      <button onClick={()=>onSave({part_number:pn,name:pname,category:cat||undefined,unit_cost:parseFloat(cost)||0,quantity_on_hand:parseInt(qty)||0,min_stock:parseInt(min)||0,reorder_point:parseInt(rpt)||0,reorder_quantity:parseInt(rqty)||0,supplier:sup||undefined})}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ บันทึก'}</button>
    </div>
  </>);
}

export default function InventoryPage(){
  const[parts,setParts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState('');
  const[search,setSearch]=useState('');
  const[modal,setModal]=useState(null); // 'add'|'edit'|'receive'|'adjust'
  const[selected,setSelected]=useState(null);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[rcvQty,setRcvQty]=useState('');
  const[adjQty,setAdjQty]=useState('');
  const[adjReason,setAdjReason]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.get('/inventory',{params:{low_stock:filter==='low'||undefined,search:search||undefined,limit:100}});setParts(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[filter,search]);

  useEffect(()=>{const t=setTimeout(load,300);return()=>clearTimeout(t);},[load]);

  const openEdit=(p)=>{setSelected(p);setError('');setModal('edit');};
  const openReceive=(p)=>{setSelected(p);setRcvQty('');setError('');setModal('receive');};
  const openAdjust=(p)=>{setSelected(p);setAdjQty('');setAdjReason('');setError('');setModal('adjust');};

  const handleSave=async(data)=>{
    if(!data.part_number?.trim()||!data.name?.trim()){setError('รหัสและชื่ออะไหล่จำเป็น');return;}
    setSaving(true);setError('');
    try{
      if(modal==='add') await api.post('/inventory',data);
      else await api.patch('/inventory/'+selected.id,data);
      setModal(null);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const handleReceive=async()=>{
    if(!rcvQty||+rcvQty<=0){setError('จำนวนต้องมากกว่า 0');return;}
    setSaving(true);setError('');
    try{await api.post('/inventory/'+selected.id+'/receive',{quantity:parseFloat(rcvQty)});setModal(null);load();}
    catch(e){setError(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  const handleAdjust=async()=>{
    const n=parseFloat(adjQty);
    if(!adjQty||n===0){setError('จำนวนต้องไม่เป็น 0');return;}
    if(!adjReason.trim()){setError('กรุณาระบุเหตุผล');return;}
    setSaving(true);setError('');
    try{await api.post('/inventory/adjust',{part_id:selected.id,quantity:n,reason:adjReason});setModal(null);load();}
    catch(e){setError(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  const handleDelete=async(p)=>{
    if(!window.confirm(`ลบ "${p.name}" (${p.part_number})?\nการกระทำนี้ไม่สามารถยกเลิกได้`))return;
    try{await api.delete('/inventory/'+p.id);load();}
    catch(e){alert(e.response?.data?.error||e.message);}
  };

  const totalVal=parts.reduce((s,p)=>s+Number(p.inventory_value||0),0);
  const lowCount=parts.filter(p=>p.needs_reorder).length;

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">📦 คลังอะไหล่</h1><p className="page-sub">{parts.length} รายการ · มูลค่ารวม ฿{totalVal.toLocaleString()}</p></div>
      <button className="btn btn-primary"onClick={()=>{setSelected(null);setError('');setModal('add');}}>+ เพิ่มอะไหล่</button>
    </div>

    <div className="grid-3 mb-4">
      {[{l:'รายการทั้งหมด',v:parts.length},{l:'⚠ ต้องสั่งซื้อ',v:lowCount,c:lowCount>0?'var(--warning)':'var(--success)'},{l:'มูลค่ารวม',v:`฿${totalVal.toLocaleString()}`,c:'var(--accent)'}].map(({l,v,c})=>(
        <div key={l}className="card"><div className="stat-label">{l}</div><div className="stat-value"style={{color:c||'var(--text-primary)',fontSize:22}}>{v}</div></div>
      ))}
    </div>

    <div className="flex gap-2 mb-4"style={{flexWrap:'wrap'}}>
      {[['','ทั้งหมด'],['low','⚠ ต้องสั่งซื้อ']].map(([v,l])=>(
        <button key={v}onClick={()=>setFilter(v)}className={`btn btn-${filter===v?'primary':'secondary'}`}style={{fontSize:12}}>{l}</button>
      ))}
      <input value={search}onChange={e=>setSearch(e.target.value)}placeholder="ค้นหาชื่อ/รหัส..."style={{flex:1,minWidth:150,...SI,height:34,padding:'4px 10px'}}/>
    </div>

    <div className="table-wrapper"><table>
      <thead><tr><th>รหัส</th><th>ชื่ออะไหล่</th><th>หมวด</th><th>คงเหลือ</th><th>ขั้นต่ำ</th><th>ราคา/หน่วย</th><th>มูลค่า</th><th>สถานะ</th><th>Actions</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(9)].map((_,j)=><td key={j}><Sk/></td>)}</tr>):
        parts.length===0?<tr><td colSpan={9}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>ไม่พบรายการ</td></tr>:
        parts.map(p=><tr key={p.id}>
          <td className="mono"style={{color:'var(--accent)',fontSize:12}}>{p.part_number}</td>
          <td style={{fontWeight:500,color:'var(--text-primary)'}}>{p.name}</td>
          <td style={{color:'var(--text-muted)',fontSize:12}}>{p.category||'—'}</td>
          <td style={{fontWeight:700,color:p.needs_reorder?'var(--danger)':'var(--success)'}}>{p.quantity_on_hand}</td>
          <td style={{color:'var(--text-muted)'}}>{p.min_stock}</td>
          <td style={{color:'var(--text-secondary)'}}>฿{Number(p.unit_cost||0).toLocaleString()}</td>
          <td style={{color:'var(--text-secondary)'}}>฿{Number(p.inventory_value||0).toLocaleString()}</td>
          <td><span className={`badge badge-${p.needs_reorder?'critical':'completed'}`}>{p.needs_reorder?'ต้องสั่งซื้อ':'ปกติ'}</span></td>
          <td>
            <div className="flex gap-1"style={{flexWrap:'nowrap'}}>
              <button onClick={()=>openReceive(p)}className="btn btn-secondary"style={{padding:'3px 7px',fontSize:11}}>+รับเข้า</button>
              <button onClick={()=>openAdjust(p)}className="btn btn-secondary"style={{padding:'3px 7px',fontSize:11}}>ปรับ</button>
              <button onClick={()=>openEdit(p)}className="btn btn-secondary"style={{padding:'3px 7px',fontSize:11}}>แก้ไข</button>
              <button onClick={()=>handleDelete(p)}className="btn btn-danger"style={{padding:'3px 7px',fontSize:11}}>ลบ</button>
            </div>
          </td>
        </tr>)}
      </tbody></table></div>

    {modal==='add'&&<Modal title="➕ เพิ่มอะไหล่ใหม่"onClose={()=>setModal(null)}>
      <PartForm onSave={handleSave}onCancel={()=>setModal(null)}saving={saving}error={error}/></Modal>}
    {modal==='edit'&&selected&&<Modal title={`✏ แก้ไข — ${selected.name}`}onClose={()=>setModal(null)}>
      <PartForm init={selected}onSave={handleSave}onCancel={()=>setModal(null)}saving={saving}error={error}/></Modal>}
    {modal==='receive'&&selected&&<Modal title={`📥 รับเข้า — ${selected.name}`}onClose={()=>setModal(null)}width={420}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:12}}>คงเหลือ: <strong style={{color:'var(--text-primary)'}}>{selected.quantity_on_hand}</strong> ชิ้น</p>
      <label style={SL}>จำนวนที่รับ *</label>
      <input type="number"style={{...SI,marginBottom:12}}value={rcvQty}onChange={e=>setRcvQty(e.target.value)}placeholder="10"min="1"autoFocus/>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:10,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={handleReceive}disabled={saving}className="btn btn-primary">{saving?'⏳...':'✓ รับเข้าคลัง'}</button>
      </div>
    </Modal>}
    {modal==='adjust'&&selected&&<Modal title={`🔄 ปรับสต็อก — ${selected.name}`}onClose={()=>setModal(null)}width={420}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:12}}>คงเหลือ: <strong style={{color:'var(--text-primary)'}}>{selected.quantity_on_hand}</strong> ชิ้น</p>
      <label style={SL}>จำนวน (+เพิ่ม / -ลด) *</label>
      <input type="number"style={{...SI,marginBottom:10}}value={adjQty}onChange={e=>setAdjQty(e.target.value)}placeholder="-3 หรือ +5"autoFocus/>
      <label style={SL}>เหตุผล *</label>
      <input style={{...SI,marginBottom:12}}value={adjReason}onChange={e=>setAdjReason(e.target.value)}placeholder="ใช้ซ่อม CNC-001, สูญหาย, ตรวจนับ..."/>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:10,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={handleAdjust}disabled={saving}className="btn btn-primary">{saving?'⏳...':'✓ ปรับสต็อก'}</button>
      </div>
    </Modal>}
  </div>);
}
