import React,{useEffect,useState,useCallback}from'react';
import{inventoryAPI}from'../utils/api';
export default function InventoryPage(){
  const[parts,setParts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState('');
  const load=useCallback(async()=>{setLoading(true);try{const r=await inventoryAPI.list({limit:100,low_stock:filter==='low'||undefined});setParts(r.data?.data||[]);}catch(e){console.error(e);}finally{setLoading(false);}});
  useEffect(()=>{load();},[filter]);
  const totalVal=parts.reduce((a,p)=>a+Number(p.inventory_value||0),0);
  const lowCount=parts.filter(p=>p.needs_reorder).length;
  return(<div className="page">
    <div className="page-header flex justify-between items-center"><div><h1 className="page-title">📦 Spare Parts Inventory</h1><p className="page-sub">Stock levels, reorder points, and valuation</p></div><button className="btn btn-primary">+ Add Part</button></div>
    <div className="grid-3 mb-6">
      {[{l:'Total Parts',v:parts.length},{l:'Low Stock',v:lowCount,color:lowCount>0?'var(--warning)':'var(--success)'},{l:'Total Value',v:`฿${totalVal.toLocaleString()}`,color:'var(--accent)'}].map(({l,v,color})=>(
        <div key={l} className="card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:color||'var(--text-primary)',fontSize:22}}>{v}</div></div>
      ))}
    </div>
    <div className="flex gap-2 mb-4">
      {[['','All Parts'],['low','⚠ Low Stock']].map(([v,l])=>(
        <button key={v} onClick={()=>setFilter(v)} className={`btn btn-${filter===v?'primary':'secondary'}`} style={{fontSize:12,padding:'6px 14px'}}>{l}</button>
      ))}
    </div>
    <div className="table-wrapper"><table>
      <thead><tr><th>Part #</th><th>Name</th><th>Category</th><th>On Hand</th><th>Min Stock</th><th>Reorder Pt</th><th>Value</th><th>Status</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j}><div className="skeleton" style={{height:16}}/></td>)}</tr>):
        parts.length===0?<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No parts found</td></tr>:
        parts.map(p=><tr key={p.id}>
          <td className="mono" style={{color:'var(--accent)'}}>{p.part_number}</td>
          <td style={{color:'var(--text-primary)',fontWeight:500}}>{p.name}</td>
          <td style={{color:'var(--text-muted)'}}>{p.category||'—'}</td>
          <td style={{fontWeight:700,color:p.needs_reorder?'var(--danger)':'var(--success)'}}>{p.quantity_on_hand}</td>
          <td style={{color:'var(--text-muted)'}}>{p.min_stock}</td>
          <td style={{color:'var(--text-muted)'}}>{p.reorder_point}</td>
          <td style={{color:'var(--text-secondary)'}}>฿{Number(p.inventory_value||0).toLocaleString()}</td>
          <td><span className={`badge badge-${p.needs_reorder?'critical':'completed'}`}>{p.needs_reorder?'Reorder':'OK'}</span></td>
        </tr>)}
      </tbody></table>
    </div>
  </div>);
}
