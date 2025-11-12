import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================= CORE WHEEL CONSTANTS ================= */
const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const START_OFFSET = -90; // show 0° at TOP (under the pointer)

/* Spins/energy settings */
const SPIN_CAP = 20;
const REGEN_MS = 10 * 60 * 1000; // 10 minutes in ms
const TICK_MS = 1000; // UI update cadence

/* RNG helpers */
function randUint32(){ const a=new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; }
function randFloat(){ return randUint32()/0xffffffff; }
function randInt(min,max){ const span=max-min+1; const limit=Math.floor(0xffffffff/span)*span; let r; do{ r=randUint32(); }while(r>=limit); return min+(r%span); }
function randChoice(n){ return randInt(0,n-1); }

/* Build payout map (with your new values) */
function buildSlots(){
  const arr = Array(SEGMENTS_TOTAL).fill(null);
  // Section 1: MAX WIN (now 100)
  arr[0] = { amount: 100, label: "100", type: "max", tone: "max" };

  const put = (idxs, amt) => idxs.forEach(n => {
    const i = n-1; if(!arr[i]) arr[i] = { amount: amt, type: "flat" }; arr[i].label = String(amt);
  });

  // Old → New remap:
  // old 5  → 1
  // old 10 → 2
  // old 20 → 5
  // old 50 → 20
  // old 100→ 50
  // old 1000→ 100 (set above)

  // old 5 were: 2,4,6,8,10,12,14,16,18,20,22,24 → now 1
  put([2,4,6,8,10,12,14,16,18,20,22,24], 1);

  // old 10 were: 3,7,11,15,19,23 → now 2
  put([3,7,11,15,19,23], 2);

  // old 20 were: 5,9,13 → now 5
  put([5,9,13], 5);

  // old 50 were: 17,25 → now 20
  put([17,25], 20);

  // old 100 was: 21 → now 50
  put([21], 50);

  // Tone (for text color logic)
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
  if (ms <= 0) return "Ready";
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

export default function App(){
  const slots = useMemo(buildSlots, []);

  /* Wheel angles */
  const [calcRot, setCalcRot] = useState(0);     // math angle (can grow)
  const [visAngle, setVisAngle] = useState(0);   // visual angle (0..360)
  const rotorRef = useRef(null);

  /* Spins/energy */
  const [spinsLeft, setSpinsLeft] = useState(SPIN_CAP);
  const lastRefillRef = useRef(Date.now()); // base timestamp that marches forward as we regen
  const [nextInMs, setNextInMs] = useState(0);

  /* UI state */
  const [spinning,setSpinning] = useState(false);
  const [spinDurationMs,setSpinDurationMs] = useState(4800);
  const [bank,setBank] = useState(0);
  const [toast,setToast] = useState(null);
  const [tab,setTab] = useState("play"); // play | loot | top | earn | tasks
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
  const R_FACE = 440 * 0.74;   // smaller to avoid scroll; ~26% shrink vs original
  const R_TRIM = 470 * 0.74;
  const TRIM_W = 40;

  /* Pointer — tip sits on the gold trim outer edge */
  const trimOuter = R_TRIM + TRIM_W/2;
  const pointerTipY  = cy - trimOuter + 2;
  const pointerBaseY = pointerTipY - 26;

  /* ------------------- WEDGES ------------------- */
  const wedges = useMemo(()=>{
    return Array.from({length:SEGMENTS_TOTAL}, (_,i)=>{
      const start=i*SEG_DEG; const end=start+SEG_DEG; const mid=(start+end)/2;
      const path = wedgePath(cx,cy,R_FACE,start,end);
      const labelR = 360*0.74; // match face shrink
      const {x,y} = polarToCartesian(cx,cy,labelR,mid);
      const sec1=i+1;
      const textFill = sec1===1 ? "#fff" : (sec1%2===0 ? "#fff" : "#000");
      return { i, mid, path, x, y, textFill, isMax: sec1===1 };
    });
  },[]);

  /* ================= IMPERATIVE ROTATION ================= */
  const applyRotorAngle = (angleDeg, withTransition) => {
    const node = rotorRef.current;
    if (!node) return;
    node.style.transformBox = "view-box";
    node.style.transformOrigin = "500px 500px";
    node.style.willChange = "transform";
    node.style.transition = withTransition
      ? `transform ${spinDurationMs}ms cubic-bezier(.12,.8,.12,1)`
      : "none";
    node.style.transform = `rotate(${START_OFFSET + angleDeg}deg)`;
  };

  // Keep rotor at its last visual angle when Play tab shows or visAngle changes
  useEffect(() => {
    if (tab === "play" && rotorRef.current) applyRotorAngle(visAngle, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, visAngle]);

  /* ------------------- SPIN REGEN TICKER ------------------- */
  useEffect(()=>{
    const tick = () => {
      const now = Date.now();
      let spins = spinsLeft;
      let base = lastRefillRef.current;

      if (spins < SPIN_CAP) {
        const elapsed = now - base;
        const gained = Math.floor(elapsed / REGEN_MS);
        if (gained > 0) {
          spins = Math.min(SPIN_CAP, spins + gained);
          base += gained * REGEN_MS;
        }
      }

      // next timer display
      let nextMs = 0;
      if (spins >= SPIN_CAP) {
        base = now; // at cap, keep base fresh
        nextMs = 0;
      } else {
        nextMs = REGEN_MS - (now - base);
        if (nextMs < 0) nextMs = 0;
      }

      // commit
      if (spins !== spinsLeft) setSpinsLeft(spins);
      if (base !== lastRefillRef.current) lastRefillRef.current = base;
      setNextInMs(nextMs);
    };

    // initial and interval
    tick();
    const id = setInterval(tick, TICK_MS);
    return ()=>clearInterval(id);
  }, [spinsLeft]);

  /* ------------------- SPIN HANDLER ------------------- */
  const playSfx = async r => { try{ if(r?.current){ r.current.currentTime=0; await r.current.play(); } }catch{} };
  const stopSfx = r => { try{ if(r?.current){ r.current.pause(); r.current.currentTime=0; } }catch{} };

  const handleSpin = async () => {
    if (spinning || spinsLeft <= 0) return;
    setSpinning(true);
    setToast(null);

    // consume one spin, and move base forward by REGEN_MS
    setSpinsLeft(v => Math.max(0, v - 1));
    lastRefillRef.current = lastRefillRef.current + REGEN_MS;

    const dur = randInt(3200, 6200);
    setSpinDurationMs(dur);

    await playSfx(clickSfx);
    await playSfx(loopSfx);

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

    // 1) set start with transition OFF, force reflow
    applyRotorAngle(startVis, false);
    rotorRef.current?.getBoundingClientRect();
    // 2) animate to end
    requestAnimationFrame(() => applyRotorAngle(endVis, true));

    // finish on transition end
    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      rotorRef.current?.removeEventListener("transitionend", onEnd);

      setCalcRot(finalCalc);                 // math angle
      setVisAngle(((endVis % 360) + 360) % 360); // leave wheel exactly where it finished

      stopSfx(loopSfx); playSfx(winSfx);

      const landedIndex = indexFromRotation(finalCalc);
      const win = slots[landedIndex];
      setBank(b => b + (win.amount || 0));
      setToast({ text: `+${win.amount} $ROF`, key: Date.now() });
      setTimeout(() => setToast(null), 1600);

      setSpinning(false);
    };

    rotorRef.current?.addEventListener("transitionend", onEnd);
    // generous fallback (in case transitionend is missed)
    setTimeout(onEnd, dur + 1500);
  };

  /* ------------------- SCREENS ------------------- */
  const PlayScreen = () => (
    <>
      {/* WHEEL */}
      <div className="wheel-wrap compact-no-scroll">
        {/* wheel (pointer lives INSIDE this SVG) */}
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
                  {slots[i].label}
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

        {/* static center cap */}
        <div className="center-stack">
          <div className="center-ring" />
          <div className="center-cap" />
          <img className="center-logo-img" src={CENTER_LOGO_SRC} alt="logo" />
          <div className="center-gloss" />
        </div>
      </div>

      {/* SPIN button — raised higher, shows limits + timer */}
      <div className="spin-row tight">
        <button className="btn-spin" onClick={handleSpin} disabled={spinning || spinsLeft<=0}>
          <span className="spin-count">{spinsLeft}/{SPIN_CAP} <span className="muted">Spins left</span></span>
          <span className="spin-cta">{spinning ? "Spinning…" : "Spin"}</span>
          <span className="spin-timer">{spinsLeft<SPIN_CAP ? `Next spin in ${formatMs(nextInMs)}` : "Ready"}</span>
        </button>
      </div>
    </>
  );

  const LootScreen = () => (
    <div className="placeholder-card">🎁 Lootboxes coming soon…</div>
  );

  const TopScreen = () => {
    const [subtab,setSubtab] = useState("holders"); // holders | invites
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

  /* ------------- MENU ICON+LABEL STACKED (emoji over text) ------------- */
  const Menu = () => (
    <nav className="bottom-menu">
      <button className={`menu-item ${tab==="play"?"on":""}`}  onClick={()=>setTab("play")}>
        <span className="mi-emoji" aria-hidden>🎮</span>
        <span className="mi-text">Play</span>
      </button>
      <button className={`menu-item ${tab==="loot"?"on":""}`}  onClick={()=>setTab("loot")}>
        <span className="mi-emoji" aria-hidden>🎁</span>
        <span className="mi-text">Loot</span>
      </button>
      <button className={`menu-item ${tab==="top" ?"on":""}`}  onClick={()=>setTab("top")}>
        <span className="mi-emoji" aria-hidden>🏆</span>
        <span className="mi-text">Top100</span>
      </button>
      <button className={`menu-item ${tab==="earn"?"on":""}`}  onClick={()=>setTab("earn")}>
        <span className="mi-emoji" aria-hidden>🚀</span>
        <span className="mi-text">Earn</span>
      </button>
      <button className={`menu-item ${tab==="tasks"?"on":""}`} onClick={()=>setTab("tasks")}>
        <span className="mi-emoji" aria-hidden>🕹</span>
        <span className="mi-text">Tasks</span>
      </button>
    </nav>
  );

  return (
    <div className="tg-app bg-img" style={{"--bg":theme.bg,"--text":theme.text}}>
      {/* Splash (2s) */}
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

          {/* Balance — compacted top spacing */}
          <section className="balance-block compacted">
            <div className="bal-line1">Your $ROF Balance:</div>
            <div className="bal-line2">
              <img className="bal-icon" src={ROF_ICON_SRC} alt="$ROF" />
              <span className="bal-value">{bank}</span>
            </div>
            <button className="btn-premium" onClick={()=>alert("Premium modal will go here.")}>👑 Go $ROF Premium</button>
          </section>

          {/* Screens */}
          <div className="screen flex-grow">
            {tab==="play"   && <PlayScreen />}
            {tab==="loot"   && <LootScreen />}
            {tab==="top"    && <TopScreen />}
            {tab==="earn"   && <EarnScreen />}
            {tab==="tasks"  && <TasksScreen />}
          </div>

          {/* Fade-out toast */}
          {toast && <div key={toast.key} className="toast-win">{toast.text}</div>}

          {/* Bottom nav (emoji over text) */}
          <Menu />
        </div>
      )}
    </div>
  );
}
