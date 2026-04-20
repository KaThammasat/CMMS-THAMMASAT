import React,{useEffect,useState}from'react';
import{inventoryAPI}from'../utils/api';
const S={page:{padding:24,background:'#0f172a',minHeight:'100%',color:'#f1f5f9'},card:{background:'#1e293b',borderRadius:8,padding:20,border:'1px solid #334155'},tbl:{width:'100%',borderCollapse:'collapse'},th:{textAlign:'left',fontSize:11,color:'#64748b',padding:'8px 12px',borderBottom:'1px solid #334155',textTransform:'uppercase'},td:{padding:'12px',fontSize:13,borderBottom:'1px solid #1e293b',color:'#cbd5e1'},badge:(c)=>({background:c,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600,color:'#fff'})};
export default function InventoryPage(){
  const[parts,setParts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[lowStock,setLowStock]=useState(false);
  useEffect(()=>{inventoryAPI.list({limit:100,low_stock:lowStock||undefined}).then(r=>setParts(r.data?.data||[])).catch(console.error).finally(()=>setLoading(false));},[lowStock]);
  const totalValue=parts.reduce((a,p)=>a+Number(p.inventory_value||0),0);
  return(<div style={S.page}>
    <h1 style={{fontSize:20,fontWeight:700,marginBottom:4}}>📦 Spare Parts Inventory</h1>
    <p style={{fontSize:12,color:'#64748b',marginBottom:20}}>Stock levels, reorder points, and valuation</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
      {[{l:'Total Parts',v:parts.length},{l:'Low Stock',v:parts.filter(p=>p.needs_reorder).length,warn:true},{l:'Total Value',v:`฿${totalValue.toLocaleString()}`}].map(({l,v,warn})=>(
        <div key={l} style={S.card}><div style={{fontSize:13,color:'#94a3b8',marginBottom:4}}>{l}</div><div style={{fontSize:24,fontWeight:700,color:warn&&v>0?'#ef4444':'#f1f5f9'}}>{v}</div></div>
      ))}
    </div>
    <div style={S.card}>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={()=>setLowStock(false)} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',background:!lowStock?'#3b82f6':'#334155',color:'#fff',fontSize:13}}>All Parts</button>
        <button onClick={()=>setLowStock(true)} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',background:lowStock?'#ef4444':'#334155',color:'#fff',fontSize:13}}>⚠ Low Stock</button>
      </div>
      {loading?<p style={{color:'#64748b'}}>Loading...</p>:<table style={S.tbl}>
        <thead><tr>{['Part#','Name','Category','On Hand','Min Stock','Reorder Pt','Value','Status'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {parts.map(p=>(
            <tr key={p.id}>
              <td style={S.td}><span style={{fontFamily:'monospace',fontSize:12}}>{p.part_number}</span></td>
              <td style={S.td}>{p.name}</td>
              <td style={S.td}>{p.category||'-'}</td>
              <td style={{...S.td,fontWeight:600,color:p.needs_reorder?'#ef4444':'#22c55e'}}>{p.quantity_on_hand}</td>
              <td style={S.td}>{p.min_stock}</td>
              <td style={S.td}>{p.reorder_point}</td>
              <td style={S.td}>฿{Number(p.inventory_value||0).toLocaleString()}</td>
              <td style={S.td}><span style={S.badge(p.needs_reorder?'#ef4444':'#22c55e')}>{p.needs_reorder?'Reorder':'OK'}</span></td>
            </tr>
          ))}
          {parts.length===0&&<tr><td colSpan={8} style={{...S.td,textAlign:'center',color:'#64748b'}}>No parts found</td></tr>}
        </tbody>
      </table>}
    </div>
  </div>);
}
