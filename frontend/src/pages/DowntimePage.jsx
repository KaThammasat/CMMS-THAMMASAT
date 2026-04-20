import React,{useEffect,useState} from 'react';
import{downtimeAPI}from'../utils/api';
const S={page:{padding:24,background:'#0f172a',minHeight:'100%',color:'#f1f5f9'},card:{background:'#1e293b',borderRadius:8,padding:20,border:'1px solid #334155'},tbl:{width:'100%',borderCollapse:'collapse'},th:{textAlign:'left',fontSize:11,color:'#64748b',padding:'8px 12px',borderBottom:'1px solid #334155',textTransform:'uppercase'},td:{padding:'12px',fontSize:13,borderBottom:'1px solid #1e293b',color:'#cbd5e1'},badge:(c)=>({background:c,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600,color:'#fff'})};
const typeColor={breakdown:'#ef4444',planned:'#3b82f6',setup:'#f59e0b',idle:'#64748b'};
export default function DowntimePage(){
  const[records,setRecords]=useState([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{downtimeAPI.list({limit:50}).then(r=>setRecords(r.data?.data||[])).catch(console.error).finally(()=>setLoading(false));},[]);
  const totalMin=records.filter(r=>r.duration_minutes).reduce((a,r)=>a+Number(r.duration_minutes),0);
  const totalCost=records.filter(r=>r.downtime_cost).reduce((a,r)=>a+Number(r.downtime_cost),0);
  return(<div style={S.page}>
    <h1 style={{fontSize:20,fontWeight:700,marginBottom:4}}>⏱ Downtime Records</h1>
    <p style={{fontSize:12,color:'#64748b',marginBottom:20}}>Equipment downtime tracking & cost analysis</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
      {[{l:'Total Records',v:records.length},{l:'Total Downtime',v:`${Math.round(totalMin/60)}h ${Math.round(totalMin%60)}m`},{l:'Total Cost',v:`฿${totalCost.toLocaleString()}`}].map(({l,v})=>(
        <div key={l} style={S.card}><div style={{fontSize:13,color:'#94a3b8',marginBottom:4}}>{l}</div><div style={{fontSize:24,fontWeight:700}}>{v}</div></div>
      ))}
    </div>
    <div style={S.card}>
      {loading?<p style={{color:'#64748b'}}>Loading...</p>:<table style={S.tbl}>
        <thead><tr>{['Equipment','Type','Category','Start','Duration','Cost','Status'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {records.map(r=>(
            <tr key={r.id}>
              <td style={S.td}>{r.equipment_name||r.equipment_id?.slice(0,8)}</td>
              <td style={S.td}><span style={S.badge(typeColor[r.type]||'#64748b')}>{r.type}</span></td>
              <td style={S.td}>{r.category||'-'}</td>
              <td style={S.td}>{r.start_time?new Date(r.start_time).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'-'}</td>
              <td style={S.td}>{r.duration_minutes?`${Math.round(r.duration_minutes)}m`:r.end_time?'-':'🔴 Active'}</td>
              <td style={S.td}>{r.downtime_cost?`฿${Number(r.downtime_cost).toLocaleString()}`:'-'}</td>
              <td style={S.td}><span style={S.badge(r.end_time?'#22c55e':'#ef4444')}>{r.end_time?'Closed':'Active'}</span></td>
            </tr>
          ))}
          {records.length===0&&<tr><td colSpan={7} style={{...S.td,textAlign:'center',color:'#64748b'}}>No downtime records</td></tr>}
        </tbody>
      </table>}
    </div>
  </div>);
}
