import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25-section mapping (1-indexed -> 0-indexed)
 * 1: +1000 (MAX metallic black)
 * 2,4,6,8,10,12,14,16,18,20,22,24: +5   (green chrome)
 * 3,7,11,15,19,23: +10                  (blue chrome)
 * 5,9,13: +20                           (purple chrome)
 * 17,25: +50                            (red chrome)
 * 21: +100                              (gold chrome)
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const BASE_OFFSET = -90; // rotate so 0deg is top

// Base hues (we’ll build chrome from these)
const HUES = {
  green: "#1fa24f",
  blue:  "#1f56c4",
  purple:"#6a2fd8",
  red:   "#d83a34",
  gold:  "#d49a06",
};

// Metallic black for MAX
const MAX_METAL = ["#0c0c10", "#17171c", "#0a0a0e"]; // edge / spec / edge

// Chrome palettes (edge / specular line / opposite edge) per hue
const CHROME = {
  green: ["#0e5c30", "#5af2a0", "#0a3f21"],
  blue:  ["#0f2f6b", "#7db2ff", "#0a214d"],
  purple:["#3a1491", "#c0a3ff", "#270b64"],
  red:   ["#6f1410", "#ff9690", "#4b0e0b"],
  gold:  ["#6a4b07", "#ffd37a", "#4a3305"],
};

// Build wheel with your exact indices
function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  slots[0] = { label: "+1000", amount: 1000, type: "max" };

  const put = (idxs, amount, tone) =>
    idxs.forEach(n => {
      const i = n - 1;
      slots[i] = { label: `+${amount}`, amount, type: "flat", tone };
    });

  put([2,4,6,8,10,12,14,16,18,20,22,24], 5,  "green");
  put([3,7,11,15,19,23],                  10, "blue");
  put([5,9,13],                            20, "purple");
  put([17,25],                             50, "red");
  put([21],                                100,"gold");

  for (let i=0;i<slots.length;i++) if (!slots[i]) slots[i]={label:"+5",amount:5,type:"flat",tone:"green"};
  return slots;
}

const tg = window.Telegram?.WebApp;

export default function App() {
  const wheel = useMemo(buildWheel25, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [bank, setBank] = useState(0);
  const [theme, setTheme] = useState({ bg: "#0b0b13", text: "#eaeaea" });

  // audio
  const clickSfx = useRef(null), rollLoopSfx = useRef(null), winSfx = useRef(null);
  useEffect(() => {
    clickSfx.current = new Audio("/sounds/click.mp3");
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3"); rollLoopSfx.current.loop = true;
    winSfx.current = new Audio("/sounds/win.mp3");
  }, []);

  // Telegram theme + MainButton
  useEffect(() => {
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({ bg: p.bg_color || "#0b0b13", text: p.text_color || "#eaeaea" });
    };
    sync(); tg.onEvent?.("themeChanged", sync);
    return () => tg.offEvent?.("themeChanged", sync);
  }, []);
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setText(spinning ? "Spinning..." : "Spin");
    spinning ? tg.MainButton.showProgress() : tg.MainButton.hideProgress();
    tg.MainButton[spinning ? "disable" : "enable"]?.(); tg.MainButton.show();
    const h = () => handleSpin();
    tg.MainButton.onClick(h); return () => tg.MainButton.offClick(h);
  }, [spinning]);

  // Metallic conic paint: each slice = edge → specular → edge within its arc
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc, end = acc + SEG_DEG;
      const s = wheel[i];
      if (s.type === "max") {
        const m1 = start + SEG_DEG*0.35, m2 = start + SEG_DEG*0.55;
        parts.push(`${MAX_METAL[0]} ${start}deg ${m1}deg`);
        parts.push(`${MAX_METAL[1]} ${m1}deg ${m2}deg`);
        parts.push(`${MAX_METAL[2]} ${m2}deg ${end}deg`);
      } else {
        const pal = CHROME[s.tone]; // [edge, spec, edge]
        const m1 = start + SEG_DEG*0.33, m2 = start + SEG_DEG*0.60;
        parts.push(`${pal[0]} ${start}deg ${m1}deg`);
        parts.push(`${pal[1]} ${m1}deg ${m2}deg`);
        parts.push(`${pal[2]} ${m2}deg ${end}deg`);
      }
      acc = end;
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, [wheel]);

  const labels = useMemo(
    () => wheel.map((s,i)=>({ text:s.label, angle:i*SEG_DEG+SEG_DEG/2, isMax:s.type==="max" })),
    [wheel]
  );

  const chooseIndex = () => Math.floor(Math.random()*SEGMENTS_TOTAL);
  const computeFinalRotation = (current, idx) => {
    const center = idx*SEG_DEG + SEG_DEG/2; // from CSS 0deg (right)
    const toZero = (360 - (center % 360)) % 360; // land center at 0deg (top after BASE_OFFSET)
    const extra = 5 + Math.floor(Math.random()*3);
    return current + extra*360 + toZero;
  };

  const play = async r => { try { if(r?.current){ r.current.currentTime=0; await r.current.play(); } } catch{} };
  const stop = r => { try { if(r?.current){ r.current.pause(); r.current.currentTime=0; } } catch{} };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true); setLastWin(null);
    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx); await play(rollLoopSfx);
    const idx = chooseIndex();
    const finalRot = computeFinalRotation(rotation, idx);
    requestAnimationFrame(()=>setRotation(finalRot));
    const D = 4800;
    setTimeout(()=> {
      const win = wheel[idx];
      setLastWin({ index: idx, ...win });
      setBank(b=>b+(win.amount||0));
      stop(rollLoopSfx); play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, D+90);
  };

  return (
    <div className="tg-app" style={{ "--bg": theme.bg, "--text": theme.text }}>
      <div className="compact">
        <header className="header">
          <div className="bank">💰 {bank}</div>
          <button className="spin" onClick={handleSpin} disabled={spinning}>
            {spinning ? "Spinning..." : "Spin"}
          </button>
        </header>

        <div className="wheel-wrap">
          <div className={`pointer ${lastWin && !spinning ? "pulse" : ""}`}><div className="pointer-led" /></div>

          <div
            className={`wheel ${spinning ? "motion" : ""}`}
            style={{
              background: wheelBackground,
              transform: `rotate(${BASE_OFFSET + rotation}deg)`,
              "--hl-width": `${SEG_DEG}deg`,
              "--show-win": lastWin && !spinning ? 1 : 0,
            }}
          >
            {/* OUTER GOLD TRIM + chrome inner ring (from your CSS) */}
            <div className="outer-trim" aria-hidden />
            <div className="trim-gleam" aria-hidden />
            <div className="inner-chrome" aria-hidden />

            {/* metallic surface overlays */}
            <div className="noise" aria-hidden />
            <div className="spokes" aria-hidden />
            <div className="specular" aria-hidden />

            {/* center hardware */}
            <div className="center-ring" aria-hidden />
            <div className="center-cap" aria-hidden />
            <div className="center-gloss" aria-hidden />

            {/* labels */}
            {labels.map(({text,angle,isMax},k)=>(
              <div
                key={k}
                className={`slice-label ${isMax ? "is-max" : ""}`}
                style={{ transform:`rotate(${angle}deg) translate(0, -43%) rotate(${-angle}deg)` }}
              >
                {text}
              </div>
            ))}

            {/* winner glow locked to TOP wedge */}
            <div className="winner-overlay" aria-hidden />
          </div>
        </div>

        {lastWin && (
          <div className="result">
            Stopped on <b>#{lastWin.index+1}</b> — <span className={`pill ${lastWin.type==="max"?"max":""}`}>{lastWin.label}</span> ⇒ <b>+{lastWin.amount}</b>
          </div>
        )}
      </div>
    </div>
  );
}
