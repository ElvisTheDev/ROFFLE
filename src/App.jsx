import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Wheel: 25 sections (1-indexed spec -> 0-indexed code)
 *
 * Colours (visual only):
 *  - 1:   Red chrome (MAX)
 *  - 2,4,6,8,10,12,14,16,18,20,22,24: Black chrome
 *  - 3,5,7,9,11,13,15,17,19,21,23,25: Silver chrome
 *
 * Payouts (kept as previously configured):
 *  - MAX (1): +1000
 *  - 5 coins:  sections 2,4,6,8,10,12,14,16,18,20,22,24
 *  - 10 coins: sections 3,7,11,15,19,23
 *  - 20 coins: sections 5,9,13
 *  - 50 coins: sections 17,25
 *  - 100 coins: section 21
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const BASE_OFFSET = -90; // make 0deg at TOP (pointer)

const CHROME = {
  // three-stop (edge / specular / edge) for metallic feel
  black:  ["#0a0a0e", "#9aa3ad", "#0b0d12"],
  silver: ["#9fa8b3", "#ffffff", "#858e99"],
  redMax: ["#4e0b08", "#ff9c92", "#2f0605"], // strong red chrome for MAX
};

function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);

  // MAX (section 1)
  slots[0] = { label: "+1000", amount: 1000, type: "max", tone: "redMax" };

  // helpers to assign payouts (visual tones handled later)
  const put = (idxs, amount) =>
    idxs.forEach(n => { slots[n - 1] = slots[n - 1] || { label: `+${amount}`, amount, type: "flat" }; });

  put([2,4,6,8,10,12,14,16,18,20,22,24], 5);
  put([3,7,11,15,19,23], 10);
  put([5,9,13], 20);
  put([17,25], 50);
  put([21], 100);

  // Now assign CHROME tones by your new colour spec (visual only)
  for (let sec1 = 1; sec1 <= SEGMENTS_TOTAL; sec1++) {
    const i = sec1 - 1;
    if (sec1 === 1) { slots[i].tone = "redMax"; continue; }
    if ([2,4,6,8,10,12,14,16,18,20,22,24].includes(sec1)) {
      slots[i].tone = "black";
    } else {
      // 3,5,7,9,11,13,15,17,19,21,23,25
      slots[i].tone = "silver";
    }
    // ensure label exists
    if (!slots[i].label) slots[i].label = `+${slots[i].amount || 5}`;
  }

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
    clickSfx.current = new Audio("/sounds/click.mp3"); clickSfx.current.preload = "auto";
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3"); rollLoopSfx.current.loop = true; rollLoopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3"); winSfx.current.preload = "auto";
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

  // Metallic conic paint per slice (edge/specular/edge)
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc, end = acc + SEG_DEG;
      const s = wheel[i];
      const pal = CHROME[s.tone === "redMax" ? "redMax" : s.tone]; // black/silver or redMax
      // widen specular for stronger chrome
      const m1 = start + SEG_DEG * 0.30, m2 = start + SEG_DEG * 0.62;
      parts.push(`${pal[0]} ${start}deg ${m1}deg`);
      parts.push(`${pal[1]} ${m1}deg ${m2}deg`);
      parts.push(`${pal[2]} ${m2}deg ${end}deg`);
      acc = end;
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, [wheel]);

  const labels = useMemo(
    () => wheel.map((s,i)=>({ idx:i, text:s.label, angle:i*SEG_DEG+SEG_DEG/2, isMax:s.type==="max" })),
    [wheel]
  );

  const chooseIndex = () => Math.floor(Math.random()*SEGMENTS_TOTAL);
  const computeFinalRotation = (current, idx) => {
    const center = idx*SEG_DEG + SEG_DEG/2; // CSS 0deg is right
    const toZero = (360 - (center % 360)) % 360; // land at top after BASE_OFFSET
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
          <div className={`pointer ${lastWin && !spinning ? "pulse" : ""}`}>
            <div className="pointer-led" />
          </div>

          <div
            className={`wheel ${spinning ? "motion" : ""}`}
            style={{
              background: wheelBackground,
              transform: `rotate(${BASE_OFFSET + rotation}deg)`,
              // no winner overlay anymore (removed)
            }}
          >
            {/* OUTER GOLD TRIM (thicker) + chrome inner ring */}
            <div className="outer-trim" aria-hidden />
            <div className="trim-gleam" aria-hidden />
            <div className="inner-chrome" aria-hidden />

            {/* metallic overlays */}
            <div className="noise" aria-hidden />
            <div className="spokes" aria-hidden />
            <div className="specular" aria-hidden />

            {/* center hardware */}
            <div className="center-ring" aria-hidden />
            <div className="center-cap" aria-hidden />
            <div className="center-gloss" aria-hidden />

            {/* labels; add 'won' class to the winning one (text glow only) */}
            {labels.map(({idx,text,angle,isMax})=>(
              <div
                key={idx}
                className={`slice-label ${isMax ? "is-max" : ""} ${lastWin && lastWin.index===idx ? "won" : ""}`}
                style={{ transform:`rotate(${angle}deg) translate(0, -43%) rotate(${-angle}deg)` }}
              >
                {text}
              </div>
            ))}
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
