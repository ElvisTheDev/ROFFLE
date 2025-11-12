import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================= CORE WHEEL CONSTANTS ================= */
const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const START_OFFSET = -90; // pointer at top

/* Base (Free) spin settings */
const BASE_CAP = 20;
const BASE_REGEN_MS = 10 * 60 * 1000; // 10 minutes (non-additive!)
const TICK_MS = 1000;

/* Premium tiers — functions unchanged; display names/badges per request */
const TIERS = {
  free: { key: "free", name: "Free", regenMult: 1, cap: 20, prizeMult: 1, inviteBonus: 0, badge: "" },
  plus: { key: "plus", name: "$ROF Premium⚡️", regenMult: 2, cap: 40, prizeMult: 2, inviteBonus: 50, badge: "PREMIUM" },
  pro:  { key: "pro",  name: "$ROF Plus⭐️",    regenMult: 3, cap: 60, prizeMult: 3, inviteBonus: 75, badge: "PLUS" },
  prem: { key: "prem", name: "$ROF Pro👑",      regenMult: 5, cap: 100, prizeMult: 5, inviteBonus: 100, badge: "PRO" },
};
const TEST_PRICE_COINS = 1;

/* RNG helpers */
function randUint32(){ const a=new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; }
function randFloat(){ return randUint32()/0xffffffff; }
function randInt(min,max){ const span=max-min+1; const limit=Math.floor(0xffffffff/span)*span; let r; do{ r=randUint32(); }while(r>=limit); return min+(r%span); }
function randChoice(n){ return randInt(0,n-1); }

/* Payouts (your remap) */
function buildSlots(){
  const arr = Array(SEGMENTS_TOTAL).fill(null);
  arr[0] = { amount: 100, label: "100", type: "max" };
  const put = (idxs, amt) => idxs.forEach(n => {
    const i = n-1; if(!arr[i]) arr[i] = { amount: amt }; arr[i].label = String(amt);
  });
  put([2,4,6,8,10,12,14,16,18,20,22,24], 1);
  put([3,7,11,15,19,23], 2);
  put([5,9,13], 5);
  put([17,25], 20);
  put([21], 50);
  return arr;
}

/* Geometry */
function polarToCartesian(cx,cy,r,aDeg){ const a=(aDeg*Math.PI)/180; return {x:cx+r*Math.cos(a), y:cy+r*Math.sin(a)}; }
function wedgePath(cx,cy,r,startDeg,endDeg){
  const start = polarToCartesian(cx,cy,r,startDeg);
  const end   = polarToCartesian(cx,cy,r,endDeg);
  const large = endDeg-startDeg>180?1:0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}
function indexFromRotation(rotationDeg){
  // rotationDeg is our math angle (0 at pointer-top), growing clockwise
  const rot = ((rotationDeg%360)+360)%360;
  const target = (360-rot)%360; // top-aligned
  let i = Math.round((target-SEG_DEG/2)/SEG_DEG);
  i = ((i%SEGMENTS_TOTAL)+SEGMENTS_TOTAL)%SEGMENTS_TOTAL;
  return i;
}

/* Time */
function formatMs(ms){
  if (!ms || ms <= 0) return "Ready";
  const s = Math.ceil(ms/1000);
  const m = Math.floor(s/60);
  const r = s % 60;
  const pad = (n)=> n<10 ? `0${n}` : `${n}`;
  return `${m}:${pad(r)}`;
}

/* Easing */
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

/* Telegram + assets */
const tg = window.Telegram?.WebApp;
const CENTER_LOGO_SRC = "/logo.png";
const BRAND_LOGO_SRC  = "/rof-lg.png";
const ROF_ICON_SRC    = "/rof-bn.png";

/* ==================== WHEEL ==================== */
const Wheel = React.memo(function Wheel({
  rotorRef, wedges, slots, cx, cy, R_TRIM, TRIM_W, R_FACE,
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

      {/* ✅ ROTOR: wedges & labels ARE children of this <g>. This is the group we rotate via CSS. */}
      <g className="rotor" ref={rotorRef} data-angle="0">
        {wedges.map(({i,path})=> <path key={`p${i}`} d={path} fill={`url(#grad-${i})`} />)}
        {wedges.map(({i,x,y,mid})=>{
          const sec1=i+1;
          const textFill = sec1===1 ? "#fff" : (sec1%2===0 ? "#fff" : "#000");
          const isMax = sec1===1;
          return (
            <g key={`t${i}`} transform={`rotate(${mid+90} ${x} ${y})`}>
              <text
                x={x} y={y}
                className={`slice-txt ${isMax?"is-max":""}`}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textFill}
                filter={isMax?"url(#textGlow)":undefined}
              >
                {slots[i].label}
              </text>
            </g>
          );
        })}
      </g>

      {/* POINTER stays separate (static) */}
      <polygon
        className="pointer"
        points={`${cx-18},${pointerBaseY} ${cx+18},${pointerBaseY} ${cx},${pointerTipY}`}
      />
    </svg>
  );
}, () => true);

export default function App(){
  const slots = useMemo(buildSlots, []);
  const [bank,setBank] = useState(0);

  /* Premium state */
  const [tierKey, setTierKey] = useState("free"); // "free" | "plus" | "pro" | "prem"
  const tier = TIERS[tierKey];
  const regenMs = Math.floor(BASE_REGEN_MS / tier.regenMult);
  const spinCap = tier.cap;
  const prizeMult = tier.prizeMult;

  /* Wheel — fully DOM-driven */
  const rotorRef = useRef(null);
  const rafRef = useRef(null);
  const animBusyRef = useRef(false);
  const currentAngleRef = useRef(0);   // visual angle 0..360
  const calcRotRef = useRef(0);        // math angle (for payout)

  /* Spins/energy */
  const [spinsLeft, setSpinsLeft] = useState(BASE_CAP);
  const [nextReadyAt, setNextReadyAt] = useState(null);
  const [nextInMs, setNextInMs] = useState(0);

  /* UI */
  const [spinning,setSpinning] = useState(false);
  const [toast,setToast] = useState(null);
  const [tab,setTab] = useState("play");
  const [booting,setBooting] = useState(true);
  const [showPremium, setShowPremium] = useState(false);

  /* Sounds */
  const clickSfx = useRef(null), loopSfx = useRef(null), winSfx = useRef(null);
  useEffect(()=>{
    clickSfx.current = new Audio("/sounds/click.mp3"); clickSfx.current.preload="auto";
    loopSfx.current  = new Audio("/sounds/roll_loop.mp3"); loopSfx.current.loop=true; loopSfx.current.preload="auto";
    winSfx.current   = new Audio("/sounds/win.mp3"); winSfx.current.preload="auto";
  },[]);
  const clickS = () => { try{ clickSfx.current.currentTime=0; clickSfx.current.play(); }catch{} };
  const loopS  = () => { try{ loopSfx.current.currentTime=0; loopSfx.current.play(); }catch{} };
  const stopL  = () => { try{ loopSfx.current.pause(); loopSfx.current.currentTime=0; }catch{} };
  const winS   = () => { try{ winSfx.current.currentTime=0; winSfx.current.play(); }catch{} };

  /* Telegram splash */
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
    }, 1200);
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

  /* Sizes */
  const cx=500, cy=500;
  const R_FACE = 440 * 0.74;
  const R_TRIM = 470 * 0.74;
  const TRIM_W = 40;
  const trimOuter = R_TRIM + TRIM_W/2;
  const pointerTipY  = cy - trimOuter + 2;
  const pointerBaseY = pointerTipY - 26;

  /* Wedges (static) */
  const wedges = useMemo(()=>{
    return Array.from({length:SEGMENTS_TOTAL}, (_,i)=>{
      const start=i*SEG_DEG; const end=start+SEG_DEG; const mid=(start+end)/2;
      const path = wedgePath(cx,cy,R_FACE,start,end);
      const labelR = 360*0.74;
      const {x,y} = polarToCartesian(cx,cy,labelR,mid);
      return { i, mid, path, x, y };
    });
  },[]);

  /* --- Rotor angle write (CSS transform, no SVG attribute) --- */
  const applyAngle = (angle) => {
    const node = rotorRef.current;
    if (!node) return;
    const norm = ((angle % 360) + 360) % 360;
    currentAngleRef.current = norm;

    node.style.transformBox = "fill-box";            // crucial for SVG CSS transforms
    node.style.transformOrigin = `${cx}px ${cy}px`;  // center of viewBox
    node.style.transform = `rotate(${START_OFFSET + norm}deg)`;
    node.setAttribute("transform", ""); // keep attribute empty to avoid conflicts
    node.dataset.angle = String(norm);
    try { localStorage.setItem("rof_visAngle", String(norm)); } catch {}
    try { window.__rofAngle = norm; } catch {}
  };

  /* Restore last pose on mount (fallback chain) */
  useEffect(()=>{
    let a = null;
    try {
      const ls = localStorage.getItem("rof_visAngle");
      if (ls != null) a = parseFloat(ls);
    } catch {}
    if (a == null || Number.isNaN(a)) {
      try { if (typeof window.__rofAngle === "number") a = window.__rofAngle; } catch {}
    }
    if (a == null || Number.isNaN(a)) {
      const node = rotorRef.current;
      if (node?.dataset?.angle) {
        const da = parseFloat(node.dataset.angle);
        if (!Number.isNaN(da)) a = da;
      }
    }
    if (a == null || Number.isNaN(a)) a = 0;
    applyAngle(a);

    // restore calc rot for payout alignment
    try{
      const savedCalc = parseFloat(localStorage.getItem("rof_calcRot"));
      if(!Number.isNaN(savedCalc)) calcRotRef.current = savedCalc;
    }catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* Cancel RAF on unmount */
  useEffect(()=>()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); },[]);

  /* RAF tween (no React state) */
  const animateRotation = (from, to, durationMs, onDone) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    animBusyRef.current = true;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(t);
      const angle = from + (to - from) * eased;
      applyAngle(angle);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else { animBusyRef.current = false; onDone?.(); }
    };
    applyAngle(from);
    rafRef.current = requestAnimationFrame(step);
  };

  /* Non-additive cooldown ticker */
  useEffect(()=>{
    const tick = () => {
      const now = Date.now();
      setSpinsLeft(s => Math.min(s, spinCap));

      if (spinsLeft >= spinCap) {
        if (nextReadyAt !== null) setNextReadyAt(null);
        setNextInMs(0);
        return;
      }

      if (nextReadyAt == null) {
        setNextReadyAt(now + regenMs);
        setNextInMs(regenMs);
        return;
      }

      const remaining = nextReadyAt - now;
      setNextInMs(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        setSpinsLeft(s => Math.min(spinCap, s + 1));
        const nextCount = Math.min(spinCap, spinsLeft + 1);
        setNextReadyAt(nextCount < spinCap ? now + regenMs : null);
        setNextInMs(nextCount < spinCap ? regenMs : 0);
      }
    };

    const id = setInterval(tick, TICK_MS);
    tick();
    return ()=>clearInterval(id);
  }, [spinsLeft, nextReadyAt, regenMs, spinCap]);

  /* Spin */
  const handleSpin = () => {
    if (spinning || animBusyRef.current || spinsLeft <= 0) return;

    setSpinning(true);
    setToast(null);

    setSpinsLeft(v => Math.max(0, v - 1));
    if (spinsLeft === spinCap) {
      const now = Date.now();
      setNextReadyAt(now + regenMs);
      setNextInMs(regenMs);
    }

    const startVis = currentAngleRef.current;

    const idx = randChoice(SEGMENTS_TOTAL);
    const spins = randInt(5, 12);
    const jitter = (randFloat() * 0.8 - 0.4) * SEG_DEG;
    const center = idx * SEG_DEG + SEG_DEG / 2 + jitter;
    const toZero = (360 - (center % 360) + 360) % 360;

    const finalCalc = calcRotRef.current + spins * 360 + toZero;
    const endMod = ((finalCalc % 360) + 360) % 360;

    let visualDelta = endMod - startVis;
    if (visualDelta <= 0) visualDelta += 360;
    const extraTurns = spins - 1;
    visualDelta += extraTurns * 360;
    const endVis = startVis + visualDelta;
    const durationMs = randInt(3200, 6200);

    animateRotation(startVis, endVis, durationMs, () => {
      calcRotRef.current = finalCalc;

      const finalVis = ((endVis % 360) + 360) % 360;
      applyAngle(finalVis); // lock pose
      try{
        localStorage.setItem("rof_calcRot", String(finalCalc));
      }catch{}

      const landedIndex = indexFromRotation(finalCalc);
      const baseWin = slots[landedIndex].amount || 0;
      const won = baseWin * prizeMult;
      setBank(b => b + won);
      setToast({ text: `+${won} $ROF`, key: Date.now() });
      setTimeout(() => setToast(null), 1600);

      setSpinning(false);
    });
  };

  /* Premium purchase */
  const canAfford = (price) => bank >= price;
  const buyTier = (key) => {
    if (key === tierKey) return;
    if (!canAfford(TEST_PRICE_COINS)) {
      setToast({ text: "Not enough coins for Premium", key: Date.now() });
      setTimeout(() => setToast(null), 1600);
      return;
    }
    const t = TIERS[key];
    setBank(b => b - TEST_PRICE_COINS);
    setTierKey(key);
    setSpinsLeft(s => Math.min(s, t.cap));
    const now = Date.now();
    setNextReadyAt(spinsLeft >= t.cap ? null : (nextReadyAt ?? now + Math.floor(BASE_REGEN_MS / t.regenMult)));
    setShowPremium(false);
    setToast({ text: `${t.name} activated!`, key: Date.now() });
    setTimeout(() => setToast(null), 1600);
  };

  /* Premium modal */
  const PremiumModal = () => {
    const cards = [
      { t: TIERS.plus, bullets: [
        "Wheel spins regenerate ×2 faster",
        "Wheel cap increases to 40/40",
        "All wheel prizes ×2",
        "Invite rewards +50% from base",
      ]},
      { t: TIERS.pro, bullets: [
        "Wheel spins regenerate ×3 faster",
        "Wheel cap increases to 60/60",
        "All wheel prizes ×3",
        "Invite rewards +75% from base",
      ]},
      { t: TIERS.prem, bullets: [
        "Wheel spins regenerate ×5 faster",
        "Wheel cap increases to 100/100",
        "All wheel prizes ×5",
        "Invite rewards +100% from base",
      ]},
    ];
    return (
      <div className="modal-overlay" onClick={()=>setShowPremium(false)}>
        <div className="modal" onClick={(e)=>e.stopPropagation()}>
          <div className="modal-head">
            <div className="mh-left">
              <span className="mh-icon">👑</span>
              <div className="mh-title">Go $ROF Premium</div>
            </div>
            <button className="modal-close" onClick={()=>setShowPremium(false)}>✕</button>
          </div>

          <div className="modal-sub">Choose a tier (test price: <b>{TEST_PRICE_COINS} coin</b> each)</div>

          <div className="tier-grid">
            {cards.map(({t, bullets})=>{
              const active = t.key === tierKey;
              return (
                <div key={t.key} className={`tier-card ${active?"active":""}`}>
                  <div className="tc-top">
                    <div className="tc-name">{t.name}</div>
                    {active && <div className="tc-active">Active</div>}
                  </div>
                  <ul className="tc-list">
                    {bullets.map((b,idx)=><li key={idx}>{b}</li>)}
                  </ul>
                  <div className="tc-price">Price: {TEST_PRICE_COINS} coin</div>
                  <button
                    className="tc-buy"
                    disabled={active || !canAfford(TEST_PRICE_COINS)}
                    onClick={()=>buyTier(t.key)}
                  >
                    {active ? "Current Plan" : `Buy ${t.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="modal-foot">
            <div className="mf-note">Payments are test-mode. Real payments & pricing coming soon.</div>
            <button className="mf-back" onClick={()=>setShowPremium(false)}>Back</button>
          </div>
        </div>
      </div>
    );
  };

  /* Screens */
  const PlayScreen = () => (
    <>
      <div className="wheel-wrap compact-no-scroll">
        <Wheel
          rotorRef={rotorRef}
          wedges={wedges}
          slots={slots}
          cx={cx} cy={cy}
          R_TRIM={R_TRIM} TRIM_W={TRIM_W}
          R_FACE={R_FACE}
          pointerBaseY={pointerBaseY} pointerTipY={pointerTipY}
        />
        {/* center stack (doesn't spin) */}
        <div className="center-stack">
          <div className="center-ring" />
          <div className="center-cap" />
          <img className="center-logo-img" src={CENTER_LOGO_SRC} alt="logo" />
          <div className="center-gloss" />
        </div>
      </div>

      <div className="spin-row tight">
        <button className="btn-spin" onClick={handleSpin} disabled={spinning || animBusyRef.current || spinsLeft<=0}>
          <span className="spin-count">{spinsLeft}/{spinCap} <span className="muted">Spins left</span></span>
          <span className="spin-cta">{spinning ? "Spinning…" : "Spin"}</span>
          <span className="spin-timer">{spinsLeft<spinCap ? `Next spin in ${formatMs(nextInMs)}` : "Ready"}</span>
        </button>
      </div>
    </>
  );

  const LootScreen = () => <div className="placeholder-card">🎁 Lootboxes coming soon…</div>;
  const TopScreen  = () => <div className="placeholder-card">🏆 Leaderboards coming soon…</div>;
  const EarnScreen = () => <div className="placeholder-card">🚀 Earn coming soon…</div>;
  const TasksScreen= () => <div className="placeholder-card">🕹 Tasks coming soon…</div>;

  const Menu = () => (
    <nav className="bottom-menu">
      <button className={`menu-item ${tab==="play"?"on":""}`}  onClick={()=>setTab("play")}><span className="mi-emoji">🎮</span><span className="mi-text">Play</span></button>
      <button className={`menu-item ${tab==="loot"?"on":""}`}  onClick={()=>setTab("loot")}><span className="mi-emoji">🎁</span><span className="mi-text">Loot</span></button>
      <button className={`menu-item ${tab==="top" ?"on":""}`}  onClick={()=>setTab("top")} ><span className="mi-emoji">🏆</span><span className="mi-text">Top100</span></button>
      <button className={`menu-item ${tab==="earn"?"on":""}`}  onClick={()=>setTab("earn")}><span className="mi-emoji">🚀</span><span className="mi-text">Earn</span></button>
      <button className={`menu-item ${tab==="tasks"?"on":""}`} onClick={()=>setTab("tasks")}><span className="mi-emoji">🕹</span><span className="mi-text">Tasks</span></button>
    </nav>
  );

  /* Badge mapping for current status */
  const statusBadge = (() => {
    if (tierKey === "free") return { cls: "free", text: "No status" };
    if (tierKey === "plus") return { cls: "premium", text: "Premium⚡️" };
    if (tierKey === "pro")  return { cls: "plus",    text: "Plus⭐️" };
    return { cls: "pro", text: "Pro👑" }; // prem
  })();

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

            <div className="premium-row">
              <button className="btn-premium" onClick={()=>setShowPremium(true)}>👑 Go $ROF Premium</button>
              <span className={`badge ${statusBadge.cls}`}>{statusBadge.text}</span>
            </div>
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

      {showPremium && <PremiumModal />}
    </div>
  );
}
