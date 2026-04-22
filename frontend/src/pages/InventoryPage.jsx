import React,{useEffect,useState,useCallback}from'react';
import{inventoryAPI}from'../utils/api';

const S={input:{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},label:{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4}};

function Modal({title,onClose,children}){
  return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:560,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:15,fontWeight:700}}>{title}</span>
        <button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:20,cursor:'pointer'}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

export default function InventoryPage(){
  const[parts,setParts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState('');
  const[showModal,setShowModal]=useState(false);
  const[showReceive,setShowReceive]=useState(null);
  const[form,setForm]=useState({part_number:'',name:'',category:'',unit_cost:'',quantity_on_hand:'',min_stock:'',reorder_point:'',reorder_quantity:'',supplier:''});
  const[receiveQty,setReceiveQty]=useState('');
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await inventoryAPI.list({limit:100,low_stock:filter==='low'||undefined});setParts(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{load();},[load]);

  const totalVal=parts.reduce((a,p)=>a+Number(p.inventory_value||0),0);
  const lowCount=parts.filter(p=>p.needs_reorder).length;
  const f=v=>setForm(p=>({...p,...v}));

  const submit=async()=>{
    if(!form.part_number||!form.name){setError('รหัสและชื่ออะไหล่จำเป็น');return;}
    setSaving(true);setError('');
    try{
      await inventoryAPI.create({
        ...form,
        unit_cost:parseFloat(form.unit_cost)||0,
        quantity_on_hand:parseInt(form.quantity_on_hand)||0,
        min_stock:parseInt(form.min_stock)||0,
        reorder_point:parseInt(form.reorder_point)||0,
        reorder_quantity:parseInt(form.reorder_quantity)||0,
      });
      setShowModal(false);
      setForm({part_number:'',name:'',category:'',unit_cost:'',quantity_on_hand:'',min_stock:'',reorder_point:'',reorder_quantity:'',supplier:''});
      load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  const receive=async()=>{
    if(!receiveQty||parseInt(receiveQty)<=0){setError('จำนวนต้องมากกว่า 0');return;}
    setSaving(true);setError('');
    try{
      await inventoryAPI.receive(showReceive.id,{quantity:parseInt(receiveQty)});
      setShowReceive(null);setReceiveQty('');load();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setSaving(false);}
  };

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div><h1 className="page-title">📦 Spare Parts Inventory</h1><p className="page-sub">Stock levels, reorder points, and valuation</p></div>
      <button className="btn btn-primary"onClick={()=>{setShowModal(true);setError('');}}>+ Add Part</button>
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
        parts.length===0?<tr><td colSpan={8}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No parts found</td></tr>:
        parts.map(p=><tr key={p.id}>
          <td className="mono"style={{color:'var(--accent)'}}>{p.part_number}</td>
          <td style={{color:'var(--text-primary)',fontWeight:500}}>{p.name}</td>
          <td style={{color:'var(--text-muted)'}}>{p.category||'—'}</td>
          <td style={{fontWeight:700,color:p.needs_reorder?'var(--danger)':'var(--success)'}}>{p.quantity_on_hand}</td>
          <td style={{color:'var(--text-muted)'}}>{p.min_stock}</td>
          <td style={{color:'var(--text-secondary)'}}>฿{Number(p.inventory_value||0).toLocaleString()}</td>
          <td><span className={`badge badge-${p.needs_reorder?'critical':'completed'}`}>{p.needs_reorder?'Reorder':'OK'}</span></td>
          <td><button onClick={()=>{setShowReceive(p);setReceiveQty('');setError('');}}className="btn btn-secondary"style={{padding:'4px 10px',fontSize:11}}>รับเข้า</button></td>
        </tr>)}
      </tbody>
    </table></div>

    {showModal&&<Modal title="เพิ่มอะไหล่ใหม่"onClose={()=>setShowModal(false)}>
      <div className="grid-2">
        <div style={{marginBottom:14}}><label style={S.label}>รหัสอะไหล่ *</label><input value={form.part_number}onChange={e=>f({part_number:e.target.value})}placeholder="BRG-001"style={S.input}/></div>
        <div style={{marginBottom:14}}><label style={S.label}>ชื่ออะไหล่ *</label><input value={form.name}onChange={e=>f({name:e.target.value})}placeholder="ลูกปืน SKF 6205"style={S.input}/></div>
        <div style={{marginBottom:14}}><label style={S.label}>หมวดหมู่</label><select value={form.category}onChange={e=>f({category:e.target.value})}style={S.input}><option value="">-- เลือก --</option>{['Bearings','Seals','Filters','Lubricants','Belts','Electrical','Hydraulic','Pneumatic','Other'].map(c=><option key={c}value={c}>{c}</option>)}</select></div>
        <div style={{marginBottom:14}}><label style={S.label}>ราคาต่อหน่วย (฿)</label><input type="number"value={form.unit_cost}onChange={e=>f({unit_cost:e.target.value})}placeholder="1500"style={S.input}/></div>
        <div style={{marginBottom:14}}><label style={S.label}>จำนวนปัจจุบัน</label><input type="number"value={form.quantity_on_hand}onChange={e=>f({quantity_on_hand:e.target.value})}placeholder="10"style={S.input}/></div>
        <div style={{marginBottom:14}}><label style={S.label}>สต็อกขั้นต่ำ</label><input type="number"value={form.min_stock}onChange={e=>f({min_stock:e.target.value})}placeholder="3"style={S.input}/></div>
        <div style={{marginBottom:14}}><label style={S.label}>จุดสั่งซื้อ</label><input type="number"value={form.reorder_point}onChange={e=>f({reorder_point:e.target.value})}placeholder="5"style={S.input}/></div>
        <div style={{marginBottom:14}}><label style={S.label}>จำนวนสั่งซื้อ</label><input type="number"value={form.reorder_quantity}onChange={e=>f({reorder_quantity:e.target.value})}placeholder="20"style={S.input}/></div>
      </div>
      <div style={{marginBottom:14}}><label style={S.label}>ผู้จำหน่าย</label><input value={form.supplier}onChange={e=>f({supplier:e.target.value})}placeholder="SKF Thailand"style={S.input}/></div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setShowModal(false)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={submit}disabled={saving}className="btn btn-primary">{saving?'กำลังบันทึก...':'เพิ่มอะไหล่'}</button>
      </div>
    </Modal>}

    {showReceive&&<Modal title={`รับอะไหล่เข้าคลัง — ${showReceive.name}`}onClose={()=>setShowReceive(null)}width={400}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>ปัจจุบัน: <strong style={{color:'var(--text-primary)'}}>{showReceive.quantity_on_hand}</strong> หน่วย</p>
      <div style={{marginBottom:14}}><label style={S.label}>จำนวนที่รับเข้า *</label><input type="number"value={receiveQty}onChange={e=>setReceiveQty(e.target.value)}placeholder="จำนวน"min="1"style={S.input}/></div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setShowReceive(null)}className="btn btn-secondary">ยกเลิก</button>
        <button onClick={receive}disabled={saving}className="btn btn-primary">{saving?'กำลังบันทึก...':'ยืนยันรับเข้าคลัง'}</button>
      </div>
    </Modal>}
  </div>);
}
