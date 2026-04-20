import React,{useEffect,useState}from'react';
import{useParams,Link}from'react-router-dom';
import{workOrderAPI}from'../utils/api';
const S={page:{padding:24,background:'#0f172a',minHeight:'100%',color:'#f1f5f9'},card:{background:'#1e293b',borderRadius:8,padding:20,border:'1px solid #334155',marginBottom:16},badge:(c)=>({background:c,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600,color:'#fff'})};
const statusColor={open:'#3b82f6',in_progress:'#f59e0b',assigned:'#8b5cf6',completed:'#22c55e',cancelled:'#64748b',draft:'#475569'};
const priorityColor={critical:'#ef4444',high:'#f97316',medium:'#eab308',low:'#22c55e'};
export default function WorkOrderDetail(){
  const{id}=useParams();
  const[wo,setWo]=useState(null);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{if(id)workOrderAPI.get(id).then(r=>setWo(r.data?.data)).catch(console.error).finally(()=>setLoading(false));},[id]);
  if(loading)return<div style={S.page}><p style={{color:'#64748b'}}>Loading...</p></div>;
  if(!wo)return<div style={S.page}><p style={{color:'#ef4444'}}>Work order not found</p></div>;
  const slaOverdue=wo.sla_due_at&&new Date(wo.sla_due_at)<new Date()&&!['completed','closed','cancelled'].includes(wo.status);
  return(<div style={S.page}>
    <div style={{marginBottom:16}}><Link to="/work-orders" style={{color:'#38bdf8',fontSize:13}}>← Back to Work Orders</Link></div>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
      <div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
          <span style={{fontFamily:'monospace',fontSize:14,color:'#94a3b8'}}>{wo.wo_number}</span>
          <span style={S.badge(statusColor[wo.status]||'#64748b')}>{wo.status?.replace('_',' ')}</span>
          <span style={S.badge(priorityColor[wo.priority]||'#64748b')}>{wo.priority}</span>
          {slaOverdue&&<span style={S.badge('#ef4444')}>⚠ SLA BREACHED</span>}
        </div>
        <h1 style={{fontSize:20,fontWeight:700,margin:0}}>{wo.title}</h1>
        <p style={{fontSize:13,color:'#64748b',marginTop:4}}>{wo.equipment_name}</p>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={S.card}>
        <h3 style={{fontSize:15,fontWeight:600,marginBottom:12}}>Work Order Details</h3>
        {[['Type',wo.type],['Created',wo.created_at?new Date(wo.created_at).toLocaleString():'-'],['SLA Due',wo.sla_due_at?new Date(wo.sla_due_at).toLocaleString():'-'],['Assigned To',wo.assigned_to_name||'Unassigned'],['Est. Hours',wo.estimated_hours||'-'],['Actual Hours',wo.actual_hours||'-'],['Est. Cost',wo.estimated_cost?`฿${Number(wo.estimated_cost).toLocaleString()}`:'-'],['Actual Cost',wo.actual_cost?`฿${Number(wo.actual_cost).toLocaleString()}`:'-']].map(([l,v])=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #334155',fontSize:13}}>
            <span style={{color:'#94a3b8'}}>{l}</span><span style={{fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <h3 style={{fontSize:15,fontWeight:600,marginBottom:8}}>Description</h3>
        <p style={{fontSize:13,color:'#cbd5e1',lineHeight:1.6}}>{wo.description||'No description provided.'}</p>
        {wo.root_cause&&<><h3 style={{fontSize:15,fontWeight:600,margin:'16px 0 8px'}}>Root Cause</h3><p style={{fontSize:13,color:'#cbd5e1',lineHeight:1.6}}>{wo.root_cause}</p></>}
        {wo.corrective_action&&<><h3 style={{fontSize:15,fontWeight:600,margin:'16px 0 8px'}}>Corrective Action</h3><p style={{fontSize:13,color:'#cbd5e1',lineHeight:1.6}}>{wo.corrective_action}</p></>}
      </div>
    </div>
  </div>);
}
