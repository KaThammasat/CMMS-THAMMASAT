import React,{useEffect,useState}from'react';
import{useParams,Link}from'react-router-dom';
import{workOrderAPI}from'../utils/api';
export default function WorkOrderDetail(){
  const{id}=useParams();
  const[wo,setWo]=useState(null);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{if(id)workOrderAPI.get(id).then(r=>setWo(r.data?.data)).catch(console.error).finally(()=>setLoading(false));},[id]);
  if(loading)return<div className="page"><div className="skeleton" style={{height:200,borderRadius:10}}/></div>;
  if(!wo)return<div className="page"><p className="text-muted">Work order not found</p></div>;
  const slaH=(new Date(wo.sla_due_at)-Date.now())/3600000;
  const slaOverdue=wo.sla_due_at&&slaH<0&&!['completed','closed','cancelled'].includes(wo.status);
  return(<div className="page">
    <div style={{marginBottom:16}}><Link to="/work-orders" style={{fontSize:13,color:'var(--accent)'}}>← Back to Work Orders</Link></div>
    <div className="flex justify-between items-center" style={{marginBottom:24,flexWrap:'wrap',gap:12}}>
      <div>
        <div className="flex items-center gap-2 mb-2" style={{flexWrap:'wrap'}}>
          <span className="mono" style={{fontSize:14,color:'var(--text-muted)'}}>{wo.wo_number}</span>
          <span className={`badge badge-${wo.status}`}>{wo.status?.replace('_',' ')}</span>
          <span className={`badge badge-${wo.priority}`}>{wo.priority}</span>
          {slaOverdue&&<span className="badge badge-critical">⚠ SLA BREACHED</span>}
        </div>
        <h1 className="page-title">{wo.title}</h1>
        <p className="page-sub">{wo.equipment_name}</p>
      </div>
    </div>
    <div className="grid-2">
      <div className="card">
        <div className="section-title">Details</div>
        {[['Type',wo.type],['Created',wo.created_at?new Date(wo.created_at).toLocaleString():'-'],['SLA Due',wo.sla_due_at?`${new Date(wo.sla_due_at).toLocaleString()} ${slaOverdue?'⚠ OVERDUE':''}`:'-'],['Assigned To',wo.assigned_to_name||'Unassigned'],['Est. Hours',wo.estimated_hours||'—'],['Actual Hours',wo.actual_hours||'—'],['Est. Cost',wo.estimated_cost?`฿${Number(wo.estimated_cost).toLocaleString()}`:'—'],['Actual Cost',wo.actual_cost?`฿${Number(wo.actual_cost).toLocaleString()}`:'—']].map(([l,v])=>(
          <div key={l} className="flex justify-between" style={{padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
            <span className="text-muted">{l}</span><span style={{fontWeight:500,color:'var(--text-secondary)'}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-title">Description</div>
        <p style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.7}}>{wo.description||'No description.'}</p>
        {wo.root_cause&&<><div className="section-title" style={{marginTop:16}}>Root Cause</div><p style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.7}}>{wo.root_cause}</p></>}
        {wo.corrective_action&&<><div className="section-title" style={{marginTop:16}}>Corrective Action</div><p style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.7}}>{wo.corrective_action}</p></>}
      </div>
    </div>
  </div>);
}
