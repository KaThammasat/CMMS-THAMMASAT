import React,{useEffect,useState,useCallback}from'react';
import{downtimeAPI}from'../utils/api';
export default function DowntimePage(){
  const[records,setRecords]=useState([]);
  const[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);try{const r=await downtimeAPI.list({limit:100});setRecords(r.data?.data||[]);}catch(e){console.error(e);}finally{setLoading(false);}});
  useEffect(()=>{load();},[]);
  const totalMin=records.reduce((a,r)=>a+Number(r.duration_minutes||0),0);
  const totalCost=records.reduce((a,r)=>a+Number(r.downtime_cost||0),0);
  const active=records.filter(r=>!r.end_time);
  return(<div className="page">
    <div className="page-header flex justify-between items-center"><div><h1 className="page-title">⏱ Downtime Records</h1><p className="page-sub">Equipment downtime tracking &amp; cost analysis</p></div><button className="btn btn-secondary" onClick={load}>↻ Refresh</button></div>
    <div className="grid-3 mb-6">
      {[{l:'Total Records',v:records.length},{l:'Active Downtimes',v:active.length,color:'var(--danger)'},{l:'Total Duration',v:`${Math.floor(totalMin/60)}h ${Math.round(totalMin%60)}m`},{l:'Total Cost',v:`฿${totalCost.toLocaleString()}`,color:'var(--warning)'},{l:'Breakdowns',v:records.filter(r=>r.type==='breakdown').length,color:'var(--danger)'},{l:'Planned',v:records.filter(r=>r.type==='planned').length,color:'var(--accent)'}].map(({l,v,color})=>(
        <div key={l} className="card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:color||'var(--text-primary)',fontSize:22}}>{v}</div></div>
      ))}
    </div>
    <div className="table-wrapper">
      <table><thead><tr><th>Equipment</th><th>Type</th><th>Category</th><th>Start</th><th>Duration</th><th>Cost</th><th>Status</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(7)].map((_,j)=><td key={j}><div className="skeleton" style={{height:16}}/></td>)}</tr>):
        records.length===0?<tr><td colSpan={7} style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No records</td></tr>:
        records.map(r=><tr key={r.id}>
          <td style={{color:'var(--text-primary)',fontWeight:500}}>{r.equipment_name||'—'}</td>
          <td><span className={`badge badge-${r.type==='breakdown'?'critical':'medium'}`}>{r.type}</span></td>
          <td style={{color:'var(--text-muted)'}}>{r.category||'—'}</td>
          <td style={{fontSize:12,color:'var(--text-muted)'}}>{r.start_time?new Date(r.start_time).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'-'}</td>
          <td style={{fontWeight:r.end_time?500:'600',color:r.end_time?'var(--text-secondary)':'var(--danger)'}}>{r.duration_minutes?`${Math.round(r.duration_minutes)}m`:'● Active'}</td>
          <td style={{color:'var(--text-secondary)'}}>{r.downtime_cost?`฿${Number(r.downtime_cost).toLocaleString()}`:'—'}</td>
          <td><span className={`badge badge-${r.end_time?'completed':'critical'}`}>{r.end_time?'Closed':'Active'}</span></td>
        </tr>)}
      </tbody></table>
    </div>
  </div>);
}
