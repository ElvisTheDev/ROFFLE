import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25-section SVG wheel. True per-slice 180° linear gradients.
 * Colors:
 *  - #1 (MAX): #43cda3 → #490e6d
 *  - Even (black): #404040 → #000000
 *  - Odd  (white): #ffffff → #a8a8a8
 * Labels: 5,10,20,50,100,1000 (no “+”)
 * Text color: white on black, black on white, white on MAX.
 * Pointer: red with dark red outline.
 * Center logo: DOES NOT rotate.
 * Randomness: crypto-secure random index, random spins (5–12), random intra-slice jitter, random duration (3.2–6.2s).
 * Winner computed from final rotation under pointer.
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const START_OFFSET = -90; // render offset so 0° is at TOP

// ---- Crypto-secure randomness helpers ----
function randUint32() {
  const a = new Uint32Array(1);
  window.crypto.getRandomValues(a);
  return a[0];
}
function randFloat() {
  // 0 <= x < 1 with 32-bit precision
  return randUint32() / 0xffffffff;
}
function randInt(min, maxInclusive) {
  const span = maxInclusive - min + 1;
  // unbiased rejection sampling
  const limit = Math.floor(0xffffffff / span) * span;
  let r;
  do { r = randUint32(); } while (r >= limit);
  return min + (r % span);
}
function randChoice(n) {
  return randInt(0, n - 1);
}

// ---- Payout map ----
function buildSlots() {
  const arr = Array(SEGMENTS_TOTAL).fill(null);
  // #1 MAX
  arr[0] = { amount: 1000, label: "1000", type: "max", tone: "max" };

  const put = (idxs, amt) => {
    idxs.forEach((n) => {
      const i = n - 1;
      if (!arr[i]) arr[i] = { amount: amt, type: "flat" };
      arr[i].label = String(amt);
    });
  };

  put([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], 5);
  put([3, 7, 11, 15, 19, 23], 10);
  put([5, 9, 13], 20);
  put([17, 25], 50);
  put([21], 100);

  // tones: even -> black, odd -> white; #1 already set
  for (let sec1 = 2; sec1 <= SEGMENTS_TOTAL; sec1++) {
    const i = sec1 - 1;
    if (!arr[i]) continue;
    arr[i].tone = sec1 % 2 === 0 ? "black" : "white";
  }
  return arr;
}

// ---- Geometry helpers (angles from +X; START_OFFSET only at render) ----
function polarToCartesian(cx, cy, r, aDeg) {
  const a = (aDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function wedgePath(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

// Map FINAL rotation to the index under the TOP pointer
function indexFromRotation(rotationDeg) {
  const rot = ((rotationDeg % 360) + 360) % 360;
  // c_i + rotation ≡ 0 (mod 360), with c_i = i*SEG_DEG + SEG_DEG/2
  const target = (360 - rot) % 360;
  let i = Math.round((target - SEG_DEG / 2) / SEG_DEG);
  i = ((i % SEGMENTS_TOTAL) + SEGMENTS_TOTAL) % SEGMENTS_TOTAL;
  return i;
}

const tg = window.Telegram?.WebApp;
const CENTER_LOGO_SRC = "/logo.png"; // put your logo at /public/logo.png

export default function App() {
  const slots = useMemo(buildSlots, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // degrees (we add START_OFFSET only at render)
  const [spinDurationMs, setSpinDurationMs] = useState(4800);
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

  // Compute a fully random final rotation
  function computeRandomFinalRotation(current) {
    // 1) choose a random target index uniformly
    const idx = randChoice(SEGMENTS_TOTAL);

    // 2) choose a random number of full spins (spin power)
    const spins = randInt(5, 12); // 5..12 full turns (uniform)

    // 3) add a random intra-slice jitter so it doesn't always land at the exact center
    // keep within ±40% of slice so text stays legible under pointer
    const jitter = (randFloat() * 0.8 - 0.4) * SEG_DEG;

    // slice center angle (no offset)
    const center = idx * SEG_DEG + SEG_DEG / 2 + jitter;

    // amount to bring that center to 0°
    const toZero = (360 - (center % 360) + 360) % 360;

    const finalRot = current + spins * 360 + toZero;

    return { finalRot, idxHint: idx }; // idxHint for debugging (we still calculate winner from finalRot)
  }

  const play = async r => { try { if (r?.current) { r.current.currentTime = 0; await r.current.play(); } } catch {} };
  const stop = r => { try { if (r?.current) { r.current.pause(); r.current.currentTime = 0; } } catch {} };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true); setLastWin(null);

    // randomize duration (3.2s–6.2s) to break timing patterns
    const dur = randInt(3200, 6200);
    setSpinDurationMs(dur);

    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx); await play(loopSfx);

    const { finalRot } = computeRandomFinalRotation(rotation);
    requestAnimationFrame(() => setRotation(finalRot));

    setTimeout(() => {
      // Compute winner from where the wheel actually stopped
      const landedIndex = indexFromRotation(finalRot);
      const win = slots[landedIndex];
      setLastWin({ index: landedIndex, ...win });
      setBank(b => b + (win.amount || 0));
      stop(loopSfx); play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, dur + 120); // small buffer after transition
  };

  // SVG geometry
  const cx = 500, cy = 500;
  const R_FACE = 440;
  const R_TRIM = 470;
  const TRIM_W = 40;
  const pointerY = 36;

  // Wedges (no baked offset)
  const wedges = useMemo(() => {
    return Array.from({ length: SEGMENTS_TOTAL }, (_, i) => {
      const start = i * SEG_DEG;
      const end = start + SEG_DEG;
      const mid = (start + end) / 2;
      const path = wedgePath(cx, cy, R_FACE, start, end);

      // label position
      const labelR = 360;
      const { x, y } = polarToCartesian(cx, cy, labelR, mid);

      // text color rule
      const sec1 = i + 1;
      const textFill =
        sec1 === 1 ? "#ffffff" : (sec1 % 2 === 0 ? "#ffffff" : "#000000");

      return { i, sec1, start, end, mid, path, labelX: x, labelY: y, textFill };
    });
  }, []);

  // Labels
  const slotsMemo = useMemo(() => slots, [slots]);
  const labels = useMemo(() => {
    return wedges.map(({ i, sec1, mid, labelX, labelY, textFill }) => {
      const s = slotsMemo[i];
      const text = s?.label || "";
      const isMax = s?.type === "max";
      const rotate = mid + 90;
      return { i, sec1, text, isMax, x: labelX, y: labelY, rotate, textFill };
    });
  }, [wedges, slotsMemo]);

  // Inline transition with random duration
  const rotorStyle = {
    transform: `rotate(${START_OFFSET + rotation}deg)`,
    transformOrigin: "500px 500px",
    transition: `transform ${spinDurationMs}ms cubic-bezier(.12,.8,.12,1)`
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

          {/* WHEEL SVG */}
          <svg className="wheel-svg" viewBox="0 0 1000 1000" aria-hidden>
            <defs>
              {/* Slice linear gradients (top→bottom) */}
              {Array.from({ length: SEGMENTS_TOTAL }, (_, i) => {
                const sec1 = i + 1;
                const id = `grad-${i}`;
                if (sec1 === 1) {
                  return (
                    <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#43cda3" />
                      <stop offset="100%" stopColor="#490e6d" />
                    </linearGradient>
                  );
                } else if (sec1 % 2 === 0) {
                  return (
                    <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#404040" />
                      <stop offset="100%" stopColor="#000000" />
                    </linearGradient>
                  );
                } else {
                  return (
                    <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#a8a8a8" />
                    </linearGradient>
                  );
                }
              })}

              {/* Gold rim gradient */}
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f6e19a" />
                <stop offset="50%" stopColor="#caa03a" />
                <stop offset="100%" stopColor="#7a5d19" />
              </linearGradient>

              {/* Dark purple glow for MAX text */}
              <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#36125e" floodOpacity="1"/>
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#36125e" floodOpacity=".85"/>
                <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#36125e" floodOpacity=".6"/>
              </filter>
            </defs>

            {/* GOLD OUTER RIM */}
            <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="url(#goldGrad)" strokeWidth={TRIM_W} />

            {/* Rotating group with RANDOM duration */}
            <g className="rotor" style={rotorStyle}>
              {/* Slices */}
              {wedges.map(({ i, path }) => (
                <path key={`p${i}`} d={path} fill={`url(#grad-${i})`} />
              ))}

              {/* Payout labels per-slice */}
              {labels.map(({ i, text, isMax, x, y, rotate, textFill }) => (
                <g key={`t${i}`} transform={`rotate(${rotate} ${x} ${y})`}>
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`slice-txt ${isMax ? "is-max" : ""}`}
                    fill={textFill}
                    filter={isMax ? "url(#textGlow)" : undefined}
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
            Stopped on <b>#{lastWin.index + 1}</b> — <span className={`pill ${lastWin.type === "max" ? "max" : ""}`}>{lastWin.label}</span> ⇒ <b>{lastWin.amount}</b>
          </div>
        )}
      </div>
    </div>
  );
}
