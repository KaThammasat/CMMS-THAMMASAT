import React,{useState}from'react';
const URGENCY=[{v:'low',l:'🟢 Low — Not urgent, can wait',c:'#10b981'},{v:'normal',l:'🟡 Normal — Needs attention soon',c:'#f59e0b'},{v:'high',l:'🟠 High — Affects operations',c:'#f97316'},{v:'critical',l:'🔴 Critical — Line down / Safety risk',c:'#ef4444'}];
const S={page:{minHeight:'100vh',background:'linear-gradient(135deg,#0a0e1a 0%,#111827 100%)',display:'flex',flexDirection:'column',alignItems:'center',padding:'32px 16px'},card:{background:'#111827',border:'1px solid #2d3748',borderRadius:16,padding:32,width:'100%',maxWidth:600,boxShadow:'0 25px 50px rgba(0,0,0,.5)'},label:{fontSize:12,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6},input:{width:'100%',background:'#0a0e1a',border:'1px solid #374151',borderRadius:8,padding:'10px 14px',color:'#f9fafb',fontSize:14,outline:'none',transition:'border-color .2s',boxSizing:'border-box'},err:{color:'#f87171',fontSize:12,marginTop:4},success:{background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',borderRadius:12,padding:24,textAlign:'center'}};

export default function PublicRepairPage(){
  const[form,setForm]=useState({requester_name:'',requester_phone:'',requester_email:'',location:'',equipment_description:'',problem_description:'',urgency:'normal'});
  const[errors,setErrors]=useState({});
  const[submitting,setSubmitting]=useState(false);
  const[result,setResult]=useState(null);
  const[tracking,setTracking]=useState('');
  const[trackResult,setTrackResult]=useState(null);
  const[trackErr,setTrackErr]=useState('');

  const validate=()=>{
    const e={};
    if(!form.requester_name.trim())e.requester_name='Name is required';
    if(!form.location.trim())e.location='Location is required';
    if(!form.equipment_description.trim())e.equipment_description='Equipment description is required';
    if(!form.problem_description.trim()||form.problem_description.length<10)e.problem_description='Describe the problem (min 10 characters)';
    if(form.requester_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.requester_email))e.requester_email='Invalid email format';
    return e;
  };

  const submit=async()=>{
    const e=validate();
    if(Object.keys(e).length){setErrors(e);return;}
    setSubmitting(true);setErrors({});
    try{
      const r=await fetch('/api/v1/public/repair-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const d=await r.json();
      if(d.success)setResult(d.data);
      else setErrors({_global:d.errors?.join(', ')||d.error||'Submission failed'});
    }catch(err){setErrors({_global:'Network error. Please try again.'});}
    finally{setSubmitting(false);}
  };

  const track=async()=>{
    if(!tracking.match(/^TKT-\d{6}-\d{4}$/)){setTrackErr('Invalid format. Example: TKT-260421-1234');return;}
    setTrackErr('');setTrackResult(null);
    try{
      const r=await fetch('/api/v1/public/repair-requests/'+tracking.trim().toUpperCase());
      const d=await r.json();
      if(d.success)setTrackResult(d.data);
      else setTrackErr('Ticket not found');
    }catch{setTrackErr('Network error');}
  };

  const statusColor={pending:'#f59e0b',in_progress:'#3b82f6',resolved:'#10b981',cancelled:'#6b7280'};
  const inputStyle=(field)=>({...S.input,borderColor:errors[field]?'#ef4444':'#374151'});

  if(result)return(
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.success}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <h2 style={{fontSize:22,fontWeight:800,color:'#10b981',marginBottom:8}}>Request Submitted!</h2>
          <p style={{color:'#9ca3af',fontSize:14,marginBottom:20}}>Your repair request has been received. Our team will respond soon.</p>
          <div style={{background:'#0a0e1a',borderRadius:10,padding:16,marginBottom:20}}>
            <p style={{fontSize:12,color:'#6b7280',marginBottom:4}}>YOUR TICKET NUMBER</p>
            <p style={{fontSize:28,fontWeight:800,color:'#3b82f6',fontFamily:'monospace',letterSpacing:2}}>{result.ticket_number}</p>
            <p style={{fontSize:12,color:'#6b7280',marginTop:8}}>Save this number to track your request status</p>
          </div>
          <button onClick={()=>{setResult(null);setForm({requester_name:'',requester_phone:'',requester_email:'',location:'',equipment_description:'',problem_description:'',urgency:'normal'});}}
            style={{background:'#3b82f6',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
            Submit Another Request
          </button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={S.page}>
      {/* Header */}
      <div style={{textAlign:'center',marginBottom:32,maxWidth:600}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:'#6b7280',marginBottom:8}}>THAMMASAT INDUSTRIAL</div>
        <h1 style={{fontSize:30,fontWeight:800,color:'#f9fafb',marginBottom:8}}>🔧 Repair Request</h1>
        <p style={{color:'#9ca3af',fontSize:15}}>Report equipment issues. No login required.</p>
      </div>

      <div style={S.card}>
        {errors._global&&<div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,padding:12,marginBottom:16,color:'#f87171',fontSize:13}}>⚠ {errors._global}</div>}

        {/* Urgency */}
        <div style={{marginBottom:20}}>
          <label style={S.label}>Urgency Level *</label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {URGENCY.map(u=>(
              <div key={u.v} onClick={()=>setForm({...form,urgency:u.v})}
                style={{padding:'10px 12px',borderRadius:8,border:`2px solid ${form.urgency===u.v?u.c:'#374151'}`,background:form.urgency===u.v?u.c+'18':'transparent',cursor:'pointer',fontSize:13,color:form.urgency===u.v?u.c:'#9ca3af',fontWeight:form.urgency===u.v?700:400,transition:'all .15s'}}>
                {u.l}
              </div>
            ))}
          </div>
        </div>

        {/* Personal Info */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div>
            <label style={S.label}>Your Name *</label>
            <input style={inputStyle('requester_name')} placeholder="Full name" value={form.requester_name} onChange={e=>setForm({...form,requester_name:e.target.value})}/>
            {errors.requester_name&&<div style={S.err}>{errors.requester_name}</div>}
          </div>
          <div>
            <label style={S.label}>Phone Number</label>
            <input style={S.input} placeholder="+66-XX-XXXX-XXXX" value={form.requester_phone} onChange={e=>setForm({...form,requester_phone:e.target.value})}/>
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={S.label}>Email (optional — for updates)</label>
          <input style={inputStyle('requester_email')} type="email" placeholder="your@email.com" value={form.requester_email} onChange={e=>setForm({...form,requester_email:e.target.value})}/>
          {errors.requester_email&&<div style={S.err}>{errors.requester_email}</div>}
        </div>

        {/* Location & Equipment */}
        <div style={{marginBottom:16}}>
          <label style={S.label}>Location / Area *</label>
          <input style={inputStyle('location')} placeholder="e.g. CNC Machine Bay 1, Building A, Floor 2" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
          {errors.location&&<div style={S.err}>{errors.location}</div>}
        </div>

        <div style={{marginBottom:16}}>
          <label style={S.label}>Equipment / Asset *</label>
          <input style={inputStyle('equipment_description')} placeholder="e.g. CNC-001 Mazak Machining Center, HVAC Unit #3" value={form.equipment_description} onChange={e=>setForm({...form,equipment_description:e.target.value})}/>
          {errors.equipment_description&&<div style={S.err}>{errors.equipment_description}</div>}
        </div>

        <div style={{marginBottom:24}}>
          <label style={S.label}>Problem Description *</label>
          <textarea style={{...S.input,minHeight:100,resize:'vertical',fontFamily:'inherit',borderColor:errors.problem_description?'#ef4444':'#374151'}}
            placeholder="Describe the issue in detail — what happened, what you observed, when it started..." value={form.problem_description} onChange={e=>setForm({...form,problem_description:e.target.value})}/>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            {errors.problem_description?<div style={S.err}>{errors.problem_description}</div>:<div/>}
            <div style={{fontSize:11,color:form.problem_description.length<10?'#ef4444':'#6b7280',marginTop:4}}>{form.problem_description.length} chars</div>
          </div>
        </div>

        <button onClick={submit} disabled={submitting}
          style={{width:'100%',background:submitting?'#374151':'#3b82f6',color:'#fff',border:'none',borderRadius:10,padding:'14px',fontSize:16,fontWeight:700,cursor:submitting?'not-allowed':'pointer',transition:'background .2s'}}>
          {submitting?'Submitting...':'Submit Repair Request →'}
        </button>
      </div>

      {/* Ticket Tracker */}
      <div style={{...S.card,marginTop:24}}>
        <h3 style={{fontSize:16,fontWeight:700,color:'#f9fafb',marginBottom:4}}>🔍 Track Existing Request</h3>
        <p style={{fontSize:13,color:'#6b7280',marginBottom:16}}>Enter your ticket number to check status</p>
        <div style={{display:'flex',gap:8,marginBottom:trackResult?16:0}}>
          <input style={{...S.input,flex:1,fontFamily:'monospace',textTransform:'uppercase'}}
            placeholder="TKT-260421-1234" value={tracking} onChange={e=>setTracking(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==='Enter'&&track()}/>
          <button onClick={track} style={{background:'#374151',color:'#f9fafb',border:'1px solid #4b5563',borderRadius:8,padding:'0 20px',fontSize:14,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Track</button>
        </div>
        {trackErr&&<div style={{...S.err,marginTop:8}}>{trackErr}</div>}
        {trackResult&&(
          <div style={{background:'#0a0e1a',borderRadius:10,padding:16,marginTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontFamily:'monospace',fontWeight:700,color:'#3b82f6',fontSize:16}}>{trackResult.ticket_number}</span>
              <span style={{background:statusColor[trackResult.status]||'#6b7280',color:'#fff',borderRadius:20,padding:'3px 12px',fontSize:12,fontWeight:700,textTransform:'uppercase'}}>{trackResult.status?.replace('_',' ')}</span>
            </div>
            {[['Location',trackResult.location],['Equipment',trackResult.equipment_description],['Urgency',trackResult.urgency],['Submitted',new Date(trackResult.created_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})],['Last Updated',new Date(trackResult.updated_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})],].map(([l,v])=>(
              <div key={l} style={{display:'flex',gap:12,padding:'6px 0',borderBottom:'1px solid #1f2937',fontSize:13}}>
                <span style={{color:'#6b7280',minWidth:100}}>{l}</span>
                <span style={{color:'#d1d5db',textTransform:'capitalize'}}>{v}</span>
              </div>
            ))}
            {trackResult.admin_notes&&<div style={{marginTop:12,padding:10,background:'rgba(59,130,246,.1)',borderRadius:6,border:'1px solid rgba(59,130,246,.2)'}}>
              <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>TECHNICIAN NOTE</div>
              <div style={{fontSize:13,color:'#93c5fd'}}>{trackResult.admin_notes}</div>
            </div>}
            {trackResult.resolved_at&&<div style={{marginTop:8,fontSize:12,color:'#10b981'}}>✓ Resolved on {new Date(trackResult.resolved_at).toLocaleDateString('th-TH')}</div>}
          </div>
        )}
      </div>

      <div style={{marginTop:20,fontSize:12,color:'#4b5563',textAlign:'center'}}>
        <a href="/login" style={{color:'#6b7280',textDecoration:'none'}}>Staff Login →</a>
      </div>
    </div>
  );
}
