import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25 sections, same payouts:
 * 1: MAX +1000
 * 2,4,6,8,10,12,14,16,18,20,22,24: +5
 * 3,7,11,15,19,23: +10
 * 5,9,13: +20
 * 17,25: +50
 * 21: +100
 *
 * Visuals:
 * - Brand metallic chrome wedges (TEAL/PURPLE/BLACK/WHITE), cycling after MAX
 * - Gold outer rim is dominant (thick, bright, studded)
 * - Center cap shows embossed "R"
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const BASE_OFFSET = -90; // align 0deg to top pointer

// Chrome palettes: [edge, specular, edge]
const CHROME = {
  black:   ["#0a0b10", "#8a96a3", "#0b0d12"],
  white:   ["#a9b3bf", "#ffffff", "#87919c"],       // “white” chrome (cool silver)
  teal:    ["#0b3a2e", "#3ef7c0", "#06251c"],       // brand teal chrome
  purple:  ["#2a1a5e", "#9c84ff", "#1a0f3d"],       // brand purple chrome
  max:     ["#150e2b", "#7c5cff", "#19FB9B"],       // MAX = sapphire neon (brand)
};

// Build wheel with payouts
function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  // MAX
  slots[0] = { label: "+1000", amount: 1000, type: "max", tone: "max" };

  const put = (idxs, amount) =>
    idxs.forEach(n => {
      const i = n - 1;
      if (!slots[i]) slots[i] = { label: `+${amount}`, amount, type: "flat" };
    });

  put([2,4,6,8,10,12,14,16,18,20,22,24], 5);
  put([3,7,11,15,19,23], 10);
  put([5,9,13], 20);
  put([17,25], 50);
  put([21], 100);

  // Tone assignment (brand cycle after MAX): black → white → purple → teal → repeat
  const cycle = ["black", "white", "purple", "teal"];
  let c = 0;
  for (let sec1 = 2; sec1 <= SEGMENTS_TOTAL; sec1++) {
    const i = sec1 - 1;
    if (!slots[i]) continue;
    slots[i].tone = cycle[c % cycle.length];
    c++;
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
  const [theme, setTheme] = useState({ bg: "#000000", text: "#e8ecf2" });

  // sounds
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
      setTheme({ bg: p.bg_color || "#000000", text: p.text_color || "#e8ecf2" });
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

  // Metallic conic paint: each slice 3 stops (edge/specular/edge)
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc, end = acc + SEG_DEG;
      const { tone } = wheel[i];
      const pal = CHROME[tone];
      const m1 = start + SEG_DEG * 0.32;
      const m2 = start + SEG_DEG * 0.64;
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
    // Land chosen slice center at top (after BASE_OFFSET)
    const center = idx*SEG_DEG + SEG_DEG/2;
    const toZero = (360 - (center % 360)) % 360;
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
    <div className="tg-app brand-bg" style={{ "--bg": theme.bg, "--text": theme.text }}>
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
            style={{ background: wheelBackground, transform: `rotate(${BASE_OFFSET + rotation}deg)` }}
          >
            {/* Dominant champagne-gold outer rim */}
            <div className="outer-trim" aria-hidden />
            <div className="trim-gleam" aria-hidden />
            <div className="trim-studs" aria-hidden />

            {/* Chrome inner ring divider */}
            <div className="inner-chrome" aria-hidden />

            {/* Metallic overlays */}
            <div className="noise" aria-hidden />
            <div className="spokes" aria-hidden />
            <div className="specular" aria-hidden />

            {/* Center hardware + brand "R" */}
            <div className="center-ring" aria-hidden />
            <div className="center-cap" aria-hidden />
            <div className="center-logo" aria-hidden>R</div>
            <div className="center-gloss" aria-hidden />

            {/* Labels (winner gets neon halo only) */}
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
