import React,{useEffect,useState,useCallback}from'react';
import{inventoryAPI}from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};

function Modal({title,onClose,children}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:540,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer'}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

export default function InventoryPage(){
  const[parts,setParts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState('');
  const[showAdd,setShowAdd]=useState(false);
  const[showReceive,setShowReceive]=useState(null);
  const[showAdjust,setShowAdjust]=useState(null);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  // Add Part fields
  const[pn,setPn]=useState('');
  const[pname,setPname]=useState('');
  const[cat,setCat]=useState('');
  const[cost,setCost]=useState('');
  const[qty,setQty]=useState('0');
  const[minStock,setMinStock]=useState('0');
  const[reorderPt,setReorderPt]=useState('0');
  const[reorderQty,setReorderQty]=useState('0');
  const[supplier,setSupplier]=useState('');
  // Receive fields
  const[rcvQty,setRcvQty]=useState('');
  // Adjust fields
  const[adjQty,setAdjQty]=useState('');
  const[adjReason,setAdjReason]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await inventoryAPI.list({low_stock:filter==='low'||undefined});setParts(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{load();},[load]);

  const resetAddForm=()=>{setPn('');setPname('');setCat('');setCost('');setQty('0');setMinStock('0');setReorderPt('0');setReorderQty('0');setSupplier('');setError('');};

  const submitAdd=async()=>{
    if(!pn.trim()||!pname.trim()){setError('รหัสและชื่ออะไหล่จำเป็น');return;}
    setSaving(true);setError('');
    try{
      await inventoryAPI.create({part_number:pn.trim(),name:pname.trim(),category:cat.trim()||undefined,unit_cost:parseFloat(cost)||0,quantity_on_hand:parseInt(qty)||0,min_stock:parseInt(minStock)||0,reorder_point:parseInt(reorderPt)||0,reorder_quantity:parseInt(reorderQty)||0,supplier:supplier.trim()||undefined});
      setShowAdd(false);resetAddForm();load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const submitReceive=async()=>{
    if(!rcvQty||parseInt(rcvQty)<=0){setError('จำนวนต้องมากกว่า 0');return;}
    setSaving(true);setError('');
    try{await inventoryAPI.receive(showReceive.id,{quantity:parseInt(rcvQty)});setShowReceive(null);setRcvQty('');load();}
    catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const submitAdjust=async()=>{
    const n=parseInt(adjQty);
    if(!adjQty||n===0){setError('จำนวนต้องไม่เป็น 0');return;}
    if(!adjReason.trim()){setError('กรุณาระบุเหตุผล');return;}
    setSaving(true);setError('');
    try{await inventoryAPI.adjust({part_id:showAdjust.id,quantity:n,reason:adjReason.trim()});setShowAdjust(null);setAdjQty('');setAdjReason('');load();}
    catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const displayed=filter==='low'?parts.filter(p=>p.needs_reorder):parts;
  const totalVal=parts.reduce((s,p)=>s+Number(p.inventory_value||0),0);
  const lowCount=parts.filter(p=>p.needs_reorder).length;

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">📦 Spare Parts Inventory</h1><p className="page-sub">Stock levels, reorder points, and valuation</p></div>
      <button className="btn btn-primary"onClick={()=>{resetAddForm();setShowAdd(true);}}>+ Add Part</button>
    </div>

    <div className="grid-3 mb-6">
      {[{l:'Total Parts',v:parts.length},{l:'Low Stock',v:lowCount,c:lowCount>0?'var(--warning)':'var(--success)'},{l:'Total Value',v:`฿${totalVal.toLocaleString()}`,c:'var(--accent)'}].map(({l,v,c})=>(
        <div key={l}className="card"><div className="stat-label">{l}</div><div className="stat-value"style={{color:c||'var(--text-primary)',fontSize:22}}>{v}</div></div>
      ))}
    </div>

    <div className="flex gap-2 mb-4">
      {[['','All Parts'],['low','⚠ Low Stock']].map(([v,l])=>(
        <button key={v}onClick={()=>setFilter(v)}className={`btn btn-${filter===v?'primary':'secondary'}`}style={{fontSize:12,padding:'6px 14px'}}>{l}</button>
      ))}
    </div>

    <div className="table-wrapper"><table>
      <thead><tr><th>Part #</th><th>Name</th><th>Category</th><th>On Hand</th><th>Min</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><div className="skeleton"style={{height:16}}/></td>)}</tr>):
        displayed.length===0?<tr><td colSpan={8}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>ไม่พบรายการอะไหล่</td></tr>:
        displayed.map(p=><tr key={p.id}>
          <td className="mono"style={{color:'var(--accent)'}}>{p.part_number}</td>
          <td style={{color:'var(--text-primary)',fontWeight:500}}>{p.name}</td>
          <td style={{color:'var(--text-muted)'}}>{p.category||'—'}</td>
          <td style={{fontWeight:700,color:p.needs_reorder?'var(--danger)':'var(--success)'}}>{p.quantity_on_hand}</td>
          <td style={{color:'var(--text-muted)'}}>{p.min_stock}</td>
          <td style={{color:'var(--text-secondary)'}}>฿{Number(p.inventory_value||0).toLocaleString()}</td>
          <td><span className={`badge badge-${p.needs_reorder?'critical':'completed'}`}>{p.needs_reorder?'Reorder':'OK'}</span></td>
          <td>
            <div className="flex gap-1">
              <button onClick={()=>{setShowReceive(p);setRcvQty('');setError('');}}className="btn btn-secondary"style={{padding:'3px 8px',fontSize:11}}>+รับเข้า</button>
              <button onClick={()=>{setShowAdjust(p);setAdjQty('');setAdjReason('');setError('');}}className="btn btn-secondary"style={{padding:'3px 8px',fontSize:11}}>ปรับ</button>
            </div>
          </td>
        </tr>)}
      </tbody></table>
    </div>

    {/* Modal: Add Part */}
    {showAdd&&<Modal title="➕ เพิ่มอะไหล่ใหม่"onClose={()=>{setShowAdd(false);resetAddForm();}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <div><label style={SL}>รหัสอะไหล่ <span style={{color:'var(--danger)'}}>*</span></label><input style={SI}value={pn}onChange={e=>setPn(e.target.value)}placeholder="BRG-6205-2RS"/></div>
        <div><label style={SL}>ชื่ออะไหล่ <span style={{color:'var(--danger)'}}>*</span></label><input style={SI}value={pname}onChange={e=>setPname(e.target.value)}placeholder="Deep Groove Ball Bearing"/></div>
        <div><label style={SL}>หมวดหมู่</label><input style={SI}value={cat}onChange={e=>setCat(e.target.value)}placeholder="Bearings, Seals, Filters..."/></div>
        <div><label style={SL}>ราคาต่อหน่วย (฿)</label><input type="number"style={SI}value={cost}onChange={e=>setCost(e.target.value)}placeholder="850"min="0"/></div>
        <div><label style={SL}>จำนวนเริ่มต้น</label><input type="number"style={SI}value={qty}onChange={e=>setQty(e.target.value)}min="0"/></div>
        <div><label style={SL}>Stock ขั้นต่ำ</label><input type="number"style={SI}value={minStock}onChange={e=>setMinStock(e.target.value)}min="0"/></div>
        <div><label style={SL}>จุด Reorder</label><input type="number"style={SI}value={reorderPt}onChange={e=>setReorderPt(e.target.value)}min="0"/></div>
        <div><label style={SL}>จำนวน Reorder</label><input type="number"style={SI}value={reorderQty}onChange={e=>setReorderQty(e.target.value)}min="0"/></div>
      </div>
      <div style={{marginBottom:16}}><label style={SL}>Supplier</label><input style={SI}value={supplier}onChange={e=>setSupplier(e.target.value)}placeholder="SKF Thailand, NSK, etc."/></div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>{setShowAdd(false);resetAddForm();}}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitAdd}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ เพิ่มอะไหล่'}</button>
      </div>
    </Modal>}

    {/* Modal: Receive Stock */}
    {showReceive&&<Modal title={`📥 รับอะไหล่เข้าคลัง — ${showReceive.name}`}onClose={()=>{setShowReceive(null);setError('');}}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>จำนวนปัจจุบัน: <strong style={{color:'var(--text-primary)'}}>{showReceive.quantity_on_hand}</strong> ชิ้น</p>
      <div style={{marginBottom:16}}>
        <label style={SL}>จำนวนที่รับเข้า <span style={{color:'var(--danger)'}}>*</span></label>
        <input type="number"style={SI}value={rcvQty}onChange={e=>setRcvQty(e.target.value)}placeholder="10"min="1"autoFocus/>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>{setShowReceive(null);setError('');}}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitReceive}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ รับเข้าคลัง'}</button>
      </div>
    </Modal>}

    {/* Modal: Adjust Stock */}
    {showAdjust&&<Modal title={`🔄 ปรับสต็อก — ${showAdjust.name}`}onClose={()=>{setShowAdjust(null);setError('');}}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>จำนวนปัจจุบัน: <strong style={{color:'var(--text-primary)'}}>{showAdjust.quantity_on_hand}</strong> ชิ้น</p>
      <div style={{marginBottom:14}}>
        <label style={SL}>จำนวนที่ปรับ (+ เพิ่ม / - ลด) <span style={{color:'var(--danger)'}}>*</span></label>
        <input type="number"style={SI}value={adjQty}onChange={e=>setAdjQty(e.target.value)}placeholder="-3 หรือ +5"autoFocus/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={SL}>เหตุผล <span style={{color:'var(--danger)'}}>*</span></label>
        <input style={SI}value={adjReason}onChange={e=>setAdjReason(e.target.value)}placeholder="ใช้ซ่อม CNC-001, สูญหาย, ตรวจนับ..."/>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>{setShowAdjust(null);setError('');}}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitAdjust}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ ปรับสต็อก'}</button>
      </div>
    </Modal>}
  </div>);
}
