import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25 sections — payouts unchanged
 * 1: MAX +1000
 * 2,4,6,8,10,12,14,16,18,20,22,24: +5
 * 3,7,11,15,19,23: +10
 * 5,9,13: +20
 * 17,25: +50
 * 21: +100
 *
 * Visuals:
 * - Metallic (subtle) wedges in brand colours: black / white / purple / teal
 * - Narrow, soft specular line in the middle of each slice (not stripy)
 * - Thick champagne-gold outer rim
 * - Center cap = black puck with your logo image
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const BASE_OFFSET = -90; // align 0deg to top pointer

// ───────────────────────────────────────────────────────────
// Metallic palettes per tone (edge→mid→specular→mid→edge)
// Kept low-contrast so it feels metallic, not stripy.
const METAL = {
  black:   ["#0b0d12", "#151922", "#8b95a1", "#151922", "#0a0c11"],
  white:   ["#88929e", "#aeb8c4", "#ffffff", "#aeb8c4", "#808a96"],
  purple:  ["#1b1438", "#2e235b", "#a79aff", "#2e235b", "#181234"],
  teal:    ["#06261d", "#0d3e30", "#40f6c8", "#0d3e30", "#052019"],
  max:     ["#120d24", "#241a4a", "#7c5cff", "#0f2f2a", "#0c111f"], // subtle purple→teal cues
};

// ───────────────────────────────────────────────────────────
function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  // MAX
  slots[0] = { label: "+1000", amount: 1000, type: "max", tone: "max" };

  const setPayout = (idxs, amount) =>
    idxs.forEach(n => {
      const i = n - 1;
      if (!slots[i]) slots[i] = { label: `+${amount}`, amount, type: "flat" };
    });

  setPayout([2,4,6,8,10,12,14,16,18,20,22,24], 5);
  setPayout([3,7,11,15,19,23], 10);
  setPayout([5,9,13], 20);
  setPayout([17,25], 50);
  setPayout([21], 100);

  // Brand cycle after MAX: black → white → purple → teal → repeat
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
// change this to your actual file name under /public (e.g. /roffle-logo.png)
const CENTER_LOGO_SRC = "/logo.png";

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

  // ───────────────────────────────────────────────────────────
  // Soft metallic conic paint: 5 stops per slice with a narrow specular band (~8%)
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc, end = acc + SEG_DEG;
      const pal = METAL[wheel[i].tone]; // [edge, mid1, spec, mid2, edge]
      const s1 = start + SEG_DEG * 0.25; // 25%
      const s2 = start + SEG_DEG * 0.46; // 46%
      const s3 = start + SEG_DEG * 0.54; // 54%  (specular band ~8%)
      const s4 = start + SEG_DEG * 0.75; // 75%

      parts.push(`${pal[0]} ${start}deg ${s1}deg`);
      parts.push(`${pal[1]} ${s1}deg ${s2}deg`);
      parts.push(`${pal[2]} ${s2}deg ${s3}deg`);
      parts.push(`${pal[3]} ${s3}deg ${s4}deg`);
      parts.push(`${pal[4]} ${s4}deg ${end}deg`);
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
            {/* Dominant gold outer rim */}
            <div className="outer-trim" aria-hidden />
            <div className="trim-gleam" aria-hidden />
            <div className="trim-studs" aria-hidden />

            {/* Chrome inner ring divider */}
            <div className="inner-chrome" aria-hidden />

            {/* Metallic overlays */}
            <div className="noise" aria-hidden />
            <div className="spokes" aria-hidden />
            <div className="specular" aria-hidden />

            {/* Center hardware + YOUR LOGO on black puck */}
            <div className="center-ring" aria-hidden />
            <div className="center-cap" aria-hidden />
            <img className="center-logo-img" src={CENTER_LOGO_SRC} alt="Roffle logo" />
            <div className="center-gloss" aria-hidden />

            {/* Labels (winner text gets neon halo only) */}
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
