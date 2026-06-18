import React, { useState, useEffect, useMemo } from "react";

/* ─────────────────────────────────────────────
   PEPTIDE TRACKER  ·  UNIQ-inspired dark clinical
───────────────────────────────────────────── */

const C = {
  bg:           "#080C14",
  surface:      "#0D1220",
  card:         "#111827",
  cardHover:    "#141E2E",
  border:       "#1E2D45",
  borderBright: "#2A3F60",
  blue:         "#4A9EFF",
  blueDim:      "#1E4A80",
  blueGlow:     "rgba(74,158,255,0.12)",
  teal:         "#38BDF8",
  white:        "#F0F6FF",
  muted:        "#5B7499",
  dimText:      "#334E6E",
  success:      "#22D3A0",
  successDim:   "rgba(34,211,160,0.12)",
  warn:         "#F59E0B",
  warnDim:      "rgba(245,158,11,0.12)",
  danger:       "#F87171",
  dangerDim:    "rgba(248,113,113,0.12)",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
`;

/* ── helpers ── */
const pad = (n) => String(n).padStart(2, "0");
const uid = () => Math.random().toString(36).slice(2, 10);
const r2  = (x) => Math.round(x * 100) / 100;
const dStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const prettyDate = (s) => {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
};
const fmtTime = (hm) => {
  if (!hm || hm === "—") return "—";
  const [h,m] = hm.split(":").map(Number);
  return `${h%12===0?12:h%12}:${pad(m)} ${h>=12?"PM":"AM"}`;
};
const today = dStr();
const todayLabel = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}).toUpperCase();

/* ── Supabase ── */
import { supabase } from "./supabaseClient.js";

/* ── data shape adapters ──
   DB rows use snake_case (concentration, interval_days, start_day...).
   The rest of this app's components expect the original camelCase
   shape used since the localStorage version. These convert between. */
function dbStackToApp(row) {
  return {
    id: row.id,
    name: row.name,
    dose: row.dose,
    unit: row.unit,
    concentration: row.concentration,
    freq: row.freq,
    time: row.time,
    days: row.days || [],
    intervalDays: row.interval_days,
    startDay: row.start_day,
    startMonth: row.start_month,
    startYear: row.start_year,
  };
}
function appStackToDb(p, userId) {
  return {
    user_id: userId,
    name: p.name,
    dose: p.dose,
    unit: p.unit,
    concentration: p.concentration,
    freq: p.freq,
    time: p.time,
    days: p.days || [],
    interval_days: p.intervalDays,
    start_day: p.startDay,
    start_month: p.startMonth,
    start_year: p.startYear,
  };
}
function dbFxToApp(row) {
  return {
    id: row.id,
    date: row.log_date,
    desc: row.description,
    severity: row.severity,
    related: row.related_to || "",
  };
}
function appFxToDb(fx, userId) {
  return {
    user_id: userId,
    log_date: fx.date,
    description: fx.desc,
    severity: fx.severity,
    related_to: fx.related || null,
  };
}

/* ── seed data ── */
const SEED_STACK = [];

/* ═══════════════════════════════════════════
   SMALL UI ATOMS
═══════════════════════════════════════════ */

function Btn({ children, onClick, kind="primary", style }) {
  const base = { cursor:"pointer", borderRadius:10, fontFamily:"'Syne',sans-serif",
    fontWeight:700, fontSize:13, display:"inline-flex", alignItems:"center", gap:6,
    padding:"9px 16px", border:"none", transition:"opacity .15s" };
  const kinds = {
    primary: { background:C.blue,    color:C.bg },
    ghost:   { background:"transparent", color:C.blue, border:`1px solid ${C.borderBright}` },
    danger:  { background:C.dangerDim, color:C.danger, border:`1px solid ${C.danger}30` },
  };
  return <button onClick={onClick} style={{...base,...kinds[kind],...style}}>{children}</button>;
}

const inputStyle = {
  width:"100%", maxWidth:"100%", padding:"10px 13px", borderRadius:10,
  border:`1px solid ${C.border}`, background:C.surface,
  fontFamily:"'DM Mono',monospace", fontSize:13.5, color:C.white,
  outline:"none", boxSizing:"border-box", display:"block",
};

function Field({ label, children }) {
  return (
    <label style={{ display:"block", marginBottom:12 }}>
      <span style={{ display:"block", fontSize:10.5, fontFamily:"'DM Mono',monospace",
        fontWeight:500, color:C.muted, marginBottom:5, letterSpacing:".08em" }}>{label}</span>
      {children}
    </label>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`,
      borderRadius:18, overflow:"hidden", ...style }}>
      {children}
    </div>
  );
}

function SectionHdr({ label, right }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"13px 18px", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13.5,
        letterSpacing:".04em", color:C.white }}>{label}</span>
      {right && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted }}>{right}</span>}
    </div>
  );
}

function StatusPill({ taken }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
      borderRadius:99, fontSize:10.5, fontFamily:"'DM Mono',monospace", letterSpacing:".06em",
      border:`1px solid ${taken ? C.success+"50" : C.border}`,
      background: taken ? C.successDim : "transparent",
      color: taken ? C.success : C.dimText }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background: taken ? C.success : C.dimText,
        boxShadow: taken ? `0 0 6px ${C.success}` : "none" }} />
      {taken ? "TAKEN" : "PENDING"}
    </span>
  );
}

/* ── Nav tab bar ── */
const NAV = [
  { id:"dashboard", label:"Dashboard" },
  { id:"stack",     label:"Stack" },
  { id:"calc",      label:"Dose Calc" },
  { id:"effects",   label:"Side Effects" },
];
function TabBar({ active, onChange }) {
  return (
    <div style={{ display:"flex", gap:4, background:C.surface,
      border:`1px solid ${C.border}`, borderRadius:14, padding:4, marginBottom:24 }}>
      {NAV.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex:1, padding:"9px 8px", borderRadius:10, cursor:"pointer",
            border:"none", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12.5,
            letterSpacing:".02em", transition:"all .15s",
            background: on ? C.blue : "transparent",
            color:       on ? C.bg   : C.muted,
            boxShadow:   on ? `0 0 14px ${C.blue}40` : "none",
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ADHERENCE RING
═══════════════════════════════════════════ */
function AdherenceRing({ taken, total, size=130 }) {
  const r    = size/2 - 12;
  const circ = 2*Math.PI*r;
  const pct  = total===0 ? 0 : taken/total;
  const dash = circ*pct;
  const cx   = size/2;
  return (
    <svg width={size} height={size}>
      <defs>
        <filter id="rglow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={C.teal}/>
          <stop offset="100%" stopColor={C.blue}/>
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={C.border} strokeWidth={9}/>
      {pct>0 && <circle cx={cx} cy={cx} r={r} fill="none"
        stroke="url(#rg)" strokeWidth={9} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ-dash}`}
        strokeDashoffset={circ*0.25}
        filter="url(#rglow)"
        style={{transition:"stroke-dasharray 1s cubic-bezier(.4,0,.2,1)"}}/>}
      <text x={cx} y={cx-8} textAnchor="middle"
        style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:800,fill:C.white}}>{taken}/{total}</text>
      <text x={cx} y={cx+12} textAnchor="middle"
        style={{fontFamily:"'DM Mono',monospace",fontSize:9.5,fill:C.muted,letterSpacing:".08em"}}>TODAY</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   DATE NAV HELPER
═══════════════════════════════════════════ */
function offsetDate(base, days) {
  const [y,m,d] = base.split("-").map(Number);
  const nd = new Date(Date.UTC(y, m-1, d+days));
  return `${nd.getUTCFullYear()}-${pad(nd.getUTCMonth()+1)}-${pad(nd.getUTCDate())}`;
}
function labelForDate(ds) {
  if (ds === today) return "TODAY";
  const [y,m,d] = ds.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
}

/* ── is a peptide due on a given date string? ── */
function isDueToday(p, dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y,m-1,d).getDay(); // 0=Sun,1=Mon...

  if (p.freq==="Daily" || p.freq==="Twice daily" || p.freq==="Every other day") return true;
  if (p.freq==="As needed") return false;

  if (p.freq==="Once weekly" || p.freq==="Twice weekly") {
    return (p.days||[]).includes(jsDay);
  }

  if (p.freq==="Every N days") {
    const n = parseInt(p.intervalDays)||1;
    const sy = parseInt(p.startYear)||y;
    const sm = parseInt(p.startMonth)||m;
    const sd = parseInt(p.startDay)||d;
    const start = Date.UTC(sy,sm-1,sd);
    const target = Date.UTC(y,m-1,d);
    const diff = Math.round((target-start)/86400000);
    return diff>=0 && diff%n===0;
  }
  return true;
}

/* ═══════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════ */
function Dashboard({ stack, daily, sideEffects, patchDaily, onNav }) {
  const [viewDate, setViewDate] = useState(today);
  const isToday   = viewDate === today;
  const taken_map = daily[viewDate]?.peptides || {};
  const scheduled = stack.filter(p => isDueToday(p, viewDate));
  const takenCount= scheduled.filter(p => taken_map[p.id]).length;
  const total     = scheduled.length;
  const recentFx  = sideEffects.slice(0,2);

  const goBack    = () => setViewDate(d => offsetDate(d, -1));
  const goForward = () => { if (!isToday) setViewDate(d => offsetDate(d, 1)); };
  const toggle    = (id) => { if (!isToday) return; patchDaily({ peptides:{ ...taken_map, [id]:!taken_map[id] } }); };

  const NavArrow = ({ dir, disabled, onClick }) => (
    <button onClick={onClick} disabled={disabled} style={{
      background:"none", border:`1px solid ${disabled ? C.border : C.borderBright}`,
      borderRadius:8, width:32, height:32, cursor:disabled?"default":"pointer",
      display:"grid", placeItems:"center", color: disabled ? C.dimText : C.blue,
      transition:"all .15s", flexShrink:0,
    }}>
      <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        {dir==="left"
          ? <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
          : <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
    </button>
  );

  return (
    <div style={{ display:"grid", gap:16 }}>

      {/* ── TODAY tile ── */}
      <Card>
        {/* date nav header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 18px 0", gap:10 }}>
          <NavArrow dir="left" disabled={false} onClick={goBack}/>
          <div style={{ flex:1, textAlign:"center" }}>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15,
              letterSpacing:".06em", color: isToday ? C.white : C.blue }}>
              {labelForDate(viewDate)}
            </span>
            {!isToday && (
              <span onClick={()=>setViewDate(today)} style={{
                display:"block", fontFamily:"'DM Mono',monospace", fontSize:10,
                color:C.blue, cursor:"pointer", marginTop:2, letterSpacing:".04em",
              }}>← BACK TO TODAY</span>
            )}
          </div>
          <NavArrow dir="right" disabled={isToday} onClick={goForward}/>
        </div>

        {/* ring centred */}
        <div style={{ display:"flex", justifyContent:"center", padding:"18px 0 10px" }}>
          <AdherenceRing taken={takenCount} total={total} size={150}/>
        </div>

        {/* divider */}
        <div style={{ height:1, background:C.border }}/>

        {/* past-day read-only banner */}
        {!isToday && (
          <div style={{ padding:"8px 16px", background:C.blueGlow,
            borderBottom:`1px solid ${C.border}`,
            fontFamily:"'DM Mono',monospace", fontSize:11, color:C.muted, textAlign:"center" }}>
            READ-ONLY — past day log
          </div>
        )}

        {/* rows */}
        <div style={{ padding:"6px 8px 10px" }}>
          {scheduled.length===0 && (
            <div style={{ padding:"20px 12px", color:C.muted, fontFamily:"'DM Mono',monospace", fontSize:13 }}>
              No scheduled peptides yet.{" "}
              <span style={{color:C.blue, cursor:"pointer", textDecoration:"underline"}} onClick={()=>onNav("stack")}>Add to stack →</span>
            </div>
          )}
          {scheduled.map(p => (
            <PeptideRow key={p.id} peptide={p} taken={!!taken_map[p.id]}
              onToggle={()=>toggle(p.id)} readOnly={!isToday}/>
          ))}
        </div>
        {isToday && (
          <div style={{ padding:"0 16px 12px", textAlign:"right" }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:C.dimText }}>TAP TO TOGGLE</span>
          </div>
        )}
      </Card>

      {/* ── bottom stat cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        <StatCard label="7-DAY ADHERENCE" value="—" sub="Log data to build" accent={C.blue}/>
        <StatCard label="ACTIVE STACK"    value={stack.length} sub="Peptides" accent={C.white}/>
        <StatCard label="SIDE EFFECTS"    value={sideEffects.length} sub="Logged total"
          accent={sideEffects.length>0 ? C.warn : C.success}
          onClick={()=>onNav("effects")}/>
      </div>

      {/* ── recent side effects ── */}
      {recentFx.length>0 && (
        <Card>
          <SectionHdr label="RECENT SIDE EFFECTS" right={<span style={{color:C.blue,cursor:"pointer"}} onClick={()=>onNav("effects")}>VIEW ALL →</span>}/>
          <div style={{padding:"6px 8px 10px"}}>
            {recentFx.map(fx=>(
              <FxRow key={fx.id} fx={fx} compact/>
            ))}
          </div>
        </Card>
      )}

      {/* ── order button ── */}
      <a href="https://uniqresearch.co.uk" target="_blank" rel="noopener noreferrer"
        style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          padding:"15px 20px", borderRadius:14, textDecoration:"none",
          background:C.blue, color:C.bg,
          fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14.5,
          letterSpacing:".02em", boxShadow:`0 0 20px ${C.blue}30`,
        }}>
        ORDER FROM UNIQ RESEARCH
        <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
          <path d="M3 11.5L11.5 3M11.5 3H5M11.5 3V9" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </a>
    </div>
  );
}

function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick} style={{ background:C.card, border:`1px solid ${C.border}`,
      borderRadius:14, padding:"14px 16px", cursor:onClick?"pointer":"default",
      transition:"border-color .15s" }}
      onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor=C.borderBright)}
      onMouseLeave={e=>onClick&&(e.currentTarget.style.borderColor=C.border)}>
      <div style={{fontSize:10, fontFamily:"'DM Mono',monospace", color:C.muted,
        letterSpacing:".08em", marginBottom:8}}>{label}</div>
      <div style={{fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800,
        color:accent||C.white, lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11.5, color:C.dimText, marginTop:5}}>{sub}</div>}
    </div>
  );
}

function PeptideRow({ peptide: p, taken, onToggle, readOnly }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>!readOnly&&setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={!readOnly ? onToggle : undefined}
      style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 12px",
        borderRadius:10, cursor: readOnly ? "default" : "pointer",
        background: hov ? C.blueGlow : "transparent",
        border:`1px solid ${hov ? C.borderBright : "transparent"}`,
        opacity: readOnly && !taken ? 0.5 : 1,
        transition:"all .15s" }}>
      <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0,
        display:"grid", placeItems:"center",
        border:`1.5px solid ${taken ? C.success : C.border}`,
        background: taken ? C.successDim : "transparent", transition:"all .2s" }}>
        {taken && <svg width={13} height={13} viewBox="0 0 13 13" fill="none">
          <path d="M2 6.5L5 9.5L11 3.5" stroke={C.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>}
      </div>
      <div style={{flex:1}}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14.5, color:C.white}}>{p.name}</span>
          <span style={{fontFamily:"'DM Mono',monospace", fontSize:11, color:C.blue}}>{p.dose} {p.unit}</span>
        </div>
        <div style={{fontSize:11.5, color:C.muted, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
          {p.freq}{p.time && p.time!=="—" ? ` · ${fmtTime(p.time)}` : ""}
        </div>
      </div>
      <StatusPill taken={taken}/>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STACK TAB
═══════════════════════════════════════════ */
const FREQ_OPTS = ["Daily","Twice daily","Once weekly","Twice weekly","Every other day","Every N days","As needed"];

const PEPTIDE_OPTS = [
  "TRZ","RETA","TESA","SEMA",
  "BPC157","TB500","CJC/IPA","IPA",
  "MOTSC","SEMAX","SELANK","NAD+",
  "GHKCU","AHKCU","GLOW","KLOW","MT1","MT2",
  "Other",
];

function StackTab({ stack, setStack, prefill, clearPrefill }) {
  const makeBlank = () => ({ name:"", customName:"", dose:"", unit:"mcg", concentration:"", freq:"Daily", time:"08:00", days:[], intervalDays:"4", startDay:"1", startMonth:String(new Date().getMonth()+1), startYear:String(new Date().getFullYear()) });
  const blank = makeBlank();
  const [form, setForm] = useState(blank);
  const [note, setNote] = useState(false);

  useEffect(() => {
    if (prefill) { setForm(f=>({...f,...prefill})); setNote(true); }
  }, [prefill]);

  const finalName = form.name === "Other" ? form.customName.trim() : form.name;

  const add = () => {
    if (!finalName) return;
    setStack(prev=>[...prev,{id:uid(),...form,name:finalName}]);
    setForm(makeBlank()); setNote(false); clearPrefill();
  };
  const remove = (id) => setStack(prev=>prev.filter(p=>p.id!==id));

  /* syringe units preview */
  const prevUnits = useMemo(()=>{
    const d=parseFloat(form.dose), c=parseFloat(form.concentration);
    if(!d||!c||c<=0) return null;
    const dm = form.unit==="mcg" ? d/1000 : form.unit==="mg" ? d : null;
    if(dm===null) return null;
    return Math.round((dm/c)*100*10)/10;
  },[form.dose,form.unit,form.concentration]);

  return (
    <div style={{display:"grid",gap:16}}>
      {/* add form */}
      <Card>
        <SectionHdr label="ADD TO STACK"/>
        <div style={{padding:"16px 16px 20px"}}>
          {note && (
            <div style={{ display:"flex", alignItems:"center", gap:8, background:C.blueGlow,
              border:`1px solid ${C.blue}40`, color:C.blue, padding:"9px 13px",
              borderRadius:10, fontSize:12.5, marginBottom:14, fontFamily:"'DM Mono',monospace" }}>
              ✓ Pulled from calculator — give it a name and save.
            </div>
          )}
          <div style={{display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10}}>
            <Field label="NAME">
              <select style={inputStyle} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}>
                <option value="">— Select —</option>
                {PEPTIDE_OPTS.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="DOSE"><input style={inputStyle} type="number" placeholder="e.g. 250" value={form.dose} onChange={e=>setForm({...form,dose:e.target.value})}/></Field>
            <Field label="UNIT">
              <select style={inputStyle} value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                {["mg","mcg","IU","ml","units"].map(u=><option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          {form.name==="Other" && (
            <Field label="CUSTOM NAME">
              <input style={inputStyle} placeholder="e.g. supplier's product name" value={form.customName} onChange={e=>setForm({...form,customName:e.target.value})}/>
            </Field>
          )}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <Field label="CONCENTRATION (mg/mL)"><input style={inputStyle} type="number" step=".1" placeholder="e.g. 2.5" value={form.concentration} onChange={e=>setForm({...form,concentration:e.target.value})}/></Field>
            <Field label="FREQUENCY">
              <select style={inputStyle} value={form.freq} onChange={e=>setForm({...form,freq:e.target.value})}>
                {FREQ_OPTS.map(f=><option key={f}>{f}</option>)}
              </select>
            </Field>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <Field label="TIME"><input style={inputStyle} type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></Field>
            <div/>
          </div>

          {/* ── Once/Twice weekly: day picker ── */}
          {(form.freq==="Once weekly"||form.freq==="Twice weekly") && (
            <div style={{marginBottom:12}}>
              <span style={{display:"block",fontSize:10.5,fontFamily:"'DM Mono',monospace",fontWeight:500,color:C.muted,marginBottom:8,letterSpacing:".08em"}}>
                {form.freq==="Once weekly" ? "WHICH DAY?" : "WHICH DAYS?"}
              </span>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i)=>{
                  const idx = i===6?0:i+1;
                  const active = (form.days||[]).includes(idx);
                  return (
                    <button key={d} type="button"
                      onClick={(e)=>{
                        e.preventDefault();
                        e.stopPropagation();
                        const cur = form.days||[];
                        if(active){
                          setForm(f=>({...f,days:cur.filter(x=>x!==idx)}));
                        } else {
                          if(form.freq==="Once weekly") setForm(f=>({...f,days:[idx]}));
                          else setForm(f=>({...f,days:[...cur,idx]}));
                        }
                      }}
                      style={{
                        padding:"8px 13px",borderRadius:8,cursor:"pointer",
                        fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,
                        border:`1px solid ${active?C.blue:C.border}`,
                        background:active?C.blue:C.surface,
                        color:active?C.bg:C.white,
                        transition:"all .12s"
                    }}>{d}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Every N days: interval + start date via dropdowns ── */}
          {form.freq==="Every N days" && (
            <>
              <Field label="EVERY HOW MANY DAYS?">
                <input style={inputStyle} type="number" inputMode="numeric" min="1" placeholder="e.g. 4" value={form.intervalDays} onChange={e=>setForm({...form,intervalDays:e.target.value})}/>
              </Field>
              <Field label="STARTING FROM">
                <div style={{display:"flex",gap:8}}>
                  <select style={{...inputStyle,flex:1}} value={form.startDay} onChange={e=>setForm({...form,startDay:e.target.value})}>
                    {Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}
                  </select>
                  <select style={{...inputStyle,flex:2}} value={form.startMonth} onChange={e=>setForm({...form,startMonth:e.target.value})}>
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=>(
                      <option key={i} value={String(i+1)}>{m}</option>
                    ))}
                  </select>
                  <select style={{...inputStyle,flex:1}} value={form.startYear} onChange={e=>setForm({...form,startYear:e.target.value})}>
                    {[2024,2025,2026,2027].map(y=><option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </div>
              </Field>
            </>
          )}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginTop:4}}>
            <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:prevUnits!=null?C.blue:C.dimText}}>
              {prevUnits!=null ? `→ ${prevUnits} units on a 1 mL syringe` : "Add mg/mcg dose + concentration to see draw units"}
            </span>
            <Btn onClick={add}>+ ADD TO STACK</Btn>
          </div>
        </div>
      </Card>

      {/* stack list */}
      <Card>
        <SectionHdr label="YOUR STACK" right={`${stack.length} PEPTIDE${stack.length!==1?"S":""}`}/>
        <div style={{padding:"6px 8px 10px"}}>
          {stack.length===0 && (
            <div style={{padding:"20px 12px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:13}}>
              Stack is empty. Add a peptide above.
            </div>
          )}
          {stack.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,
              padding:"12px 12px", borderRadius:10, borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14.5,color:C.white}}>{p.name}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.blue}}>{p.dose} {p.unit}</span>
                </div>
                <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>
                  {p.freq}{p.time?` · ${fmtTime(p.time)}`:""}
                  {p.concentration&&parseFloat(p.concentration)>0&&<span style={{color:C.dimText}}> · {p.concentration} mg/mL · draw {Math.round((( (p.unit==="mcg"?parseFloat(p.dose)/1000:parseFloat(p.dose))||0)/parseFloat(p.concentration))*1000)/10} units</span>}
                </div>
              </div>
              <button onClick={()=>remove(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.dimText,padding:6,borderRadius:8,transition:"color .15s"}}
                onMouseEnter={e=>e.currentTarget.style.color=C.danger}
                onMouseLeave={e=>e.currentTarget.style.color=C.dimText}>
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DOSE CALCULATOR
═══════════════════════════════════════════ */
const VIAL_P  = [1,2,3,5,10,15,20,30,50];
const WATER_P = [1,1.2,2,2.4,3,3.6];
const DOSE_P  = [0.1,0.125,0.25,0.5,0.75,1,1.5,2,2.5,5];
const SYR     = [{u:30,ml:.3,l:"0.3 mL"},{u:50,ml:.5,l:"0.5 mL"},{u:100,ml:1,l:"1 mL"}];

function Presets({ values, current, onPick, suffix="" }) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:6,marginBottom:4}}>
      {values.map(v=>{
        const on = Number(current)===v;
        return (
          <button key={v} onClick={()=>onPick(v)} style={{
            padding:"4px 9px",borderRadius:7,cursor:"pointer",fontSize:11.5,
            fontFamily:"'DM Mono',monospace",
            border:`1px solid ${on?C.blue:C.border}`,
            background:on?C.blue:C.surface, color:on?C.bg:C.muted,
            transition:"all .12s" }}>{v}{suffix}</button>
        );
      })}
    </div>
  );
}

function Syringe({ fillUnits, maxUnits=100 }) {
  const pct = Math.max(0,Math.min(fillUnits/maxUnits,1));
  const W=320, bX=26, bW=248, bY=22, bH=30;
  const fillW = bW*pct;
  return (
    <svg viewBox={`0 0 ${W} 78`} width="100%" style={{maxWidth:340,display:"block",margin:"0 auto"}}>
      <defs>
        <linearGradient id="fuelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={C.teal}/>
          <stop offset="100%" stopColor={C.blue}/>
        </linearGradient>
      </defs>
      <rect x={6} y={bY+8} width={20} height={14} rx={2} fill={C.border}/>
      <rect x={2} y={bY+4} width={6} height={22} rx={2} fill={C.muted}/>
      <rect x={bX} y={bY} width={bW} height={bH} rx={5} fill={C.surface} stroke={C.border} strokeWidth={1.5}/>
      {fillW>0&&<rect x={bX} y={bY} width={fillW} height={bH} rx={5} fill="url(#fuelGrad)" opacity={.85}/>}
      {Array.from({length:11}).map((_,i)=>{
        const x=bX+(bW/10)*i, maj=i%5===0;
        return <g key={i}>
          <line x1={x} y1={bY} x2={x} y2={bY+(maj?11:6)} stroke={C.border} strokeWidth={maj?1.2:.7}/>
          {maj&&<text x={x} y={bY+bH+14} textAnchor="middle" style={{fontSize:8.5,fill:C.muted,fontFamily:"'DM Mono',monospace"}}>{Math.round((maxUnits/10)*i)}</text>}
        </g>;
      })}
      <rect x={bX+bW} y={bY+bH/2-2} width={12} height={4} fill={C.border}/>
      <rect x={bX+bW+12} y={bY+bH/2-1} width={24} height={2} fill={C.muted}/>
    </svg>
  );
}

function DoseCalc({ onUseInStack }) {
  const [mode, setMode] = useState("dose");
  const [vial,  setVial]  = useState(5);
  const [water, setWater] = useState(2);
  const [dose,  setDose]  = useState(0.25);
  const [doseUnit, setDoseUnit] = useState("mg");
  const [targetU, setTargetU]   = useState(20);
  const [syr, setSyr] = useState(SYR[2]);

  const n = x => { const v=parseFloat(x); return isNaN(v)?0:v; };
  const doseMg = doseUnit==="mcg" ? n(dose)/1000 : n(dose);
  const conc   = n(water)>0 ? n(vial)/n(water) : 0;
  const volMl  = conc>0 ? doseMg/conc : 0;
  const units  = volMl*100;
  const dosesPerVial = doseMg>0 ? Math.floor(n(vial)/doseMg) : 0;
  const waterNeeded  = doseMg>0 ? (n(targetU)*n(vial))/(doseMg*100) : 0;
  const concWater    = waterNeeded>0 ? n(vial)/waterNeeded : 0;
  const handoffConc  = mode==="dose" ? conc : concWater;
  const valid = mode==="dose" ? (n(vial)>0&&n(water)>0&&doseMg>0) : (n(vial)>0&&doseMg>0&&n(targetU)>0);

  return (
    <div style={{display:"grid",gap:16}}>
      {/* mode toggle */}
      <div style={{display:"flex",gap:4,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:4}}>
        {[{id:"dose",l:"How much to draw"},{id:"water",l:"How much water"}].map(m=>{
          const on=mode===m.id;
          return <button key={m.id} onClick={()=>setMode(m.id)} style={{
            flex:1,padding:"8px",borderRadius:9,border:"none",cursor:"pointer",
            fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12.5,
            background:on?C.blue:"transparent",color:on?C.bg:C.muted,
            transition:"all .15s"}}>{m.l}</button>;
        })}
      </div>

      <Card>
        <div style={{padding:"16px 16px 20px"}}>
          <p style={{margin:"0 0 16px",color:C.muted,fontSize:13,fontFamily:"'DM Mono',monospace",lineHeight:1.6}}>
            {mode==="dose"
              ? "Enter vial strength, water added, and target dose → units to draw on a U-100 syringe."
              : "Enter vial strength, desired dose, and target units → how much water to add."}
          </p>
          <Field label="VIAL STRENGTH (mg)">
            <input style={inputStyle} type="number" value={vial} onChange={e=>setVial(e.target.value)}/>
          </Field>
          <Presets values={VIAL_P} current={vial} onPick={setVial}/>

          {mode==="dose" ? (
            <div style={{marginTop:12}}>
              <Field label="BACTERIOSTATIC WATER (mL)">
                <input style={inputStyle} type="number" value={water} onChange={e=>setWater(e.target.value)}/>
              </Field>
              <Presets values={WATER_P} current={water} onPick={setWater}/>
            </div>
          ) : (
            <div style={{marginTop:12}}>
              <Field label="TARGET UNITS ON SYRINGE">
                <input style={inputStyle} type="number" value={targetU} onChange={e=>setTargetU(e.target.value)}/>
              </Field>
            </div>
          )}

          <div style={{marginTop:12}}>
            <Field label="DESIRED DOSE">
              <div style={{display:"flex",gap:8}}>
                <input style={{...inputStyle,flex:1}} type="number" value={dose} onChange={e=>setDose(e.target.value)}/>
                <select style={{...inputStyle,width:"auto"}} value={doseUnit} onChange={e=>setDoseUnit(e.target.value)}>
                  <option value="mg">mg</option><option value="mcg">mcg</option>
                </select>
              </div>
            </Field>
            <Presets values={DOSE_P} current={doseUnit==="mcg"?n(dose)/1000:dose} onPick={v=>setDose(doseUnit==="mcg"?v*1000:v)} suffix=" mg"/>
          </div>
        </div>
      </Card>

      {/* result */}
      <Card>
        <SectionHdr label="RESULT"/>
        <div style={{padding:"16px"}}>
          {!valid ? (
            <p style={{margin:0,color:C.dimText,fontFamily:"'DM Mono',monospace",fontSize:13}}>Fill in the fields above to see the result.</p>
          ) : mode==="dose" ? (
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
                <MiniStat label="DRAW TO"        value={`${r2(units)} units`}     accent={C.teal}/>
                <MiniStat label="VOLUME"         value={`${r2(volMl)} mL`}/>
                <MiniStat label="CONCENTRATION"  value={`${r2(conc)} mg/mL`}/>
                <MiniStat label="DOSES / VIAL"   value={`~${dosesPerVial}`}       accent={C.blue}/>
              </div>
              <div style={{marginBottom:10,background:C.surface,borderRadius:12,padding:"14px 12px"}}>
                <Syringe fillUnits={units} maxUnits={syr.u}/>
                <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:12,flexWrap:"wrap"}}>
                  {SYR.map(s=>(
                    <button key={s.u} onClick={()=>setSyr(s)} style={{
                      padding:"4px 10px",borderRadius:7,cursor:"pointer",fontSize:11,
                      fontFamily:"'DM Mono',monospace",
                      border:`1px solid ${syr.u===s.u?C.blue:C.border}`,
                      background:syr.u===s.u?C.blue:C.surface,
                      color:syr.u===s.u?C.bg:C.muted}}>{s.l}</button>
                  ))}
                </div>
              </div>
              {units>syr.u && (
                <p style={{color:C.warn,fontSize:12.5,fontFamily:"'DM Mono',monospace",marginBottom:0}}>
                  ⚠ {r2(units)} units exceeds this syringe. Use more water or a larger syringe.
                </p>
              )}
            </>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              <MiniStat label="ADD WATER"         value={`${r2(waterNeeded)} mL`} accent={C.teal}/>
              <MiniStat label="RESULTING CONC."   value={`${r2(concWater)} mg/mL`}/>
              <MiniStat label="DOSES / VIAL"      value={`~${dosesPerVial}`}      accent={C.blue}/>
            </div>
          )}
          {valid && (
            <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${C.border}`,
              display:"flex",justifyContent:"flex-end"}}>
              <Btn onClick={()=>onUseInStack({dose:String(dose),unit:doseUnit,concentration:String(r2(handoffConc))})}>
                USE IN STACK →
              </Btn>
            </div>
          )}
        </div>
      </Card>

      <p style={{color:C.dimText,fontSize:11.5,fontFamily:"'DM Mono',monospace",lineHeight:1.6,margin:"0 4px"}}>
        ⚠ Convenience tool only. Always verify against your vial and provider guidance before drawing.
      </p>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{ background:C.surface, borderRadius:10, padding:"10px 13px" }}>
      <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:C.muted,letterSpacing:".08em",marginBottom:4}}>{label}</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:accent||C.white}}>{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SIDE EFFECTS
═══════════════════════════════════════════ */
const SEV = [
  { k:"Mild",     c:C.success },
  { k:"Moderate", c:C.warn    },
  { k:"Severe",   c:C.danger  },
];

function FxRow({ fx, onRemove, compact }) {
  const sev = SEV.find(s=>s.k===fx.severity)||SEV[0];
  return (
    <div style={{ display:"flex", gap:12, padding: compact ? "10px 12px" : "14px 16px",
      borderBottom:`1px solid ${C.border}`, alignItems:"flex-start" }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:sev.c,
        marginTop:6, flexShrink:0, boxShadow:`0 0 6px ${sev.c}` }}/>
      <div style={{flex:1}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted}}>{prettyDate(fx.date)}</span>
          <span style={{fontSize:10.5,fontWeight:700,color:sev.c,
            border:`1px solid ${sev.c}50`,padding:"1px 7px",borderRadius:99,
            fontFamily:"'DM Mono',monospace"}}>{fx.severity.toUpperCase()}</span>
          {fx.related&&<span style={{fontSize:10.5,color:C.blue,
            background:C.blueGlow,border:`1px solid ${C.blue}30`,
            padding:"1px 8px",borderRadius:99,fontFamily:"'DM Mono',monospace"}}>{fx.related}</span>}
        </div>
        <div style={{fontSize:13.5,color:C.white,lineHeight:1.5}}>{fx.desc}</div>
      </div>
      {onRemove && (
        <button onClick={()=>onRemove(fx.id)} style={{background:"none",border:"none",
          cursor:"pointer",color:C.dimText,padding:4,borderRadius:6,transition:"color .15s"}}
          onMouseEnter={e=>e.currentTarget.style.color=C.danger}
          onMouseLeave={e=>e.currentTarget.style.color=C.dimText}>
          <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
            <path d="M2.5 3.5h10M5.5 3.5v-1h4v1M4.5 3.5l.5 8.5h5l.5-8.5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function SideEffectsTab({ sideEffects, setSideEffects, stack }) {
  const blank = { date:today, desc:"", severity:"Mild", related:"" };
  const [form, setForm] = useState(blank);
  const add = () => {
    if (!form.desc.trim()) return;
    setSideEffects(prev=>[{id:uid(),...form,desc:form.desc.trim()},...prev]);
    setForm(blank);
  };
  return (
    <div style={{display:"grid",gap:16}}>
      <Card>
        <SectionHdr label="LOG SIDE EFFECT"/>
        <div style={{padding:"16px 16px 20px"}}>
          <Field label="DATE">
            <div style={{overflow:"hidden",borderRadius:10}}>
              <input style={{...inputStyle,width:"100%",margin:0,display:"block"}} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            </div>
          </Field>
          <Field label="SEVERITY">
            <select style={inputStyle} value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}>
              {SEV.map(s=><option key={s.k}>{s.k}</option>)}
            </select>
          </Field>
          <Field label="WHAT DID YOU NOTICE?">
            <textarea style={{...inputStyle,minHeight:72,resize:"vertical",lineHeight:1.6}} placeholder="e.g. Mild flushing at injection site, faded after ~30 min." value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/>
          </Field>
          <Field label="POSSIBLY RELATED TO (OPTIONAL)">
            <select style={inputStyle} value={form.related} onChange={e=>setForm({...form,related:e.target.value})}>
              <option value="">— Not sure / general —</option>
              {stack.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </Field>
          <Btn kind="ghost" onClick={add}>+ LOG ENTRY</Btn>
        </div>
      </Card>

      <Card>
        <SectionHdr label="HISTORY" right={`${sideEffects.length} ENTR${sideEffects.length!==1?"IES":"Y"}`}/>
        <div style={{padding:"4px 0 8px"}}>
          {sideEffects.length===0 && (
            <div style={{padding:"20px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:13}}>
              Nothing logged. That's a good thing.
            </div>
          )}
          {sideEffects.map(fx=>(
            <FxRow key={fx.id} fx={fx} onRemove={id=>setSideEffects(prev=>prev.filter(s=>s.id!==id))}/>
          ))}
        </div>
      </Card>

      <p style={{color:C.dimText,fontSize:11.5,fontFamily:"'DM Mono',monospace",lineHeight:1.6,margin:"0 4px"}}>
        ⚠ This log is for personal record-keeping only. Contact your provider if a side effect is severe, worsening, or concerning.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   AUTH SCREEN
═══════════════════════════════════════════ */
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  const submit = async () => {
    setErr(""); setInfo("");
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session) { onAuthed(); }
        else setInfo("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onAuthed();
      }
    } catch (e) {
      setErr(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.white,
      fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <style>{FONTS}</style>
      <style>{`*{box-sizing:border-box;}body{margin:0;}input{max-width:100%;}`}</style>
      <div style={{ width:"100%", maxWidth:380 }}>

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:"50%",
            background:C.surface, border:`1px solid ${C.borderBright}`,
            display:"grid", placeItems:"center", overflow:"hidden", marginBottom:14 }}>
            <img src="/logo-mark.png" alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          </div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, letterSpacing:"-.01em" }}>
            PEPTIDE<span style={{color:C.blue}}>TRACKER</span>
          </span>
        </div>

        <Card style={{ padding:24 }}>
          <div style={{ display:"flex", gap:4, background:C.surface, border:`1px solid ${C.border}`,
            borderRadius:12, padding:4, marginBottom:20 }}>
            {[{id:"signin",l:"Sign In"},{id:"signup",l:"Sign Up"}].map(m=>{
              const on = mode===m.id;
              return <button key={m.id} onClick={()=>{setMode(m.id);setErr("");setInfo("");}} style={{
                flex:1, padding:"9px", borderRadius:9, border:"none", cursor:"pointer",
                fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13,
                background:on?C.blue:"transparent", color:on?C.bg:C.muted, transition:"all .15s",
              }}>{m.l}</button>;
            })}
          </div>

          <Field label="EMAIL">
            <input style={inputStyle} type="email" autoComplete="email" placeholder="you@example.com"
              value={email} onChange={e=>setEmail(e.target.value)}/>
          </Field>
          <Field label="PASSWORD">
            <input style={inputStyle} type="password" autoComplete={mode==="signup"?"new-password":"current-password"}
              placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") submit(); }}/>
          </Field>

          {err && <p style={{color:C.danger,fontSize:12.5,fontFamily:"'DM Mono',monospace",margin:"4px 0 12px"}}>{err}</p>}
          {info && <p style={{color:C.success,fontSize:12.5,fontFamily:"'DM Mono',monospace",margin:"4px 0 12px"}}>{info}</p>}

          <Btn onClick={submit} style={{ width:"100%", justifyContent:"center", marginTop:4, opacity:busy?0.6:1 }}>
            {busy ? "···" : mode==="signup" ? "CREATE ACCOUNT" : "SIGN IN"}
          </Btn>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   APP SHELL
═══════════════════════════════════════════ */
export default function App() {
  const [session, setSession]   = useState(undefined); // undefined = checking, null = signed out
  const [tab, setTab]           = useState("dashboard");
  const [loading, setLoading]   = useState(true);
  const [stack, setStackRaw]    = useState([]);
  const [sideEffects, setSERaw] = useState([]);
  const [daily, setDailyRaw]    = useState({});
  const [calcPrefill, setCalcPrefill] = useState(null);

  /* ── auth lifecycle ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  /* ── load all data once authed ── */
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    (async () => {
      const userId = session.user.id;

      const [{ data: stackRows }, { data: fxRows }, { data: logRows }] = await Promise.all([
        supabase.from("stack").select("*").order("created_at", { ascending: true }),
        supabase.from("side_effects").select("*").order("log_date", { ascending: false }),
        supabase.from("daily_logs").select("*"),
      ]);

      setStackRaw((stackRows || []).map(dbStackToApp));
      setSERaw((fxRows || []).map(dbFxToApp));

      // daily_logs rows → { "2026-06-18": { peptides: { [peptideId]: true } } }
      const dailyMap = {};
      (logRows || []).forEach(r => {
        const ds = r.log_date;
        if (!dailyMap[ds]) dailyMap[ds] = { peptides: {} };
        dailyMap[ds].peptides[r.peptide_id] = !!r.taken;
      });
      setDailyRaw(dailyMap);

      setLoading(false);
    })();
  }, [session]);

  /* ── stack: insert/delete against Supabase, keep local state in sync ── */
  const setStack = async (updater) => {
    const userId = session.user.id;
    const prevList = stack;
    const nextList = typeof updater === "function" ? updater(prevList) : updater;

    // Added: items in next not in prev (no id match)
    const prevIds = new Set(prevList.map(p => p.id));
    const added = nextList.filter(p => !prevIds.has(p.id));
    // Removed: items in prev not in next
    const nextIds = new Set(nextList.map(p => p.id));
    const removed = prevList.filter(p => !nextIds.has(p.id));

    setStackRaw(nextList); // optimistic UI update

    for (const p of removed) {
      await supabase.from("stack").delete().eq("id", p.id);
    }
    for (const p of added) {
      const { data, error } = await supabase.from("stack")
        .insert(appStackToDb(p, userId)).select().single();
      if (!error && data) {
        // swap the temporary local id for the real DB id
        setStackRaw(curr => curr.map(item => item.id === p.id ? dbStackToApp(data) : item));
      }
    }
  };

  /* ── side effects: insert/delete against Supabase ── */
  const setSideEffects = async (updater) => {
    const userId = session.user.id;
    const prevList = sideEffects;
    const nextList = typeof updater === "function" ? updater(prevList) : updater;

    const prevIds = new Set(prevList.map(f => f.id));
    const added = nextList.filter(f => !prevIds.has(f.id));
    const nextIds = new Set(nextList.map(f => f.id));
    const removed = prevList.filter(f => !nextIds.has(f.id));

    setSERaw(nextList);

    for (const f of removed) {
      await supabase.from("side_effects").delete().eq("id", f.id);
    }
    for (const f of added) {
      const { data, error } = await supabase.from("side_effects")
        .insert(appFxToDb(f, userId)).select().single();
      if (!error && data) {
        setSERaw(curr => curr.map(item => item.id === f.id ? dbFxToApp(data) : item));
      }
    }
  };

  /* ── daily toggle: upsert a single row ── */
  const patchDaily = async (patch) => {
    const userId = session.user.id;
    if (!patch.peptides) return;

    // patch.peptides is the FULL map for `today` after toggling one id —
    // diff against current state to find what changed.
    const prevMap = daily[today]?.peptides || {};
    const nextMap = patch.peptides;

    setDailyRaw(prev => ({ ...prev, [today]: { ...(prev[today]||{}), peptides: nextMap } }));

    const changedIds = Object.keys(nextMap).filter(id => !!nextMap[id] !== !!prevMap[id]);
    for (const peptideId of changedIds) {
      const taken = !!nextMap[peptideId];
      await supabase.from("daily_logs").upsert({
        user_id: userId, peptide_id: peptideId, log_date: today, taken,
      }, { onConflict: "user_id,peptide_id,log_date" });
    }
  };

  const handleUseInStack = (prefill) => { setCalcPrefill(prefill); setTab("stack"); };
  const clearPrefill     = () => setCalcPrefill(null);
  const signOut           = () => supabase.auth.signOut();

  if (session === undefined) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"grid", placeItems:"center" }}>
        <span style={{ color:C.muted, fontFamily:"'DM Mono',monospace", fontSize:13 }}>Loading…</span>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthed={()=>{}}/>;
  }

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.white,
      fontFamily:"'Inter',sans-serif" }}>
      <style>{FONTS}</style>
      <style>{`*{box-sizing:border-box;}body{margin:0;}input,select,textarea{max-width:100%;}input[type='date']{-webkit-appearance:none;appearance:none;}`}</style>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"env(safe-area-inset-top, 24px) 18px 80px" }}>

        {/* header */}
        <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:"50%",
              background:C.surface, border:`1px solid ${C.borderBright}`,
              display:"grid", placeItems:"center", overflow:"hidden" }}>
              <img src="/logo-mark.png" alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            </div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18,
              letterSpacing:"-.01em" }}>
              PEPTIDE<span style={{color:C.blue}}>TRACKER</span>
            </span>
          </div>
          <button onClick={signOut} style={{ background:"none", border:`1px solid ${C.border}`,
            borderRadius:8, padding:"6px 12px", cursor:"pointer", color:C.muted,
            fontFamily:"'DM Mono',monospace", fontSize:11 }}>SIGN OUT</button>
        </header>

        <TabBar active={tab} onChange={setTab}/>

        {loading
          ? <div style={{textAlign:"center",padding:40,color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:13}}>Loading…</div>
          : <>
            {tab==="dashboard" && <Dashboard stack={stack} daily={daily} sideEffects={sideEffects} patchDaily={patchDaily} onNav={setTab}/>}
            {tab==="stack"     && <StackTab stack={stack} setStack={setStack} prefill={calcPrefill} clearPrefill={clearPrefill}/>}
            {tab==="calc"      && <DoseCalc onUseInStack={handleUseInStack}/>}
            {tab==="effects"   && <SideEffectsTab sideEffects={sideEffects} setSideEffects={setSideEffects} stack={stack}/>}
          </>}
      </div>
    </div>
  );
}
