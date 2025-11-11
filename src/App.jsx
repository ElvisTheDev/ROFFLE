import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Wheel: 25 sections
 * Payouts:
 * 1: MAX +1000
 * 2,4,6,8,10,12,14,16,18,20,22,24: +5
 * 3,7,11,15,19,23: +10
 * 5,9,13: +20
 * 17,25: +50
 * 21: +100
 *
 * Visuals (as requested):
 * - Section 1: basic purple→teal gradient (not chrome).
 * - All other EVEN sections: basic BLACK.
 * - All other ODD sections: basic WHITE.
 * - Gold outer rim is thick and dominant.
 * - Center logo sits above the wheel and does NOT rotate.
 * - Labels are placed per-slice, so payouts do NOT pile onto one section.
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const BASE_OFFSET = -90; // align 0deg to top pointer

// Flat colours
const FLAT_BLACK = "#0b0c0f";
const FLAT_WHITE = "#e9eef6";
const GRAD_PURPLE = "#7c5cff";
const GRAD_TEAL = "#19FB9B";

// Center logo file (place it in /public). Change if your filename differs.
const CENTER_LOGO_SRC = "/logo.png";

function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);

  // Section 1: MAX
  slots[0] = { label: "+1000", amount: 1000, type: "max", tone: "max" };

  const put = (idxs, amount) =>
    idxs.forEach((n) => {
      const i = n - 1;
      if (!slots[i]) slots[i] = { amount, type: "flat" };
      slots[i].label = `+${amount}`; // ensure every mapped section gets its own label
    });

  put([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], 5);
  put([3, 7, 11, 15, 19, 23], 10);
  put([5, 9, 13], 20);
  put([17, 25], 50);
  put([21], 100);

  // Colour assignment: 1 = gradient; even = BLACK; odd = WHITE
  for (let sec1 = 2; sec1 <= SEGMENTS_TOTAL; sec1++) {
    const i = sec1 - 1;
    if (!slots[i]) continue;
    slots[i].tone = sec1 % 2 === 0 ? "black" : "white";
  }

  // Safety: ensure labels exist for all non-empty slots
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && !slots[i].label) {
      slots[i].label = `+${slots[i].amount ?? ""}`.trim();
    }
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
  const clickSfx = useRef(null),
    rollLoopSfx = useRef(null),
    winSfx = useRef(null);

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
    sync();
    tg.onEvent?.("themeChanged", sync);
    return () => tg.offEvent?.("themeChanged", sync);
  }, []);
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setText(spinning ? "Spinning..." : "Spin");
    spinning ? tg.MainButton.showProgress() : tg.MainButton.hideProgress();
    tg.MainButton[spinning ? "disable" : "enable"]?.();
    tg.MainButton.show();
    const h = () => handleSpin();
    tg.MainButton.onClick(h);
    return () => tg.MainButton.offClick(h);
  }, [spinning]);

  /**
   * Paint the wheel:
   *  - Slice #1: purple→teal gradient across its arc.
   *  - Others: flat black/white slices.
   */
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;

    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc;
      const end = acc + SEG_DEG;

      if (i === 0) {
        // Gradient within slice 1
        const mid = start + SEG_DEG * 0.5;
        parts.push(`${GRAD_PURPLE} ${start}deg ${mid}deg`);
        parts.push(`${GRAD_TEAL} ${mid}deg ${end}deg`);
      } else {
        const isEven = ((i + 1) % 2 === 0);
        const color = isEven ? FLAT_BLACK : FLAT_WHITE;
        parts.push(`${color} ${start}deg ${end}deg`);
      }
      acc = end;
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, []);

  // Label descriptors (one per slice, radial layout)
  const labels = useMemo(
    () =>
      wheel.map((s, i) => ({
        idx: i,
        text: s.label,
        angle: i * SEG_DEG + SEG_DEG / 2,
        isMax: s.type === "max",
      })),
    [wheel]
  );

  const chooseIndex = () => Math.floor(Math.random() * SEGMENTS_TOTAL);

  // Ensure the chosen slice's CENTER lands at the top pointer
  const computeFinalRotation = (current, idx) => {
    const center = idx * SEG_DEG + SEG_DEG / 2;
    const toZero = (360 - (center % 360)) % 360;
    const extra = 5 + Math.floor(Math.random() * 3); // 5..7 spins
    return current + extra * 360 + toZero;
  };

  const play = async (r) => { try { if (r?.current) { r.current.currentTime = 0; await r.current.play(); } } catch {} };
  const stop = (r) => { try { if (r?.current) { r.current.pause(); r.current.currentTime = 0; } } catch {} };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWin(null);

    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx);
    await play(rollLoopSfx);

    const idx = chooseIndex();
    const finalRot = computeFinalRotation(rotation, idx);
    requestAnimationFrame(() => setRotation(finalRot));

    const D = 4800;
    setTimeout(() => {
      const win = wheel[idx];
      setLastWin({ index: idx, ...win });
      setBank((b) => b + (win.amount || 0));
      stop(rollLoopSfx);
      play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, D + 90);
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
          {/* Pointer */}
          <div className={`pointer ${lastWin && !spinning ? "pulse" : ""}`}>
            <div className="pointer-led" />
          </div>

          {/* ROTATING wheel face */}
          <div
            className={`wheel ${spinning ? "motion" : ""}`}
            style={{ background: wheelBackground, transform: `rotate(${BASE_OFFSET + rotation}deg)` }}
          >
            {/* Dominant gold outer rim */}
            <div className="outer-trim" aria-hidden />
            <div className="trim-gleam" aria-hidden />
            <div className="trim-studs" aria-hidden />

            {/* Chrome inner divider */}
            <div className="inner-chrome" aria-hidden />

            {/* Subtle face overlays (no images in slices) */}
            <div className="spokes" aria-hidden />
            <div className="specular" aria-hidden />

            {/* Per-slice labels (ride the wheel so they rotate with it) */}
            {labels.map(({ idx, text, angle, isMax }) => (
              <div
                key={idx}
                className={`slice-label ${isMax ? "is-max" : ""} ${lastWin && lastWin.index === idx ? "won" : ""}`}
                style={{ transform: `rotate(${angle}deg) translate(0, var(--labelRadius)) rotate(${-angle}deg)` }}
              >
                {text}
              </div>
            ))}
          </div>

          {/* NON-rotating center stack (logo stays still) */}
          <div className="center-stack" aria-hidden>
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
