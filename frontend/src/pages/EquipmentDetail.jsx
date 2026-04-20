import React,{useEffect,useState}from'react';
import{useParams,Link}from'react-router-dom';
import{equipmentAPI}from'../utils/api';
const S={page:{padding:24,background:'#0f172a',minHeight:'100%',color:'#f1f5f9'},card:{background:'#1e293b',borderRadius:8,padding:20,border:'1px solid #334155',marginBottom:16},badge:(c)=>({background:c,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600,color:'#fff'})};
const critColor={critical:'#ef4444',high:'#f97316',medium:'#eab308',low:'#22c55e'};
export default function EquipmentDetail(){
  const{id}=useParams();
  const[eq,setEq]=useState(null);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{if(id)equipmentAPI.get(id).then(r=>setEq(r.data?.data)).catch(console.error).finally(()=>setLoading(false));},[id]);
  if(loading)return<div style={S.page}><p style={{color:'#64748b'}}>Loading...</p></div>;
  if(!eq)return<div style={S.page}><p style={{color:'#ef4444'}}>Equipment not found</p></div>;
  const pred=Array.isArray(eq.predictions)&&eq.predictions[0];
  return(<div style={S.page}>
    <div style={{marginBottom:16}}><Link to="/equipment" style={{color:'#38bdf8',fontSize:13}}>← Back to Equipment</Link></div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:700,margin:0}}>{eq.name}</h1>
        <p style={{fontSize:13,color:'#64748b',marginTop:4}}>{eq.asset_code} · {eq.manufacturer} {eq.model}</p>
      </div>
      <span style={S.badge(critColor[eq.criticality]||'#64748b')}>{eq.criticality} CRITICALITY</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={S.card}>
        <h3 style={{fontSize:15,fontWeight:600,marginBottom:12}}>Equipment Info</h3>
        {[['Type',eq.type],['Manufacturer',eq.manufacturer],['Model',eq.model],['Serial',eq.serial_number||'-'],['Install Date',eq.install_date?new Date(eq.install_date).toLocaleDateString():'-'],['Runtime',`${eq.runtime_hours||0}h`],['Cost/Min',`฿${eq.cost_per_minute||0}`]].map(([l,v])=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #334155',fontSize:13}}>
            <span style={{color:'#94a3b8'}}>{l}</span><span style={{fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={S.card}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:8}}>Health Score</h3>
          <div style={{fontSize:36,fontWeight:700,color:eq.health_score<75?'#ef4444':eq.health_score<85?'#f59e0b':'#22c55e'}}>{eq.health_score}%</div>
          <div style={{height:8,background:'#334155',borderRadius:4,marginTop:8}}>
            <div style={{height:'100%',width:`${eq.health_score}%`,background:eq.health_score<75?'#ef4444':eq.health_score<85?'#f59e0b':'#22c55e',borderRadius:4}}/>
          </div>
        </div>
        {pred&&<div style={S.card}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:8}}>🤖 AI Prediction</h3>
          <div style={{fontSize:28,fontWeight:700,color:'#f97316'}}>{pred.risk_score}% Risk</div>
          <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{pred.failure_mode}</div>
          <div style={{fontSize:12,color:'#94a3b8',marginTop:8,lineHeight:1.5}}>{pred.recommendation}</div>
          <div style={{fontSize:11,color:'#64748b',marginTop:8}}>Estimated failure: {pred.estimated_failure_date?new Date(pred.estimated_failure_date).toLocaleDateString():'-'} · Confidence: {pred.confidence_level}%</div>
        </div>}
      </div>
    </div>
    {eq.work_orders?.length>0&&<div style={S.card}>
      <h3 style={{fontSize:15,fontWeight:600,marginBottom:12}}>Recent Work Orders</h3>
      {eq.work_orders.map(wo=>(
        <div key={wo.wo_number} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #334155',fontSize:13}}>
          <span style={{fontFamily:'monospace'}}>{wo.wo_number}</span>
          <span>{wo.title?.slice(0,40)}</span>
          <span style={{color:'#64748b'}}>{wo.status}</span>
        </div>
      ))}
    </div>}
  </div>);
}
