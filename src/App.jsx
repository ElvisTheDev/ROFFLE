import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25-section wheel (SVG-based so each slice can have a true 180° linear gradient)
 *
 * Colors per request:
 *  - Section 1 (MAX): linear gradient top→bottom #43cda3 → #490e6d
 *  - All other EVEN sections: basic BLACK (linear gradient #404040 → #000000)
 *  - All other ODD sections:  basic WHITE (linear gradient #ffffff → #a8a8a8)
 *
 * Payout text rules:
 *  - WHITE text on BLACK sections
 *  - BLACK text on WHITE sections
 *  - WHITE text on MAX section
 *
 * Also:
 *  - Red pointer with dark red outline
 *  - Thick gold outer rim (dominant)
 *  - Center logo stays STILL (does not rotate)
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4
const BASE_OFFSET = -90; // start at top

// payouts
function buildSlots() {
  const arr = Array(SEGMENTS_TOTAL).fill(null);

  // sec1 = 1: MAX
  arr[0] = { amount: 1000, label: "+1000", type: "max" };

  const put = (idxs, amt) => {
    idxs.forEach((n) => {
      const i = n - 1;
      if (!arr[i]) arr[i] = { amount: amt, type: "flat" };
      arr[i].label = `+${amt}`;
    });
  };

  put([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], 5);
  put([3, 7, 11, 15, 19, 23], 10);
  put([5, 9, 13], 20);
  put([17, 25], 50);
  put([21], 100);

  // tones
  for (let sec1 = 2; sec1 <= SEGMENTS_TOTAL; sec1++) {
    const i = sec1 - 1;
    if (!arr[i]) continue;
    arr[i].tone = sec1 % 2 === 0 ? "black" : "white"; // even black, odd white
  }
  arr[0].tone = "max";

  // safety labels
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] && !arr[i].label) arr[i].label = `+${arr[i].amount ?? ""}`.trim();
  }
  return arr;
}

// geometry helpers
function polarToCartesian(cx, cy, r, aDeg) {
  const a = (aDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function wedgePath(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    `Z`,
  ].join(" ");
}

const tg = window.Telegram?.WebApp;
const CENTER_LOGO_SRC = "/logo.png"; // place your logo at public/logo.png

export default function App() {
  const slots = useMemo(buildSlots, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // degrees
  const [lastWin, setLastWin] = useState(null);
  const [bank, setBank] = useState(0);
  const [theme, setTheme] = useState({ bg: "#000", text: "#e8ecf2" });

  // sounds
  const clickSfx = useRef(null), loopSfx = useRef(null), winSfx = useRef(null);
  useEffect(() => {
    clickSfx.current = new Audio("/sounds/click.mp3"); clickSfx.current.preload = "auto";
    loopSfx.current = new Audio("/sounds/roll_loop.mp3"); loopSfx.current.loop = true; loopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3"); winSfx.current.preload = "auto";
  }, []);

  // Telegram theme + MainButton
  useEffect(() => {
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({ bg: p.bg_color || "#000", text: p.text_color || "#e8ecf2" });
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

  // choose win index
  const chooseIndex = () => Math.floor(Math.random() * SEGMENTS_TOTAL);
  // make slice center land at top
  const computeFinalRotation = (current, idx) => {
    const center = idx * SEG_DEG + SEG_DEG / 2;
    const toZero = (360 - (center % 360)) % 360;
    const extra = 5 + Math.floor(Math.random() * 3);
    return current + extra * 360 + toZero;
  };

  const play = async r => { try { if (r?.current) { r.current.currentTime = 0; await r.current.play(); } } catch {} };
  const stop = r => { try { if (r?.current) { r.current.pause(); r.current.currentTime = 0; } } catch {} };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true); setLastWin(null);
    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx); await play(loopSfx);
    const idx = chooseIndex();
    const finalRot = computeFinalRotation(rotation, idx);
    requestAnimationFrame(() => setRotation(finalRot));
    const D = 4800;
    setTimeout(() => {
      const win = slots[idx];
      setLastWin({ index: idx, ...win });
      setBank(b => b + (win.amount || 0));
      stop(loopSfx); play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, D + 90);
  };

  // SVG geometry (normalized 1000x1000)
  const cx = 500, cy = 500;
  const R_FACE = 440;    // face radius
  const R_TRIM = 470;    // gold rim outer radius
  const TRIM_W = 40;     // ~40px thick (dominant)
  const pointerY = 36;

  // Precompute slice geometry + label placement
  const wedges = useMemo(() => {
    return Array.from({ length: SEGMENTS_TOTAL }, (_, i) => {
      const start = BASE_OFFSET + i * SEG_DEG;
      const end = start + SEG_DEG;
      const mid = (start + end) / 2;
      const path = wedgePath(cx, cy, R_FACE, start, end);

      // label position (radial)
      const labelR = 360; // distance from center
      const p = polarToCartesian(cx, cy, labelR, mid);
      const sec1 = i + 1;

      // color & text fill
      let fillRef = `grad-${i}`;
      let textFill = "#000"; // default
      if (sec1 === 1) { // MAX
        textFill = "#fff";
      } else if (sec1 % 2 === 0) { // even -> black
        textFill = "#fff";
      } else { // odd -> white
        textFill = "#000";
      }

      return { i, sec1, start, end, mid, path, labelX: p.x, labelY: p.y, fillRef, textFill };
    });
  }, []);

  // label data
  const labels = useMemo(() => {
    return wedges.map(({ i, sec1, mid, labelX, labelY }) => {
      const s = slots[i];
      const text = s?.label || "";
      const isMax = s?.type === "max";
      const rotate = mid + 90; // upright text along radius
      return { i, sec1, text, isMax, x: labelX, y: labelY, rotate };
    });
  }, [wedges, slots]);

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
          {/* Pointer – RED with dark red outline */}
          <svg className="pointer-svg" viewBox="0 0 1000 80" aria-hidden>
            <polygon
              points={`${cx-18},${pointerY} ${cx+18},${pointerY} ${cx},${pointerY+26}`}
              fill="#e61a1a"
              stroke="#7a0f0f"
              strokeWidth="6"
              strokeLinejoin="round"
            />
          </svg>

          {/* WHEEL SVG — the group below rotates */}
          <svg className="wheel-svg" viewBox="0 0 1000 1000" aria-hidden>
            <defs>
              {/* slice gradients */}
              {wedges.map(({ i, sec1 }) => {
                if (sec1 === 1) {
                  // MAX gradient (purple -> teal)
                  return (
                    <linearGradient id={`grad-${i}`} key={`g${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#43cda3" />
                      <stop offset="100%" stopColor="#490e6d" />
                    </linearGradient>
                  );
                } else if (sec1 % 2 === 0) {
                  // even = black section gradient
                  return (
                    <linearGradient id={`grad-${i}`} key={`g${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#404040" />
                      <stop offset="100%" stopColor="#000000" />
                    </linearGradient>
                  );
                } else {
                  // odd = white section gradient
                  return (
                    <linearGradient id={`grad-${i}`} key={`g${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#a8a8a8" />
                    </linearGradient>
                  );
                }
              })}
              {/* gold rim gradient */}
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f6e19a" />
                <stop offset="50%" stopColor="#caa03a" />
                <stop offset="100%" stopColor="#7a5d19" />
              </linearGradient>
            </defs>

            {/* GOLD OUTER RIM (dominant) */}
            <circle
              cx={cx}
              cy={cy}
              r={R_TRIM}
              fill="none"
              stroke="url(#goldGrad)"
              strokeWidth={TRIM_W}
              filter="url(#)"
            />

            {/* Rotating group: slices + labels rotate together */}
            <g
              className={`rotor ${spinning ? "motion" : ""}`}
              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "500px 500px" }}
            >
              {/* wedges */}
              {wedges.map(({ i, path, fillRef }) => (
                <path key={`p${i}`} d={path} fill={`url(#${fillRef})`} />
              ))}

              {/* labels (on each slice) */}
              {labels.map(({ i, text, isMax, x, y, rotate }) => (
                <g key={`t${i}`} transform={`rotate(${rotate} ${x} ${y})`}>
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`slice-txt ${isMax ? "is-max" : ""}`}
                    data-sec={i + 1}
                  >
                    {text}
                  </text>
                </g>
              ))}
            </g>
          </svg>

          {/* NON-rotating center stack — logo stays still */}
          <div className="center-stack">
            <div className="center-ring" />
            <div className="center-cap" />
            <img className="center-logo-img" src={CENTER_LOGO_SRC} alt="logo" />
            <div className="center-gloss" />
          </div>
        </div>

        {lastWin && (
          <div className="result">
            Stopped on <b>#{lastWin.index + 1}</b> —{" "}
            <span className={`pill ${lastWin.type === "max" ? "max" : ""}`}>{lastWin.label}</span> ⇒ <b>+{lastWin.amount}</b>
          </div>
        )}
      </div>
    </div>
  );
}
