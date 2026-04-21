import React,{useEffect,useState}from'react';
import{useParams,Link}from'react-router-dom';
import{equipmentAPI}from'../utils/api';
const hc=s=>s>=80?'var(--success)':s>=60?'var(--warning)':'var(--danger)';
export default function EquipmentDetail(){
  const{id}=useParams();
  const[eq,setEq]=useState(null);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{if(id)equipmentAPI.get(id).then(r=>setEq(r.data?.data)).catch(console.error).finally(()=>setLoading(false));},[id]);
  if(loading)return<div className="page"><div className="skeleton" style={{height:200,borderRadius:10}}/></div>;
  if(!eq)return<div className="page"><p className="text-muted">Equipment not found</p></div>;
  const pred=eq.predictions?.[0];
  return(<div className="page">
    <div style={{marginBottom:16}}><Link to="/equipment" style={{fontSize:13,color:'var(--accent)'}}>← Back to Equipment</Link></div>
    <div className="flex justify-between items-center" style={{marginBottom:24,flexWrap:'wrap',gap:12}}>
      <div><h1 className="page-title">{eq.name}</h1><p className="page-sub">{eq.asset_code} · {eq.manufacturer} {eq.model}</p></div>
      <span className={`badge badge-${eq.criticality}`} style={{fontSize:13,padding:'6px 14px'}}>{eq.criticality} CRITICALITY</span>
    </div>
    <div className="grid-2 mb-4">
      <div className="card">
        <div className="section-title">Equipment Info</div>
        {[['Type',eq.type],['Manufacturer',eq.manufacturer],['Model',eq.model],['Serial',eq.serial_number||'—'],['Install Date',eq.install_date?new Date(eq.install_date).toLocaleDateString():'-'],['Runtime',`${eq.runtime_hours||0}h`],['Cost/Min',`฿${eq.cost_per_minute||0}/min`]].map(([l,v])=>(
          <div key={l} className="flex justify-between" style={{padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
            <span className="text-muted">{l}</span><span style={{fontWeight:500,color:'var(--text-secondary)'}}>{v}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="card mb-4">
          <div className="section-title">Health Score</div>
          <div style={{fontSize:42,fontWeight:800,color:hc(eq.health_score),lineHeight:1}}>{eq.health_score}%</div>
          <div className="health-bar" style={{marginTop:12,height:10}}>
            <div className="health-bar-fill" style={{width:`${eq.health_score}%`,background:hc(eq.health_score)}}/>
          </div>
        </div>
        {pred&&<div className="card" style={{border:`1px solid ${pred.risk_score>70?'rgba(239,68,68,.3)':pred.risk_score>40?'rgba(245,158,11,.3)':'var(--border)'}` }}>
          <div className="section-title">🤖 AI Prediction</div>
          <div style={{fontSize:36,fontWeight:800,color:pred.risk_score>70?'var(--danger)':pred.risk_score>40?'var(--warning)':'var(--success)'}}>{pred.risk_score?.toFixed?.(1)}%</div>
          <div style={{fontSize:13,color:'var(--text-muted)',marginTop:4,textTransform:'capitalize'}}>{pred.failure_mode?.replace(/_/g,' ')}</div>
          <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:10,lineHeight:1.6,padding:'10px',background:'var(--bg-base)',borderRadius:6}}>{pred.recommendation}</div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>Est. failure: {pred.estimated_failure_date?new Date(pred.estimated_failure_date).toLocaleDateString():'—'} · Confidence: {pred.confidence_level}%</div>
        </div>}
      </div>
    </div>
    {eq.recent_work_orders?.length>0&&<div className="card">
      <div className="section-title">Recent Work Orders</div>
      <div className="table-wrapper" style={{border:'none'}}>
        <table><thead><tr><th>WO #</th><th>Title</th><th>Type</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{eq.recent_work_orders.map(wo=><tr key={wo.wo_number}>
          <td className="mono" style={{color:'var(--accent)'}}>{wo.wo_number}</td>
          <td style={{color:'var(--text-primary)'}}>{wo.title}</td>
          <td><span className="badge badge-medium" style={{textTransform:'capitalize'}}>{wo.type}</span></td>
          <td><span className={`badge badge-${wo.status}`}>{wo.status}</span></td>
          <td style={{fontSize:12,color:'var(--text-muted)'}}>{wo.created_at?new Date(wo.created_at).toLocaleDateString():'-'}</td>
        </tr>)}</tbody></table>
      </div>
    </div>}
  </div>);
}
