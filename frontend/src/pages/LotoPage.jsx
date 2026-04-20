import React,{useEffect,useState}from'react';
import{lotoAPI}from'../utils/api';
const S={page:{padding:24,background:'#0f172a',minHeight:'100%',color:'#f1f5f9'},card:{background:'#1e293b',borderRadius:8,padding:20,border:'1px solid #334155'},tbl:{width:'100%',borderCollapse:'collapse'},th:{textAlign:'left',fontSize:11,color:'#64748b',padding:'8px 12px',borderBottom:'1px solid #334155',textTransform:'uppercase'},td:{padding:'12px',fontSize:13,borderBottom:'1px solid #1e293b',color:'#cbd5e1'},badge:(c)=>({background:c,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600,color:'#fff'})};
const statusColor={pending:'#64748b',isolating:'#f59e0b',isolated:'#ef4444',verified:'#8b5cf6',released:'#22c55e'};
export default function LotoPage(){
  const[procedures,setProcedures]=useState([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{lotoAPI.list({limit:50}).then(r=>setProcedures(r.data?.data||[])).catch(console.error).finally(()=>setLoading(false));},[]);
  const active=procedures.filter(p=>!['released'].includes(p.status));
  return(<div style={S.page}>
    <h1 style={{fontSize:20,fontWeight:700,marginBottom:4}}>🔒 LOTO Procedures</h1>
    <p style={{fontSize:12,color:'#64748b',marginBottom:20}}>Lockout/Tagout safety isolation records</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
      {[{l:'Total Procedures',v:procedures.length},{l:'Active Isolations',v:active.length,warn:true},{l:'Released',v:procedures.filter(p=>p.status==='released').length}].map(({l,v,warn})=>(
        <div key={l} style={S.card}><div style={{fontSize:13,color:'#94a3b8',marginBottom:4}}>{l}</div><div style={{fontSize:24,fontWeight:700,color:warn&&v>0?'#ef4444':'#f1f5f9'}}>{v}</div></div>
      ))}
    </div>
    <div style={S.card}>
      {loading?<p style={{color:'#64748b'}}>Loading...</p>:<table style={S.tbl}>
        <thead><tr>{['Procedure#','Equipment','Status','Energy Sources','Initiated By','Initiated At','Zero Energy'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {procedures.map(p=>(
            <tr key={p.id}>
              <td style={S.td}><span style={{fontFamily:'monospace',fontSize:12}}>{p.procedure_number}</span></td>
              <td style={S.td}>{p.equipment_name||p.equipment_id?.slice(0,8)}</td>
              <td style={S.td}><span style={S.badge(statusColor[p.status]||'#64748b')}>{p.status}</span></td>
              <td style={S.td}>{Array.isArray(p.energy_sources)?p.energy_sources.map(e=>e.type).join(', '):'-'}</td>
              <td style={S.td}>{p.initiated_by_name||'-'}</td>
              <td style={S.td}>{p.initiated_at?new Date(p.initiated_at).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'-'}</td>
              <td style={S.td}><span style={S.badge(p.zero_energy_verified?'#22c55e':'#64748b')}>{p.zero_energy_verified?'✓ Verified':'Pending'}</span></td>
            </tr>
          ))}
          {procedures.length===0&&<tr><td colSpan={7} style={{...S.td,textAlign:'center',color:'#64748b'}}>No LOTO procedures</td></tr>}
        </tbody>
      </table>}
    </div>
  </div>);
}
