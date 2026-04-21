import React,{useEffect,useState,useCallback}from'react';
import{lotoAPI}from'../utils/api';
export default function LotoPage(){
  const[procs,setProcs]=useState([]);
  const[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);try{const r=await lotoAPI.list({limit:100});setProcs(r.data?.data||[]);}catch(e){console.error(e);}finally{setLoading(false);}});
  useEffect(()=>{load();},[]);
  const active=procs.filter(p=>!['released'].includes(p.status));
  return(<div className="page">
    <div className="page-header flex justify-between items-center"><div><h1 className="page-title">🔒 LOTO Procedures</h1><p className="page-sub">Lockout/Tagout safety isolation records</p></div><button className="btn btn-secondary" onClick={load}>↻ Refresh</button></div>
    <div className="grid-3 mb-6">
      {[{l:'Total Procedures',v:procs.length},{l:'Active Isolations',v:active.length,color:active.length>0?'var(--danger)':'var(--success)'},{l:'Released',v:procs.filter(p=>p.status==='released').length,color:'var(--success)'}].map(({l,v,color})=>(
        <div key={l} className="card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:color||'var(--text-primary)',fontSize:22}}>{v}</div></div>
      ))}
    </div>
    <div className="table-wrapper"><table>
      <thead><tr><th>Procedure #</th><th>Equipment</th><th>Status</th><th>Energy Sources</th><th>Initiated By</th><th>Initiated At</th><th>Zero Energy</th></tr></thead>
      <tbody>
        {loading?[...Array(3)].map((_,i)=><tr key={i}>{[...Array(7)].map((_,j)=><td key={j}><div className="skeleton" style={{height:16}}/></td>)}</tr>):
        procs.length===0?<tr><td colSpan={7} style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No LOTO procedures</td></tr>:
        procs.map(p=><tr key={p.id}>
          <td className="mono" style={{color:'var(--text-primary)'}}>{p.procedure_number}</td>
          <td style={{color:'var(--text-primary)',fontWeight:500}}>{p.equipment_name||'—'}</td>
          <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
          <td style={{fontSize:12,color:'var(--text-muted)'}}>{Array.isArray(p.energy_sources)?p.energy_sources.map(e=>e.type).join(', '):'—'}</td>
          <td style={{fontSize:12,color:'var(--text-secondary)'}}>{p.initiated_by_name||'—'}</td>
          <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.initiated_at?new Date(p.initiated_at).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'—'}</td>
          <td><span className={`badge badge-${p.zero_energy_verified?'completed':'pending'}`}>{p.zero_energy_verified?'✓ Verified':'Pending'}</span></td>
        </tr>)}
      </tbody></table>
    </div>
  </div>);
}
