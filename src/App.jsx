import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================= CORE WHEEL CONSTANTS ================= */
const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const START_OFFSET = -90; // show 0° at TOP (under the pointer)

/* Spins/energy settings */
const SPIN_CAP = 20;
const REGEN_MS = 10 * 60 * 1000; // 10 minutes
const TICK_MS = 1000;

/* RNG helpers */
function randUint32(){ const a=new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; }
function randFloat(){ return randUint32()/0xffffffff; }
function randInt(min,max){ const span=max-min+1; const limit=Math.floor(0xffffffff/span)*span; let r; do{ r=randUint32(); }while(r>=limit); return min+(r%span); }
function randChoice(n){ return randInt(0,n-1); }

/* Build payout map (your remapped values) */
function buildSlots(){
  const arr = Array(SEGMENTS_TOTAL).fill(null);
  // Section 1: MAX (now 100)
  arr[0] = { amount: 100, label: "100", type: "max", tone: "max" };

  const put = (idxs, amt) => idxs.forEach(n => {
    const i = n-1; if(!arr[i]) arr[i] = { amount: amt, type: "flat" }; arr[i].label = String(amt);
  });

  // old 5  → 1
  put([2,4,6,8,10,12,14,16,18,20,22,24], 1);
  // old 10 → 2
  put([3,7,11,15,19,23], 2);
  // old 20 → 5
  put([5,9,13], 5);
  // old 50 → 20
  put([17,25], 20);
  // old 100→ 50
  put([21], 50);

  for(let sec1=2; sec1<=SEGMENTS_TOTAL; sec1++){
    const i=sec1-1; if(!arr[i]) continue; arr[i].tone = sec1%2===0 ? "black" : "white";
  }
  return arr;
}

/* Geometry helpers */
function polarToCartesian(cx,cy,r,aDeg){ const a=(aDeg*Math.PI)/180; return {x:cx+r*Math.cos(a), y:cy+r*Math.sin(a)}; }
function wedgePath(cx,cy,r,startDeg,endDeg){
  const start = polarToCartesian(cx,cy,r,startDeg);
  const end   = polarToCartesian(cx,cy,r,endDeg);
  const large = endDeg-startDeg>180?1:0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}
function indexFromRotation(rotationDeg){
  const rot = ((rotationDeg%360)+360)%360;
  const target = (360-rot)%360;
  let i = Math.round((target-SEG_DEG/2)/SEG_DEG);
  i = ((i%SEGMENTS_TOTAL)+SEGMENTS_TOTAL)%SEGMENTS_TOTAL;
  return i;
}

/* Time formatting */
function formatMs(ms){
  if (!ms || ms <= 0) return "Ready";
  const s = Math.ceil(ms/1000);
  const m = Math.floor(s/60);
  const r = s % 60;
  const pad = (n)=> n<10 ? `0${n}` : `${n}`;
  return `${m}:${pad(r)}`;
}

const tg = window.Telegram?.WebApp;
const CENTER_LOGO_SRC = "/logo.png";
const BRAND_LOGO_SRC  = "/rof-lg.png";
const ROF_ICON_SRC    = "/rof-bn.png";

/* =========================================================
   Pure, memoized wheel that never re-renders mid-spin
   ========================================================= */
const Wheel = React.memo(function Wheel({
  rotorRef, wedges, cx, cy, R_TRIM, TRIM_W, R_FACE,
  pointerBaseY, pointerTipY
}){
  return (
    <svg className="wheel-svg" viewBox="0 0 1000 1000" aria-hidden>
      <defs>
        {Array.from({length:SEGMENTS_TOTAL}, (_,i)=>{
          const sec1=i+1; const id=`grad-${i}`;
          if(sec1===1) return (
            <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#43cda3" />
              <stop offset="100%" stopColor="#490e6d" />
            </linearGradient>
          );
          else if(sec1%2===0) return (
            <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#404040" />
              <stop offset="100%" stopColor="#000000" />
            </linearGradient>
          );
          else return (
            <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#a8a8a8" />
            </linearGradient>
          );
        })}
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f6e19a" />
          <stop offset="50%" stopColor="#caa03a" />
          <stop offset="100%" stopColor="#7a5d19" />
        </linearGradient>
        <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#36125e" floodOpacity="1"/>
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#36125e" floodOpacity=".85"/>
          <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#36125e" floodOpacity=".6"/>
        </filter>
      </defs>

      {/* gold trim */}
      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="url(#goldGrad)" strokeWidth={TRIM_W} />

      {/* ROTOR — controlled imperatively */}
      <g className="rotor" ref={rotorRef}>
        {wedges.map(({i,path})=> <path key={`p${i}`} d={path} fill={`url(#grad-${i})`} />)}
        {wedges.map(({i,x,y,mid,textFill,isMax})=>(
          <g key={`t${i}`} transform={`rotate(${mid+90} ${x} ${y})`}>
            <text x={x} y={y} className={`slice-txt ${isMax?"is-max":""}`}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={textFill} filter={isMax?"url(#textGlow)":undefined}>
              {i===0 ? "100" : ( (i+1)%2===0 ? "" : "" )}{/* label set below anyway */}
              {wedges[i].label}
            </text>
          </g>
        ))}
      </g>

      {/* POINTER */}
      <polygon
        className="pointer"
        points={`${cx-18},${pointerBaseY} ${cx+18},${pointerBaseY} ${cx},${pointerTipY}`}
      />
    </svg>
  );
}, () => true); // never re-render

export default function App(){
  const slots = useMemo(buildSlots, []);

  /* Wheel angles */
  const [calcRot, setCalcRot] = useState(0);     // math angle (can grow)
  const [visAngle, setVisAngle] = useState(0);   // visual angle (0..360)
  const rotorRef = useRef(null);

  /* Spins/energy (non-additive cooldown) */
  const [spinsLeft, setSpinsLeft] = useState(SPIN_CAP);
  const [nextReadyAt, setNextReadyAt] = useState(null); // timestamp (ms) when 1 spin will be credited
  const [nextInMs, setNextInMs] = useState(0);

  /* UI state */
  const [spinning,setSpinning] = useState(false);
  const [bank,setBank] = useState(0);
  const [toast,setToast] = useState(null);
  const [tab,setTab] = useState("play");
  const [booting,setBooting] = useState(true);

  /* Sounds */
  const clickSfx = useRef(null), loopSfx = useRef(null), winSfx = useRef(null);
  useEffect(()=>{
    clickSfx.current = new Audio("/sounds/click.mp3"); clickSfx.current.preload="auto";
    loopSfx.current  = new Audio("/sounds/roll_loop.mp3"); loopSfx.current.loop=true; loopSfx.current.preload="auto";
    winSfx.current   = new Audio("/sounds/win.mp3"); winSfx.current.preload="auto";
  },[]);

  /* Telegram boot + 2s splash */
  useEffect(()=>{
    const timer = setTimeout(()=>{
      setBooting(false);
      if(!tg) return;
      tg.ready();
      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");
      tg.expand();
      tg.MainButton.hide();
      tg.MainButton.disable?.();
    }, 2000);
    return ()=>clearTimeout(timer);
  },[]);

  /* Theme follow */
  const [theme,setTheme] = useState({ bg:"#000", text:"#e8ecf2" });
  useEffect(()=>{
    if(!tg) return;
    const sync = ()=> {
      const p=tg.themeParams||{};
      setTheme({ bg:p.bg_color||"#000", text:p.text_color||"#e8ecf2" });
    };
    sync(); tg.onEvent?.("themeChanged",sync);
    return ()=>tg.offEvent?.("themeChanged",sync);
  },[]);

  /* ------------------- SIZES ------------------- */
  const cx=500, cy=500;
  const R_FACE = 440 * 0.74;
  const R_TRIM = 470 * 0.74;
  const TRIM_W = 40;

  /* Pointer — tip on gold trim outer edge */
  const trimOuter = R_TRIM + TRIM_W/2;
  const pointerTipY  = cy - trimOuter + 2;
  const pointerBaseY = pointerTipY - 26;

  /* ------------------- WEDGES (static) ------------------- */
  const wedges = useMemo(()=>{
    return Array.from({length:SEGMENTS_TOTAL}, (_,i)=>{
      const start=i*SEG_DEG; const end=start+SEG_DEG; const mid=(start+end)/2;
      const path = wedgePath(cx,cy,R_FACE,start,end);
      const labelR = 360*0.74;
      const {x,y} = polarToCartesian(cx,cy,labelR,mid);
      const sec1=i+1;
      const textFill = sec1===1 ? "#fff" : (sec1%2===0 ? "#fff" : "#000");
      return { i, mid, path, x, y, textFill, isMax: sec1===1, label: buildSlots()[i].label };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // static

  /* ================= IMPERATIVE ROTATION ================= */
  const applyRotorAngle = (angleDeg, withTransition, durationMs = 0) => {
    const node = rotorRef.current;
    if (!node) return;
    node.style.transformBox = "view-box";
    node.style.transformOrigin = "500px 500px";
    node.style.willChange = "transform";
    node.style.transition = withTransition
      ? `transform ${durationMs}ms cubic-bezier(.12,.8,.12,1)`
      : "none";
    node.style.transform = `rotate(${START_OFFSET + angleDeg}deg)`;
  };

  // Only set initial pose when Play tab appears and NOT spinning
  useEffect(() => {
    if (tab === "play" && !spinning && rotorRef.current) {
      applyRotorAngle(visAngle, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* ------------------- NON-ADDITIVE COOLDOWN TICKER ------------------- */
  useEffect(()=>{
    const tick = () => {
      const now = Date.now();

      if (spinsLeft >= SPIN_CAP) {
        if (nextReadyAt !== null) setNextReadyAt(null);
        setNextInMs(0);
        return;
      }

      if (nextReadyAt == null) {
        setNextReadyAt(now + REGEN_MS);
        setNextInMs(REGEN_MS);
        return;
      }

      const remaining = nextReadyAt - now;
      setNextInMs(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        setSpinsLeft(s => Math.min(SPIN_CAP, s + 1)); // +1 only
        setNextReadyAt(prev => {
          const after = (spinsLeft + 1);
          return after < SPIN_CAP ? now + REGEN_MS : null;
        });
        setNextInMs( (spinsLeft + 1) < SPIN_CAP ? REGEN_MS : 0 );
      }
    };

    const id = setInterval(tick, TICK_MS);
    tick();
    return ()=>clearInterval(id);
  }, [spinsLeft, nextReadyAt]);

  /* ------------------- SPIN HANDLER ------------------- */
  const clickS = () => { try{ clickSfx.current.currentTime=0; clickSfx.current.play(); }catch{} };
  const loopS  = () => { try{ loopSfx.current.currentTime=0; loopSfx.current.play(); }catch{} };
  const stopL  = () => { try{ loopSfx.current.pause(); loopSfx.current.currentTime=0; }catch{} };
  const winS   = () => { try{ winSfx.current.currentTime=0; winSfx.current.play(); }catch{} };

  const handleSpin = () => {
    if (spinning || spinsLeft <= 0) return;
    setSpinning(true);
    setToast(null);

    // consume one spin
    setSpinsLeft(v => Math.max(0, v - 1));
    // start cooldown if we were at cap before spending
    if (spinsLeft === SPIN_CAP) {
      const now = Date.now();
      setNextReadyAt(now + REGEN_MS);
      setNextInMs(REGEN_MS);
    }

    const durationMs = randInt(3200, 6200);

    clickS(); loopS();

    const startVis = visAngle;

    // choose random target
    const idx = randChoice(SEGMENTS_TOTAL);
    const spins = randInt(5, 12);
    const jitter = (randFloat() * 0.8 - 0.4) * SEG_DEG;
    const center = idx * SEG_DEG + SEG_DEG / 2 + jitter;
    const toZero = (360 - (center % 360) + 360) % 360;

    // final calculation angle (for payouts)
    const finalCalc = calcRot + spins * 360 + toZero;
    const endMod = ((finalCalc % 360) + 360) % 360;

    // visual delta from current vis angle
    let visualDelta = endMod - startVis;
    if (visualDelta <= 0) visualDelta += 360;
    const extraTurns = spins - 1;
    visualDelta += extraTurns * 360;

    const endVis = startVis + visualDelta;

    // --- clean two-step transition (no interference) ---
    applyRotorAngle(startVis, false);
    // force layout
    // eslint-disable-next-line no-unused-expressions
    rotorRef.current?.getBoundingClientRect();
    // animate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyRotorAngle(endVis, true, durationMs);
      });
    });

    // finish on transition end
    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      rotorRef.current?.removeEventListener("transitionend", onEnd);

      setCalcRot(finalCalc);
      setVisAngle(((endVis % 360) + 360) % 360);

      stopL(); winS();

      const landedIndex = indexFromRotation(finalCalc);
      const win = slots[landedIndex];
      setBank(b => b + (win.amount || 0));
      setToast({ text: `+${win.amount} $ROF`, key: Date.now() });
      setTimeout(() => setToast(null), 1600);

      setSpinning(false);
    };

    rotorRef.current?.addEventListener("transitionend", onEnd);
    // safety fallback
    setTimeout(onEnd, durationMs + 1500);
  };

  /* ------------------- SCREENS ------------------- */
  const PlayScreen = () => (
    <>
      <div className="wheel-wrap compact-no-scroll">
        <Wheel
          rotorRef={rotorRef}
          wedges={wedges}
          cx={cx} cy={cy}
          R_TRIM={R_TRIM} TRIM_W={TRIM_W}
          R_FACE={R_FACE}
          pointerBaseY={pointerBaseY} pointerTipY={pointerTipY}
        />
        {/* static center cap (separate DOM so the rotor never re-mounts) */}
        <div className="center-stack">
          <div className="center-ring" />
          <div className="center-cap" />
          <img className="center-logo-img" src={CENTER_LOGO_SRC} alt="logo" />
          <div className="center-gloss" />
        </div>
      </div>

      {/* SPIN button — with non-additive cooldown */}
      <div className="spin-row tight">
        <button className="btn-spin" onClick={handleSpin} disabled={spinning || spinsLeft<=0}>
          <span className="spin-count">{spinsLeft}/{SPIN_CAP} <span className="muted">Spins left</span></span>
          <span className="spin-cta">{spinning ? "Spinning…" : "Spin"}</span>
          <span className="spin-timer">{spinsLeft<SPIN_CAP ? `Next spin in ${formatMs(nextInMs)}` : "Ready"}</span>
        </button>
      </div>
    </>
  );

  const LootScreen = () => <div className="placeholder-card">🎁 Lootboxes coming soon…</div>;

  const TopScreen = () => {
    const [subtab,setSubtab] = useState("holders");
    const sample = Array.from({length:8}, (_,i)=>({
      id:i+1,
      name:`User ${i+1}`,
      pic:`https://api.dicebear.com/7.x/thumbs/svg?seed=${i+1}`,
      balance: Math.floor(Math.random()*5000)+200,
      invites: Math.floor(Math.random()*200)
    }));
    const list = subtab==="holders"
      ? [...sample].sort((a,b)=>b.balance-a.balance)
      : [...sample].sort((a,b)=>b.invites-a.invites);
    return (
      <div className="leaderboard">
        <div className="lb-tabs">
          <button className={`lb-tab ${subtab==="holders"?"on":""}`} onClick={()=>setSubtab("holders")}>$ROF holders</button>
          <button className={`lb-tab ${subtab==="invites"?"on":""}`} onClick={()=>setSubtab("invites")}>$ROF invites</button>
        </div>
        <div className="lb-list">
          {list.map((u,idx)=>(
            <div className="lb-row" key={u.id}>
              <div className="rank">{idx+1}</div>
              <img className="avatar" src={u.pic} alt="" />
              <div className="who">
                <div className="name">{u.name}</div>
                <div className="sub">{subtab==="holders" ? `$ROF ${u.balance.toLocaleString()}` : `${u.invites} invited`}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const EarnScreen  = () => <div className="placeholder-card">🚀 Earn coming soon…</div>;
  const TasksScreen = () => <div className="placeholder-card">🕹 Tasks coming soon…</div>;

  const Menu = () => (
    <nav className="bottom-menu">
      <button className={`menu-item ${tab==="play"?"on":""}`}  onClick={()=>setTab("play")}><span className="mi-emoji">🎮</span><span className="mi-text">Play</span></button>
      <button className={`menu-item ${tab==="loot"?"on":""}`}  onClick={()=>setTab("loot")}><span className="mi-emoji">🎁</span><span className="mi-text">Loot</span></button>
      <button className={`menu-item ${tab==="top" ?"on":""}`}  onClick={()=>setTab("top")} ><span className="mi-emoji">🏆</span><span className="mi-text">Top100</span></button>
      <button className={`menu-item ${tab==="earn"?"on":""}`}  onClick={()=>setTab("earn")}><span className="mi-emoji">🚀</span><span className="mi-text">Earn</span></button>
      <button className={`menu-item ${tab==="tasks"?"on":""}`} onClick={()=>setTab("tasks")}><span className="mi-emoji">🕹</span><span className="mi-text">Tasks</span></button>
    </nav>
  );

  return (
    <div className="tg-app bg-img" style={{"--bg":theme.bg,"--text":theme.text}}>
      {booting && (
        <div className="splash">
          <img src={BRAND_LOGO_SRC} alt="ROFFLE" />
          <div className="spinner"></div>
        </div>
      )}

      {!booting && (
        <div className="compact no-scroll">
          <header className="header">
            <img src={BRAND_LOGO_SRC} alt="ROFFLE" className="brand-logo" />
            <div className="header-right" />
          </header>

          <section className="balance-block compacted">
            <div className="bal-line1">Your $ROF Balance:</div>
            <div className="bal-line2">
              <img className="bal-icon" src={ROF_ICON_SRC} alt="$ROF" />
              <span className="bal-value">{bank}</span>
            </div>
            <button className="btn-premium" onClick={()=>alert("Premium modal will go here.")}>👑 Go $ROF Premium</button>
          </section>

          <div className="screen flex-grow">
            {tab==="play"   && <PlayScreen />}
            {tab==="loot"   && <LootScreen />}
            {tab==="top"    && <TopScreen />}
            {tab==="earn"   && <EarnScreen />}
            {tab==="tasks"  && <TasksScreen />}
          </div>

          {toast && <div key={toast.key} className="toast-win">{toast.text}</div>}

          <Menu />
        </div>
      )}
    </div>
  );
}
