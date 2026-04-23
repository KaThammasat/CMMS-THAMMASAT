import React,{useEffect,useState,useCallback}from'react';
import{inventoryAPI}from'../utils/api';

const SI={width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'};
const SL={fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4};

function Modal({title,onClose,children}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:540,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
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
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const initForm={part_number:'',name:'',category:'Bearings',unit_cost:'',quantity_on_hand:'0',min_stock:'2',reorder_point:'3',reorder_quantity:'10',supplier:''};
  const[form,setForm]=useState(initForm);
  const[receiveQty,setReceiveQty]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await inventoryAPI.list({low_stock:filter==='low'||undefined});setParts(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{load();},[load]);

  const F=(k,v)=>setForm(p=>({...p,[k]:v}));

  const openAdd=()=>{setForm(initForm);setError('');setShowAdd(true);};

  const submitAdd=async()=>{
    if(!form.part_number.trim()||!form.name.trim()){setError('กรุณากรอกรหัสและชื่ออะไหล่');return;}
    setSaving(true);setError('');
    try{
      await inventoryAPI.create({
        part_number:form.part_number.trim(),
        name:form.name.trim(),
        category:form.category.trim()||undefined,
        unit_cost:parseFloat(form.unit_cost)||0,
        quantity_on_hand:parseInt(form.quantity_on_hand)||0,
        min_stock:parseInt(form.min_stock)||0,
        reorder_point:parseInt(form.reorder_point)||0,
        reorder_quantity:parseInt(form.reorder_quantity)||10,
        supplier:form.supplier.trim()||undefined,
      });
      setShowAdd(false);load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const submitReceive=async()=>{
    const qty=parseInt(receiveQty);
    if(!qty||qty<=0){setError('จำนวนต้องมากกว่า 0');return;}
    setSaving(true);setError('');
    try{
      await inventoryAPI.receive(showReceive.id,{quantity:qty});
      setShowReceive(null);setReceiveQty('');load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const displayParts=filter==='low'?parts.filter(p=>p.needs_reorder||parseInt(p.quantity_on_hand)<=parseInt(p.min_stock)):parts;
  const lowCount=parts.filter(p=>p.needs_reorder||parseInt(p.quantity_on_hand)<=parseInt(p.min_stock)).length;
  const totalVal=parts.reduce((s,p)=>s+Number(p.inventory_value||0),0);

  const CATS=['Bearings','Filters','Seals','Belts','Electrical','Hydraulics','Pneumatics','Lubrication','Sensors','Tools','Other'];

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">📦 Spare Parts Inventory</h1><p className="page-sub">Stock levels, reorder points, and valuation</p></div>
      <button className="btn btn-primary"onClick={openAdd}>+ Add Part</button>
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
      <thead><tr><th>Part #</th><th>Name</th><th>Category</th><th>On Hand</th><th>Min</th><th>Reorder Pt</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(9)].map((_,j)=><td key={j}><div className="skeleton"style={{height:16}}/></td>)}</tr>):
        displayParts.length===0?<tr><td colSpan={9}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No parts found</td></tr>:
        displayParts.map(p=><tr key={p.id}>
          <td className="mono"style={{color:'var(--accent)',fontSize:12}}>{p.part_number}</td>
          <td style={{color:'var(--text-primary)',fontWeight:500}}>{p.name}</td>
          <td style={{color:'var(--text-muted)',fontSize:12}}>{p.category||'—'}</td>
          <td style={{fontWeight:700,color:p.needs_reorder?'var(--danger)':'var(--success)'}}>{p.quantity_on_hand}</td>
          <td style={{color:'var(--text-muted)'}}>{p.min_stock}</td>
          <td style={{color:'var(--text-muted)'}}>{p.reorder_point}</td>
          <td style={{color:'var(--text-secondary)'}}>฿{Number(p.inventory_value||0).toLocaleString()}</td>
          <td><span className={`badge badge-${p.needs_reorder?'critical':'completed'}`}>{p.needs_reorder?'⚠ Reorder':'✓ OK'}</span></td>
          <td>
            <button onClick={()=>{setShowReceive(p);setReceiveQty('');setError('');}}
              className="btn btn-secondary"style={{padding:'3px 10px',fontSize:11}}>รับเข้า</button>
          </td>
        </tr>)}
      </tbody>
    </table></div>

    {/* Modal: เพิ่มอะไหล่ */}
    {showAdd&&<Modal title="➕ เพิ่มอะไหล่ใหม่"onClose={()=>setShowAdd(false)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={SL}>รหัสอะไหล่ <span style={{color:'var(--danger)'}}>*</span></label>
          <input style={SI}value={form.part_number}onChange={e=>F('part_number',e.target.value)}placeholder="เช่น BRG-6205-2RS"/>
        </div>
        <div>
          <label style={SL}>ชื่ออะไหล่ <span style={{color:'var(--danger)'}}>*</span></label>
          <input style={SI}value={form.name}onChange={e=>F('name',e.target.value)}placeholder="เช่น Deep Groove Ball Bearing"/>
        </div>
        <div>
          <label style={SL}>หมวดหมู่</label>
          <select style={SI}value={form.category}onChange={e=>F('category',e.target.value)}>
            {CATS.map(c=><option key={c}value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={SL}>ราคาต่อชิ้น (฿)</label>
          <input type="number"style={SI}value={form.unit_cost}onChange={e=>F('unit_cost',e.target.value)}placeholder="850"min="0"/>
        </div>
        <div>
          <label style={SL}>จำนวนเริ่มต้น</label>
          <input type="number"style={SI}value={form.quantity_on_hand}onChange={e=>F('quantity_on_hand',e.target.value)}placeholder="10"min="0"/>
        </div>
        <div>
          <label style={SL}>สต็อกขั้นต่ำ</label>
          <input type="number"style={SI}value={form.min_stock}onChange={e=>F('min_stock',e.target.value)}placeholder="2"min="0"/>
        </div>
        <div>
          <label style={SL}>จุดสั่งซื้อ</label>
          <input type="number"style={SI}value={form.reorder_point}onChange={e=>F('reorder_point',e.target.value)}placeholder="3"min="0"/>
        </div>
        <div>
          <label style={SL}>จำนวนสั่งซื้อ</label>
          <input type="number"style={SI}value={form.reorder_quantity}onChange={e=>F('reorder_quantity',e.target.value)}placeholder="10"min="1"/>
        </div>
        <div style={{gridColumn:'1/-1'}}>
          <label style={SL}>ผู้จำหน่าย</label>
          <input style={SI}value={form.supplier}onChange={e=>F('supplier',e.target.value)}placeholder="เช่น SKF Thailand, Rexnord"/>
        </div>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginTop:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between"style={{marginTop:16}}>
        <button onClick={()=>setShowAdd(false)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitAdd}disabled={saving}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ เพิ่มอะไหล่'}</button>
      </div>
    </Modal>}

    {/* Modal: รับอะไหล่เข้าคลัง */}
    {showReceive&&<Modal title={`📥 รับอะไหล่เข้าคลัง — ${showReceive.name}`}onClose={()=>setShowReceive(null)}>
      <div style={{background:'var(--bg-base)',borderRadius:8,padding:12,marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>สต็อกปัจจุบัน</div>
        <div style={{fontSize:24,fontWeight:700,color:'var(--accent)'}}>{showReceive.quantity_on_hand} ชิ้น</div>
        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>รหัส: {showReceive.part_number}</div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={SL}>จำนวนที่รับเข้า <span style={{color:'var(--danger)'}}>*</span></label>
        <input type="number"style={{...SI,fontSize:18,fontWeight:700}}value={receiveQty}onChange={e=>setReceiveQty(e.target.value)}placeholder="จำนวน"min="1"autoFocus/>
        {receiveQty>0&&<div style={{fontSize:12,color:'var(--success)',marginTop:6}}>สต็อกหลังรับ: {parseInt(showReceive.quantity_on_hand)+parseInt(receiveQty)} ชิ้น</div>}
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setShowReceive(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submitReceive}disabled={saving||!receiveQty}className="btn btn-primary">{saving?'⏳ กำลังบันทึก...':'✓ รับอะไหล่เข้าคลัง'}</button>
      </div>
    </Modal>}
  </div>);
}
