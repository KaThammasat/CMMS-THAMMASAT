import React,{useState,useEffect,useCallback}from'react';
import{useAuthStore}from'../store';
import api from'../utils/api';

// ── Shared helpers ───────────────────────────────────────────────
const badge=(role)=>{const m={admin:'badge-critical',manager:'badge-high',technician:'badge-medium',operator:'badge-low',viewer:'badge-pending'};return<span className={`badge ${m[role]||'badge-pending'}`}>{role}</span>;};
const fmtDate=d=>d?new Date(d).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'—';
const Sk=({h=20,w='100%',mb=8})=><div className="skeleton"style={{height:h,width:w,marginBottom:mb}}/>;
const Modal=({title,onClose,children,width=520})=><div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}><div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width,maxWidth:'100%',maxHeight:'90vh',overflow:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}><span style={{fontSize:15,fontWeight:700}}>{title}</span><button onClick={onClose}style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:20,cursor:'pointer'}}>✕</button></div><div style={{padding:20}}>{children}</div></div></div>;
const Field=({label,type='text',value,onChange,placeholder,required,options,min})=>(<div style={{marginBottom:14}}><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.4}}>{label}{required&&<span style={{color:'var(--danger)'}}>*</span>}</label>{options?<select value={value}onChange={e=>onChange(e.target.value)}style={{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13}}>{options.map(o=><option key={o.value}value={o.value}>{o.label}</option>)}</select>:<input type={type}value={value||''}onChange={e=>onChange(e.target.value)}placeholder={placeholder}min={min}style={{width:'100%',background:'var(--bg-base)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13}}/> }</div>);

// ── Users Tab ────────────────────────────────────────────────────
function UsersTab(){
  const[users,setUsers]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[roleFilter,setRoleFilter]=useState('');
  const[modal,setModal]=useState(null); // 'create'|'edit'|'password'|'audit'
  const[selected,setSelected]=useState(null);
  const[form,setForm]=useState({});
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.get('/admin/users',{params:{search,role:roleFilter,limit:100}});setUsers(r.data?.data||[]);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[search,roleFilter]);

  useEffect(()=>{const t=setTimeout(load,300);return()=>clearTimeout(t);},[load]);

  const openCreate=()=>{setForm({role:'technician',is_active:true});setModal('create');setError('');};
  const openEdit=(u)=>{setSelected(u);setForm({first_name:u.first_name,last_name:u.last_name,email:u.email,role:u.role,department:u.department||'',phone:u.phone||'',is_active:u.is_active});setModal('edit');setError('');};
  const openPwd=(u)=>{setSelected(u);setForm({new_password:'',confirm_password:''});setModal('password');setError('');};

  const save=async()=>{
    setSaving(true);setError('');
    try{
      if(modal==='create'){
        if(form.password!==form.confirm_password){setError('Passwords do not match');setSaving(false);return;}
        await api.post('/admin/users',form);
      } else if(modal==='edit'){
        await api.patch('/admin/users/'+selected.id,form);
      } else if(modal==='password'){
        if(form.new_password!==form.confirm_password){setError('Passwords do not match');setSaving(false);return;}
        await api.patch('/admin/users/'+selected.id+'/reset-password',{new_password:form.new_password});
      }
      setModal(null);load();
    }catch(e){setError(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  const deactivate=async(u)=>{
    if(!window.confirm(`Deactivate ${u.first_name} ${u.last_name}?`))return;
    try{await api.delete('/admin/users/'+u.id);load();}catch(e){alert(e.response?.data?.error||e.message);}
  };

  const forceLogout=async(u)=>{
    try{await api.delete('/admin/users/'+u.id+'/sessions');alert('Sessions terminated for '+u.email);}catch(e){alert(e.response?.data?.error);}
  };

  const active=users.filter(u=>u.is_active).length;
  const roles=['admin','manager','technician','operator','viewer'];
  const roleOpts=[{value:'',label:'All Roles'},...roles.map(r=>({value:r,label:r.charAt(0).toUpperCase()+r.slice(1)}))];

  return(<div>
    {/* Header */}
    <div className="flex justify-between items-center mb-4">
      <div className="grid-4" style={{gridTemplateColumns:'repeat(4,auto)',gap:12}}>
        {[{l:'Total Users',v:users.length},{l:'Active',v:active,c:'var(--success)'},{l:'Inactive',v:users.length-active,c:'var(--danger)'},{l:'Admins',v:users.filter(u=>u.role==='admin').length,c:'var(--accent)'}].map(({l,v,c})=>(
          <div key={l} className="card-sm"style={{textAlign:'center',minWidth:90}}><div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{l}</div><div style={{fontSize:20,fontWeight:700,color:c||'var(--text-primary)'}}>{v}</div></div>
        ))}
      </div>
      <button onClick={openCreate}className="btn btn-primary">+ Add User</button>
    </div>

    {/* Filters */}
    <div className="flex gap-2 mb-4" style={{flexWrap:'wrap'}}>
      <input value={search}onChange={e=>setSearch(e.target.value)}placeholder="Search name, email, ID..."
        style={{flex:1,minWidth:200,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 12px',color:'var(--text-primary)',fontSize:13}}/>
      <select value={roleFilter}onChange={e=>setRoleFilter(e.target.value)}
        style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',color:'var(--text-primary)',fontSize:13}}>
        {roleOpts.map(o=><option key={o.value}value={o.value}>{o.label}</option>)}
      </select>
    </div>

    {/* Table */}
    <div className="table-wrapper">
      <table><thead><tr><th>Employee</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
      <tbody>
        {loading?[...Array(5)].map((_,i)=><tr key={i}>{[...Array(7)].map((_,j)=><td key={j}><Sk h={16}/></td>)}</tr>):
        users.length===0?<tr><td colSpan={7}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No users found</td></tr>:
        users.map(u=><tr key={u.id}>
          <td>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>{u.first_name[0]}{u.last_name[0]}</div>
              <div><div style={{fontWeight:600,color:'var(--text-primary)'}}>{u.first_name} {u.last_name}</div><div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{u.employee_id}</div></div>
            </div>
          </td>
          <td style={{fontSize:13}}>{u.email}</td>
          <td>{badge(u.role)}</td>
          <td style={{color:'var(--text-muted)',fontSize:13}}>{u.department||'—'}</td>
          <td><span className={`badge badge-${u.is_active?'completed':'pending'}`}>{u.is_active?'Active':'Inactive'}</span></td>
          <td style={{fontSize:12,color:'var(--text-muted)'}}>{fmtDate(u.last_login)}</td>
          <td>
            <div className="flex gap-2">
              <button onClick={()=>openEdit(u)}className="btn btn-secondary"style={{padding:'4px 10px',fontSize:11}}>Edit</button>
              <button onClick={()=>openPwd(u)}className="btn btn-secondary"style={{padding:'4px 10px',fontSize:11}}>Pwd</button>
              <button onClick={()=>forceLogout(u)}className="btn btn-secondary"style={{padding:'4px 10px',fontSize:11}}>Logout</button>
              {u.is_active&&<button onClick={()=>deactivate(u)}className="btn btn-danger"style={{padding:'4px 10px',fontSize:11}}>Disable</button>}
            </div>
          </td>
        </tr>)}
      </tbody></table>
    </div>

    {/* Modals */}
    {modal==='create'&&<Modal title="Create User"onClose={()=>setModal(null)}>
      <div className="grid-2">
        <Field label="First Name"value={form.first_name}onChange={v=>setForm({...form,first_name:v})}required/>
        <Field label="Last Name"value={form.last_name}onChange={v=>setForm({...form,last_name:v})}required/>
        <Field label="Employee ID"value={form.employee_id}onChange={v=>setForm({...form,employee_id:v})}required/>
        <Field label="Email"type="email"value={form.email}onChange={v=>setForm({...form,email:v})}required/>
        <Field label="Role"value={form.role}onChange={v=>setForm({...form,role:v})}options={roles.map(r=>({value:r,label:r.charAt(0).toUpperCase()+r.slice(1)}))}/>
        <Field label="Department"value={form.department}onChange={v=>setForm({...form,department:v})}placeholder="Engineering"/>
        <Field label="Password"type="password"value={form.password}onChange={v=>setForm({...form,password:v})}required/>
        <Field label="Confirm Password"type="password"value={form.confirm_password}onChange={v=>setForm({...form,confirm_password:v})}required/>
      </div>
      <Field label="Phone"value={form.phone}onChange={v=>setForm({...form,phone:v})}placeholder="+66-XX-XXXX-XXXX"/>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">Cancel</button>
        <button onClick={save}disabled={saving}className="btn btn-primary">{saving?'Creating...':'Create User'}</button>
      </div>
    </Modal>}

    {modal==='edit'&&selected&&<Modal title="Edit User"onClose={()=>setModal(null)}>
      <div className="grid-2">
        <Field label="First Name"value={form.first_name}onChange={v=>setForm({...form,first_name:v})}/>
        <Field label="Last Name"value={form.last_name}onChange={v=>setForm({...form,last_name:v})}/>
        <Field label="Email"type="email"value={form.email}onChange={v=>setForm({...form,email:v})}/>
        <Field label="Department"value={form.department}onChange={v=>setForm({...form,department:v})}/>
        <Field label="Role"value={form.role}onChange={v=>setForm({...form,role:v})}options={roles.map(r=>({value:r,label:r.charAt(0).toUpperCase()+r.slice(1)}))}/>
        <Field label="Phone"value={form.phone}onChange={v=>setForm({...form,phone:v})}/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
          <input type="checkbox"checked={!!form.is_active}onChange={e=>setForm({...form,is_active:e.target.checked})}/>
          <span>Active Account</span>
        </label>
      </div>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">Cancel</button>
        <button onClick={save}disabled={saving}className="btn btn-primary">{saving?'Saving...':'Save Changes'}</button>
      </div>
    </Modal>}

    {modal==='password'&&selected&&<Modal title={`Reset Password — ${selected.email}`}onClose={()=>setModal(null)}width={420}>
      <Field label="New Password"type="password"value={form.new_password}onChange={v=>setForm({...form,new_password:v})}placeholder="Min 8 characters"/>
      <Field label="Confirm Password"type="password"value={form.confirm_password}onChange={v=>setForm({...form,confirm_password:v})}placeholder="Repeat password"/>
      {error&&<div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>⚠ {error}</div>}
      <div className="flex gap-2 justify-between">
        <button onClick={()=>setModal(null)}className="btn btn-secondary">Cancel</button>
        <button onClick={save}disabled={saving||!form.new_password}className="btn btn-primary">{saving?'Resetting...':'Reset Password'}</button>
      </div>
    </Modal>}
  </div>);
}

// ── Config Tab ───────────────────────────────────────────────────
function ConfigTab(){
  const[cfg,setCfg]=useState({});
  const[loading,setLoading]=useState(true);
  const[changes,setChanges]=useState({});
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);

  useEffect(()=>{
    api.get('/admin/config').then(r=>{setCfg(r.data?.data||{});}).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const update=(key,val)=>setChanges(p=>({...p,[key]:val}));
  const getVal=(key)=>changes[key]!==undefined?changes[key]:(cfg[key]?.value??'');

  const save=async()=>{
    setSaving(true);setSaved(false);
    try{await api.patch('/admin/config',changes);setCfg(p=>{const n={...p};Object.entries(changes).forEach(([k,v])=>{n[k]={...n[k],value:v};});return n;});setChanges({});setSaved(true);setTimeout(()=>setSaved(false),3000);}
    catch(e){alert(e.response?.data?.error||e.message);}finally{setSaving(false);}
  };

  const groups=[
    {title:'SLA Targets',icon:'⏱',keys:['sla_critical_hours','sla_high_hours','sla_medium_hours','sla_low_hours']},
    {title:'Security',icon:'🔒',keys:['max_login_attempts','session_timeout_hours']},
    {title:'Performance Targets',icon:'📊',keys:['oee_target','mttr_target_hours']},
    {title:'Operations',icon:'⚙',keys:['pm_advance_days','cost_per_downtime_hour']},
    {title:'Notifications',icon:'🔔',keys:['alert_email_enabled']},
    {title:'System',icon:'🖥',keys:['maintenance_mode']},
  ];

  return(<div>
    <div className="flex justify-between items-center mb-6">
      <div><h3 style={{fontSize:16,fontWeight:700}}>System Configuration</h3><p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Changes apply immediately across the platform</p></div>
      <div className="flex gap-2 items-center">
        {Object.keys(changes).length>0&&<span style={{fontSize:12,color:'var(--warning)'}}>⚠ {Object.keys(changes).length} unsaved change(s)</span>}
        {saved&&<span style={{fontSize:12,color:'var(--success)'}}>✓ Saved</span>}
        <button onClick={save}disabled={saving||Object.keys(changes).length===0}className="btn btn-primary">{saving?'Saving...':'Save All Changes'}</button>
      </div>
    </div>
    {loading?<div>{[...Array(4)].map((_,i)=><div key={i}className="card mb-4"><Sk h={120}/></div>)}</div>:
    <div className="grid-2">{groups.map(g=>(
      <div key={g.title}className="card">
        <div className="section-title"style={{marginBottom:16}}>{g.icon} {g.title}</div>
        {g.keys.map(key=>{
          const c=cfg[key];if(!c)return null;
          const val=getVal(key);
          const isBool=val==='true'||val==='false'||c.value===true||c.value===false;
          return(<div key={key}style={{marginBottom:14}}>
            <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:600}}>{key.replace(/_/g,' ').toUpperCase()}</label>
            {c.description&&<p style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>{c.description}</p>}
            {isBool?
              <select value={String(val)}onChange={e=>update(key,e.target.value)}style={{width:'100%',background:'var(--bg-base)',border:`1px solid ${changes[key]!==undefined?'var(--warning)':'var(--border)'}`,borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13}}>
                <option value="true">Enabled</option><option value="false">Disabled</option>
              </select>:
              <input type="number"value={val}onChange={e=>update(key,e.target.value)}min="0"
                style={{width:'100%',background:'var(--bg-base)',border:`1px solid ${changes[key]!==undefined?'var(--warning)':'var(--border)'}`,borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:13}}/>
            }
          </div>);
        })}
      </div>
    ))}</div>}
  </div>);
}

// ── Audit Log Tab ────────────────────────────────────────────────
function AuditTab(){
  const[logs,setLogs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[filters,setFilters]=useState({action:'',entity_type:'',actor:''});
  const[page,setPage]=useState(1);
  const[total,setTotal]=useState(0);

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.get('/admin/audit',{params:{...filters,page,limit:30}});setLogs(r.data?.data||[]);setTotal(r.data?.pagination?.total||0);}
    catch(e){console.error(e);}finally{setLoading(false);}
  },[filters,page]);

  useEffect(()=>{load();},[load]);

  const actionColors={CREATE_USER:'var(--success)',UPDATE_USER:'var(--accent)',DEACTIVATE_USER:'var(--danger)',RESET_PASSWORD:'var(--warning)',UPDATE_CONFIG:'var(--purple)',FORCE_LOGOUT:'var(--danger)',LOGIN:'var(--success)'};

  return(<div>
    <div className="flex gap-2 mb-4"style={{flexWrap:'wrap'}}>
      <input value={filters.actor}onChange={e=>setFilters({...filters,actor:e.target.value})}placeholder="Filter by actor..."
        style={{flex:1,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 12px',color:'var(--text-primary)',fontSize:13}}/>
      <input value={filters.action}onChange={e=>setFilters({...filters,action:e.target.value})}placeholder="Filter by action..."
        style={{width:180,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 12px',color:'var(--text-primary)',fontSize:13}}/>
      <select value={filters.entity_type}onChange={e=>setFilters({...filters,entity_type:e.target.value})}
        style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',color:'var(--text-primary)',fontSize:13}}>
        <option value="">All Types</option>
        {['user','system_config','equipment','work_order'].map(t=><option key={t}value={t}>{t}</option>)}
      </select>
      <button onClick={load}className="btn btn-secondary"style={{fontSize:12}}>↻</button>
    </div>
    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>{total} total audit events</div>
    <div className="table-wrapper">
      <table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>IP</th><th>Details</th></tr></thead>
      <tbody>
        {loading?[...Array(8)].map((_,i)=><tr key={i}>{[...Array(6)].map((_,j)=><td key={j}><Sk h={16}/></td>)}</tr>):
        logs.length===0?<tr><td colSpan={6}style={{textAlign:'center',color:'var(--text-muted)',padding:32}}>No audit events found</td></tr>:
        logs.map(l=><tr key={l.id}>
          <td style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{fmtDate(l.created_at)}</td>
          <td><div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{l.actor_name||'System'}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{l.actor_email}</div></td>
          <td><span style={{fontSize:11,fontWeight:700,color:actionColors[l.action]||'var(--text-secondary)',fontFamily:'var(--mono)'}}>{l.action}</span></td>
          <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.entity_type}{l.entity_id?<span style={{fontFamily:'var(--mono)',fontSize:10,display:'block',color:'var(--text-muted)'}}>{l.entity_id?.slice(0,8)}...</span>:null}</td>
          <td style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--text-muted)'}}>{l.ip_address||'—'}</td>
          <td style={{maxWidth:200}}>
            {l.after_data&&<div style={{fontSize:11,color:'var(--text-muted)',wordBreak:'break-all'}}>{JSON.stringify(l.after_data).slice(0,80)}</div>}
          </td>
        </tr>)}
      </tbody></table>
    </div>
    {total>30&&<div className="flex gap-2 items-center"style={{marginTop:12,justifyContent:'flex-end'}}>
      <button onClick={()=>setPage(p=>Math.max(1,p-1))}disabled={page===1}className="btn btn-secondary"style={{fontSize:12}}>← Prev</button>
      <span style={{fontSize:12,color:'var(--text-muted)'}}>Page {page}</span>
      <button onClick={()=>setPage(p=>p+1)}disabled={logs.length<30}className="btn btn-secondary"style={{fontSize:12}}>Next →</button>
    </div>}
  </div>);
}

// ── Security Stats Tab ───────────────────────────────────────────
function SecurityTab(){
  const[stats,setStats]=useState(null);
  const[loading,setLoading]=useState(true);
  const[cfg,setCfg]=useState({});

  useEffect(()=>{
    Promise.all([api.get('/admin/stats'),api.get('/admin/config')]).then(([s,c])=>{
      setStats(s.data?.data);setCfg(c.data?.data||{});
    }).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const heatColor=(count)=>count>10?'var(--danger)':count>5?'var(--warning)':count>0?'var(--success)':'var(--text-muted)';

  return(<div>
    {loading?<div className="grid-2">{[...Array(4)].map((_,i)=><div key={i}className="card"><Sk h={150}/></div>)}</div>:
    <div>
      {/* Overview Cards */}
      <div className="grid-4 mb-6">
        {[
          {l:'Total Users',v:stats?.users?.total,icon:'👥',c:'var(--accent)'},
          {l:'Active Now',v:stats?.users?.active_today,icon:'🟢',c:'var(--success)'},
          {l:'Inactive',v:stats?.users?.inactive,icon:'🔴',c:'var(--danger)'},
          {l:'Admins',v:stats?.by_role?.find(r=>r.role==='admin')?.count||0,icon:'🛡',c:'var(--warning)'},
        ].map(({l,v,icon,c})=>(
          <div key={l}className="card"><div style={{fontSize:22,marginBottom:8}}>{icon}</div><div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{l}</div><div style={{fontSize:26,fontWeight:700,color:c}}>{v}</div></div>
        ))}
      </div>

      <div className="grid-2 mb-4">
        {/* Role Distribution */}
        <div className="card">
          <div className="section-title">Role Distribution</div>
          {stats?.by_role?.map(r=>(
            <div key={r.role}style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div className="flex items-center gap-2">{badge(r.role)}</div>
              <div className="flex items-center gap-3">
                <div style={{width:100,height:6,background:'var(--bg-elevated)',borderRadius:3}}>
                  <div style={{height:'100%',width:`${(r.count/stats.users.total)*100}%`,background:'var(--accent)',borderRadius:3}}/>
                </div>
                <span style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',minWidth:24,textAlign:'right'}}>{r.count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Logins */}
        <div className="card">
          <div className="section-title">Recent Logins</div>
          {stats?.recent_logins?.map((u,i)=>(
            <div key={i}style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{u.first_name} {u.last_name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{u.email}</div>
              </div>
              <div style={{textAlign:'right'}}>
                {badge(u.role)}
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fmtDate(u.last_login)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity 24h */}
      <div className="card">
        <div className="section-title">Activity Last 24 Hours</div>
        {!stats?.activity_24h?.length?<p style={{fontSize:13,color:'var(--text-muted)'}}>No activity recorded</p>:
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
          {stats.activity_24h.map(a=>(
            <div key={a.action}style={{padding:'12px',background:'var(--bg-base)',borderRadius:8,border:'1px solid var(--border)'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--mono)',marginBottom:4}}>{a.action}</div>
              <div style={{fontSize:22,fontWeight:700,color:heatColor(+a.count)}}>{a.count}</div>
            </div>
          ))}
        </div>}
      </div>

      {/* Security Config Summary */}
      <div className="card" style={{marginTop:16}}>
        <div className="section-title">Security Settings</div>
        <div className="grid-2">
          {[
            ['Max Login Attempts',cfg.max_login_attempts?.value,'attempts'],
            ['Session Timeout',cfg.session_timeout_hours?.value,'hours'],
            ['Maintenance Mode',cfg.maintenance_mode?.value==='true'?'ENABLED':'Disabled',''],
            ['Email Alerts',cfg.alert_email_enabled?.value==='true'?'Enabled':'Disabled',''],
          ].map(([label,val,unit])=>(
            <div key={label}style={{display:'flex',justifyContent:'space-between',padding:'10px',background:'var(--bg-base)',borderRadius:6}}>
              <span style={{fontSize:13,color:'var(--text-muted)'}}>{label}</span>
              <span style={{fontSize:13,fontWeight:600,color:val==='ENABLED'?'var(--danger)':'var(--text-primary)'}}>{val} {unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>}
  </div>);
}

// ── Main Admin Page ──────────────────────────────────────────────
const TABS=[
  {id:'users',label:'👥 Users',component:UsersTab},
  {id:'config',label:'⚙ System Config',component:ConfigTab},
  {id:'security',label:'🛡 Security & Stats',component:SecurityTab},
  {id:'audit',label:'📋 Audit Log',component:AuditTab},
];

export default function AdminPage(){
  const{user}=useAuthStore();
  const[tab,setTab]=useState('users');

  if(user?.role!=='admin') return(
    <div className="page"style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:400}}>
      <div style={{fontSize:48,marginBottom:16}}>🔒</div>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Access Denied</h2>
      <p style={{color:'var(--text-muted)',fontSize:14}}>Admin role required to access this panel.</p>
    </div>
  );

  const ActiveTab=TABS.find(t=>t.id===tab)?.component||UsersTab;

  return(<div className="page">
    <div className="page-header">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-title">🛠 Admin Settings</h1>
          <p className="page-sub">Manage users, system configuration, and security</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',borderRadius:8}}>
          <span style={{color:'var(--danger)',fontSize:12}}>🛡 Admin Mode</span>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>{user?.firstName} {user?.lastName}</span>
        </div>
      </div>
    </div>

    {/* Tabs */}
    <div style={{display:'flex',gap:4,borderBottom:'1px solid var(--border)',marginBottom:24,overflowX:'auto'}}>
      {TABS.map(t=>(
        <button key={t.id}onClick={()=>setTab(t.id)}
          style={{padding:'10px 18px',fontSize:13,fontWeight:500,border:'none',background:'none',cursor:'pointer',color:tab===t.id?'var(--accent)':'var(--text-secondary)',borderBottom:`2px solid ${tab===t.id?'var(--accent)':'transparent'}`,whiteSpace:'nowrap',transition:'all .15s'}}>
          {t.label}
        </button>
      ))}
    </div>

    {/* Tab Content */}
    <ActiveTab/>
  </div>);
}
