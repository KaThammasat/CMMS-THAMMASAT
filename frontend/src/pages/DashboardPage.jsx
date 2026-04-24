import React,{useState,useEffect}from'react';
import{Link}from'react-router-dom';
import{BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,Cell}from'recharts';
import api from'../utils/api';

const Sk=({h=24,w='100%'})=><div className="skeleton"style={{height:h,width:w,marginBottom:6}}/>;
const StatCard=({label,value,sub,color,icon})=>(
  <div className="card">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
      <div className="stat-label">{label}</div>
      <span style={{fontSize:20}}>{icon}</span>
    </div>
    <div className="stat-value"style={{fontSize:28,color:color||'var(--text-primary)'}}>{value}</div>
    {sub&&<div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>{sub}</div>}
  </div>
);

export default function DashboardPage(){
  const[kpi,setKpi]=useState(null);
  const[equipment,setEquipment]=useState([]);
  const[wos,setWos]=useState([]);
  const[repairs,setRepairs]=useState([]);
  const[topFailing,setTopFailing]=useState([]);
  const[loading,setLoading]=useState(true);
  const[tick,setTick]=useState(0);

  useEffect(()=>{
    const load=async()=>{
      try{
        const[kpiR,eqR,woR,repR,dashR]=await Promise.all([
          api.get('/kpi/summary'),
          api.get('/equipment',{params:{limit:20}}),
          api.get('/work-orders',{params:{limit:10,status:'open'}}),
          api.get('/admin/repair-requests',{params:{limit:8,status:'pending'}}).catch(()=>({data:{data:[]}})),
          api.get('/admin/dashboard-stats').catch(()=>({data:{data:{top_failing_equipment:[],recent_repairs:[]}}})),
        ]);
        setKpi(kpiR.data?.data);
        setEquipment(eqR.data?.data||[]);
        setWos(woR.data?.data||[]);
        setRepairs(dashR.data?.data?.recent_repairs||[]);
        setTopFailing(dashR.data?.data?.top_failing_equipment||[]);
      }catch(e){console.error(e);}
      finally{setLoading(false);}
    };
    load();
    const t=setInterval(()=>setTick(x=>x+1),60000);
    return()=>clearInterval(t);
  },[tick]);

  const slaColor=(due,st)=>{if(!due||['completed','closed','cancelled'].includes(st))return'var(--text-muted)';const h=(new Date(due)-Date.now())/3600000;return h<0?'var(--danger)':h<4?'var(--warning)':'var(--success)';};
  const slaText=(due,st)=>{if(!due||['completed','closed','cancelled'].includes(st))return'—';const h=(new Date(due)-Date.now())/3600000;return h<0?`${Math.abs(Math.round(h))}h overdue`:h<1?`${Math.round(h*60)}m left`:`${Math.round(h)}h left`;};
  const urgColor={low:'var(--success)',normal:'var(--warning)',high:'var(--orange)',critical:'var(--danger)'};
  const statusColor={pending:'var(--warning)',in_progress:'var(--accent)',resolved:'var(--success)'};

  const now=new Date();
  const dateStr=now.toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  return(<div className="page">
    <div className="page-header flex justify-between items-center">
      <div>
        <h1 className="page-title">Operations Dashboard</h1>
        <p className="page-sub">Thammasat Industrial Plant · {dateStr}</p>
      </div>
      <button onClick={()=>setTick(x=>x+1)}className="btn btn-secondary"style={{fontSize:12}}>↻ รีเฟรช</button>
    </div>

    {/* KPI Cards */}
    <div className="grid-4 mb-6">
      {loading?[...Array(4)].map((_,i)=><div key={i}className="card"><Sk/><Sk h={36}/></div>):<>
        <StatCard label="OEE"value={kpi?.oee?.overall?`${kpi.oee.overall}%`:'—'}sub={`Avail ${kpi?.oee?.availability||0}% · Perf ${kpi?.oee?.performance||0}%`}color="var(--success)"icon="📊"/>
        <StatCard label="MTTR"value={kpi?.mttr?.hours?`${kpi.mttr.hours}h`:'—'}sub={`${kpi?.mttr?.completedCount||0} WOs เสร็จ`}color="var(--accent)"icon="⏱"/>
        <StatCard label="MTBF"value={kpi?.mtbf?.hours?`${kpi.mtbf.hours}h`:'—'}sub="Mean time between failures"color="var(--purple)"icon="⚡"/>
        <StatCard label="Downtime Cost"value={kpi?.downtime?.totalCost?`฿${Number(kpi.downtime.totalCost).toLocaleString()}`:'—'}sub={`${kpi?.downtime?.totalHours||0}h total`}color="var(--danger)"icon="💰"/>
      </>}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
      {/* Equipment Health */}
      <div className="card">
        <div className="flex justify-between items-center"style={{marginBottom:12}}>
          <div className="section-title">⚙ สุขภาพอุปกรณ์</div>
          <Link to="/equipment"style={{fontSize:12,color:'var(--accent)'}}>ดูทั้งหมด →</Link>
        </div>
        {loading?[...Array(4)].map((_,i)=><div key={i}style={{marginBottom:12}}><Sk/><Sk h={6}/></div>):
        equipment.slice(0,6).map(e=>{const hs=e.health_score||100;const c=hs>=80?'var(--success)':hs>=60?'var(--warning)':'var(--danger)';return(
          <div key={e.id}style={{marginBottom:10}}>
            <div className="flex justify-between"style={{fontSize:13,marginBottom:3}}>
              <span style={{fontWeight:500,color:'var(--text-primary)'}}>{e.asset_code}</span>
              <span style={{fontWeight:700,color:c}}>{hs}%</span>
            </div>
            <div style={{height:4,background:'var(--bg-elevated)',borderRadius:2}}>
              <div style={{height:'100%',width:`${hs}%`,background:c,borderRadius:2,transition:'width .5s'}}/>
            </div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{e.name} · {e.criticality}</div>
          </div>
        );})}
      </div>

      {/* Active WOs */}
      <div className="card">
        <div className="flex justify-between items-center"style={{marginBottom:12}}>
          <div className="section-title">📋 ใบสั่งงานที่ Active</div>
          <Link to="/work-orders"style={{fontSize:12,color:'var(--accent)'}}>ดูทั้งหมด →</Link>
        </div>
        {loading?[...Array(5)].map((_,i)=><div key={i}className="flex gap-2 mb-2"><Sk/></div>):
        wos.length===0?<p style={{color:'var(--text-muted)',fontSize:13}}>ไม่มีใบสั่งงานที่ค้างอยู่</p>:
        wos.map(wo=><div key={wo.id}style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
          <div>
            <Link to={`/work-orders/${wo.id}`}style={{fontSize:12,fontWeight:600,color:'var(--accent)',fontFamily:'var(--mono)',textDecoration:'none'}}>{wo.wo_number}</Link>
            <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{wo.equipment_name}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <span className={`badge badge-${wo.status}`}style={{fontSize:10}}>{wo.status?.replace('_',' ')}</span>
            <div style={{fontSize:11,color:slaColor(wo.sla_due_at,wo.status),marginTop:2,fontWeight:600}}>{slaText(wo.sla_due_at,wo.status)}</div>
          </div>
        </div>)}
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
      {/* Top 5 เครื่องเสียบ่อย */}
      <div className="card">
        <div className="flex justify-between items-center"style={{marginBottom:12}}>
          <div className="section-title">🔴 5 เครื่องที่เสียบ่อย</div>
        </div>
        {loading?<Sk h={160}/>:topFailing.length===0?<p style={{color:'var(--text-muted)',fontSize:13}}>ยังไม่มีข้อมูล</p>:
        topFailing.map((e,i)=>(
          <div key={e.id}style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{fontSize:20,fontWeight:800,color:'var(--text-muted)',minWidth:24,textAlign:'center'}}>{i+1}</div>
            <div style={{flex:1}}>
              <Link to={`/equipment/${e.id}`}style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',textDecoration:'none'}}>{e.asset_code}</Link>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{e.name}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--danger)'}}>{e.total_failures} ครั้ง</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>Health: {e.health_score||100}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Repair Requests */}
      <div className="card">
        <div className="flex justify-between items-center"style={{marginBottom:12}}>
          <div className="section-title">🔧 คำขอซ่อมล่าสุด</div>
          <Link to="/repair"target="_blank"style={{fontSize:12,color:'var(--accent)'}}>ฟอร์มสาธารณะ →</Link>
        </div>
        {loading?[...Array(4)].map((_,i)=><div key={i}style={{marginBottom:8}}><Sk/></div>):
        repairs.length===0?<p style={{color:'var(--text-muted)',fontSize:13}}>ยังไม่มีคำขอซ่อม</p>:
        repairs.map(r=>(
          <div key={r.id}style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--accent)',marginBottom:2}}>{r.ticket_number}</div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{r.requester_name}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.equipment_description}</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:11,fontWeight:700,color:urgColor[r.urgency]||'var(--text-muted)',textTransform:'uppercase'}}>{r.urgency}</div>
              <div style={{fontSize:11,color:statusColor[r.status]||'var(--text-muted)',fontWeight:600,marginTop:2}}>{r.status?.replace('_',' ')}</div>
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{new Date(r.created_at).toLocaleDateString('th-TH')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* OEE Bar Chart */}
    {!loading&&kpi&&<div className="card">
      <div className="section-title"style={{marginBottom:16}}>📊 ความพร้อมของอุปกรณ์</div>
      {kpi.equipmentAvailability?.length>0?
        <ResponsiveContainer width="100%"height={160}>
          <BarChart data={kpi.equipmentAvailability}layout="vertical"margin={{left:60,right:20,top:0,bottom:0}}>
            <XAxis type="number"domain={[0,100]}tick={{fill:'var(--text-muted)',fontSize:11}}tickFormatter={v=>v+'%'}/>
            <YAxis type="category"dataKey="name"tick={{fill:'var(--text-muted)',fontSize:11}}/>
            <Tooltip formatter={v=>[v+'%','Availability']}contentStyle={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6}}/>
            <Bar dataKey="availability"radius={[0,4,4,0]}>
              {(kpi.equipmentAvailability||[]).map((e,i)=><Cell key={i}fill={e.availability>=80?'#10b981':e.availability>=60?'#f59e0b':'#ef4444'}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>:<p style={{color:'var(--text-muted)',fontSize:13}}>ยังไม่มีข้อมูล</p>
      }
    </div>}
  </div>);
}
