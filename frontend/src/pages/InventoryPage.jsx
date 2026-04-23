import React,{useEffect,useState,useCallback}from'react';
import{inventoryAPI}from'../utils/api';

const S={
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16},
  modal:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:540,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'},
  body:{padding:20},
  label:{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:5},
  input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
  field:{marginBottom:14},
  row:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
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

export default function InventoryPage(){
  const[parts,setParts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState('');
  const[showAdd,setShowAdd]=useState(false);
  const[showReceive,setShowReceive]=useState(null);
  const[form,setForm]=useState({part_number:'',name:'',category:'',unit_cost:'',quantity_on_hand:'0',min_stock:'',reorder_point:'',reorder_quantity:'',supplier:''});
  const[receiveQty,setReceiveQty]=useState('');
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await inventoryAPI.list({low_stock:filter==='low'||undefined,limit:100});setParts(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{load();},[load]);

  const submitAdd=async(e)=>{
    e.preventDefault();
    if(!form.part_number.trim()||!form.name.trim()){setError('รหัสและชื่ออะไหล่จำเป็น');return;}
    setSaving(true);setError('');
    try{
      await inventoryAPI.create({...form,unit_cost:parseFloat(form.unit_cost)||0,quantity_on_hand:parseInt(form.quantity_on_hand)||0,min_stock:parseInt(form.min_stock)||0,reorder_point:parseInt(form.reorder_point)||0,reorder_quantity:parseInt(form.reorder_quantity)||0});
      setShowAdd(false);setForm({part_number:'',name:'',category:'',unit_cost:'',quantity_on_hand:'0',min_stock:'',reorder_point:'',reorder_quantity:'',supplier:''});load();
    }catch(e){setError(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  const submitReceive=async(e)=>{
    e.preventDefault();
    if(!receiveQty||parseInt(receiveQty)<=0){setError('จำนวนต้องมากกว่า 0');return;}
    setSaving(true);setError('');
    try{await inventoryAPI.receive(showReceive.id,{quantity:parseInt(receiveQty)});setShowReceive(null);setReceiveQty('');load();}
    catch(e){setError(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  const totalVal=parts.reduce((s,p)=>s+(p.inventory_value||0),0);
  const lowCount=parts.filter(p=>p.needs_reorder).length;

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">📦 Spare Parts Inventory</h1><p className="page-sub">Stock levels, reorder points, and valuation</p></div>
      <button className="btn btn-primary" onClick={()=>{setShowAdd(true);setError('');}}>+ Add Part</button>
    </div>

    <div className="grid-3 mb-6">
      {[{l:'Total Parts',v:parts.length},{l:'Low Stock',v:lowCount,c:lowCount>0?'var(--warning)':'var(--success)'},{l:'Total Value',v:`฿${Math.round(totalVal).toLocaleString()}`,c:'var(--accent)'}].map(({l,v,c})=>(
        <div key={l} className="card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:c||'var(--text-primary)',fontSize:22}}>{v}</div></div>
      ))}
    </div>

    <div className="flex gap-2 mb-4">
      {[['','All Parts'],['low','⚠ Low Stock']].map(([v,l])=>(
        <button key={v} onClick={()=>setFilter(v)} className={`btn btn-${filter===v?'primary':'secondary'}`} style={{fontSize:12,padding:'6px 14px'}}>{l}</button>
      ))}
    </div>

    <div className="table-wrapper"><table>
      <thead><tr><th>Part #</th><th>Name</th><th>Category</th><th>On Hand</th><th>Min</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><div className="skeleton" style={{height:16}}/></td>)}</tr>):
        parts.length===0?<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No parts found</td></tr>:
        parts.map(p=><tr key={p.id}>
          <td className="mono" style={{color:'var(--accent)'}}>{p.part_number}</td>
          <td style={{color:'var(--text-primary)',fontWeight:500}}>{p.name}</td>
          <td style={{color:'var(--text-muted)'}}>{p.category||'—'}</td>
          <td style={{fontWeight:700,color:p.needs_reorder?'var(--danger)':'var(--success)'}}>{p.quantity_on_hand}</td>
          <td style={{color:'var(--text-muted)'}}>{p.min_stock}</td>
          <td style={{color:'var(--text-secondary)'}}>฿{Number(p.inventory_value||0).toLocaleString()}</td>
          <td><span className={`badge badge-${p.needs_reorder?'critical':'completed'}`}>{p.needs_reorder?'Reorder':'OK'}</span></td>
          <td><button onClick={()=>{setShowReceive(p);setReceiveQty('');setError('');}} className="btn btn-secondary" style={{padding:'4px 10px',fontSize:11}}>รับเข้า</button></td>
        </tr>)}
      </tbody>
    </table></div>

    {/* Modal เพิ่มอะไหล่ */}
    {showAdd&&(
      <ModalWrap title="📦 เพิ่มอะไหล่ใหม่" onClose={()=>{setShowAdd(false);setError('');}}>
        <form onSubmit={submitAdd}>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>รหัสอะไหล่ *</label>
              <input style={S.input} placeholder="BRG-6205-2RS" value={form.part_number} onChange={e=>f('part_number',e.target.value)} autoFocus/>
            </div>
            <div style={S.field}>
              <label style={S.label}>ชื่ออะไหล่ *</label>
              <input style={S.input} placeholder="Deep Groove Ball Bearing" value={form.name} onChange={e=>f('name',e.target.value)}/>
            </div>
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>หมวดหมู่</label>
              <select style={S.input} value={form.category} onChange={e=>f('category',e.target.value)}>
                <option value="">-- เลือกหมวดหมู่ --</option>
                {['Bearings','Seals','Filters','Belts','Pumps','Motors','Electrical','Hydraulics','Pneumatics','Other'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>ราคาต่อหน่วย (฿)</label>
              <input style={S.input} type="number" min="0" placeholder="850" value={form.unit_cost} onChange={e=>f('unit_cost',e.target.value)}/>
            </div>
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>จำนวนในคลัง</label>
              <input style={S.input} type="number" min="0" placeholder="10" value={form.quantity_on_hand} onChange={e=>f('quantity_on_hand',e.target.value)}/>
            </div>
            <div style={S.field}>
              <label style={S.label}>สต็อกขั้นต่ำ</label>
              <input style={S.input} type="number" min="0" placeholder="3" value={form.min_stock} onChange={e=>f('min_stock',e.target.value)}/>
            </div>
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>จุดสั่งซื้อ</label>
              <input style={S.input} type="number" min="0" placeholder="5" value={form.reorder_point} onChange={e=>f('reorder_point',e.target.value)}/>
            </div>
            <div style={S.field}>
              <label style={S.label}>จำนวนสั่งซื้อ</label>
              <input style={S.input} type="number" min="0" placeholder="12" value={form.reorder_quantity} onChange={e=>f('reorder_quantity',e.target.value)}/>
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>ผู้จัดจำหน่าย</label>
            <input style={S.input} placeholder="SKF Thailand, IGUS, etc." value={form.supplier} onChange={e=>f('supplier',e.target.value)}/>
          </div>
          {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <button type="button" onClick={()=>setShowAdd(false)} className="btn btn-secondary">ยกเลิก</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving?'กำลังบันทึก...':'✓ เพิ่มอะไหล่'}</button>
          </div>
        </form>
      </ModalWrap>
    )}

    {/* Modal รับอะไหล่เข้า */}
    {showReceive&&(
      <ModalWrap title={`📥 รับอะไหล่เข้าคลัง — ${showReceive.name}`} onClose={()=>{setShowReceive(null);setError('');}}>
        <form onSubmit={submitReceive}>
          <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>คงเหลือปัจจุบัน: <strong style={{color:'var(--text-primary)'}}>{showReceive.quantity_on_hand} ชิ้น</strong></p>
          <div style={S.field}>
            <label style={S.label}>จำนวนที่รับเข้า *</label>
            <input style={S.input} type="number" min="1" placeholder="จำนวน" value={receiveQty} onChange={e=>setReceiveQty(e.target.value)} autoFocus/>
          </div>
          {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <button type="button" onClick={()=>setShowReceive(null)} className="btn btn-secondary">ยกเลิก</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving?'กำลังบันทึก...':'✓ รับเข้าคลัง'}</button>
          </div>
        </form>
      </ModalWrap>
    )}
  </div>);
}
