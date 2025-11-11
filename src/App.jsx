import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Wheel spec (25 sections)
 * Payouts (unchanged):
 * 1: MAX +1000
 * 2,4,6,8,10,12,14,16,18,20,22,24: +5
 * 3,7,11,15,19,23: +10
 * 5,9,13: +20
 * 17,25: +50
 * 21: +100
 *
 * Visuals (requested):
 * - #1 slice: basic purple→teal gradient (brand), not chrome.
 * - Odd (except #1): black metallic.
 * - Even: silver metallic.
 * - Gold outer rim = ~2× thicker and dominant.
 * - Remove any slice-level svg/image (no artifacts). Only center logo remains.
 * - Show payout label on EVERY wedge (no stacking).
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const BASE_OFFSET = -90; // rotate so 0deg points to the TOP pointer

// Subtle metallic palettes (edge → mid → spec → mid → edge)
const METAL = {
  black:  ["#0b0d12", "#151922", "#8b95a1", "#151922", "#0a0c11"],
  silver: ["#8f99a6", "#b7c0cc", "#ffffff", "#b7c0cc", "#808a96"],
};

// Center logo file in /public (adjust to your filename)
const CENTER_LOGO_SRC = "/logo.png";

function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);

  // Section 1: MAX
  slots[0] = { label: "+1000", amount: 1000, type: "max", tone: "max" };

  const put = (idxs, amount) =>
    idxs.forEach((n) => {
      const i = n - 1;
      if (!slots[i]) slots[i] = { amount, type: "flat" };
      slots[i].label = `+${amount}`; // ensure label set per section
    });

  put([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], 5);
  put([3, 7, 11, 15, 19, 23], 10);
  put([5, 9, 13], 20);
  put([17, 25], 50);
  put([21], 100);

  // Tone mapping: odd=black, even=silver; #1 is MAX gradient
  for (let sec1 = 2; sec1 <= SEGMENTS_TOTAL; sec1++) {
    const i = sec1 - 1;
    if (!slots[i]) continue;
    slots[i].tone = sec1 % 2 === 0 ? "silver" : "black";
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
    clickSfx.current = new Audio("/sounds/click.mp3");
    clickSfx.current.preload = "auto";
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3");
    rollLoopSfx.current.loop = true;
    rollLoopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3");
    winSfx.current.preload = "auto";
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
   * Paint the wheel with conic gradients:
   * - For MAX (index 0): single-slice basic gradient (purple → teal).
   * - For others: soft metallic (5 stops).
   */
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;

    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc;
      const end = acc + SEG_DEG;

      if (i === 0) {
        // MAX basic gradient across the slice
        const mid = start + SEG_DEG * 0.5;
        parts.push(`#7c5cff ${start}deg ${mid}deg`); // purple → mid
        parts.push(`#19FB9B ${mid}deg ${end}deg`);   // → teal
      } else {
        const pal = METAL[wheel[i].tone]; // [edge, mid1, spec, mid2, edge]
        const s1 = start + SEG_DEG * 0.22;
        const s2 = start + SEG_DEG * 0.45;
        const s3 = start + SEG_DEG * 0.55; // narrow spec band (~10%)
        const s4 = start + SEG_DEG * 0.78;

        parts.push(`${pal[0]} ${start}deg ${s1}deg`);
        parts.push(`${pal[1]} ${s1}deg ${s2}deg`);
        parts.push(`${pal[2]} ${s2}deg ${s3}deg`);
        parts.push(`${pal[3]} ${s3}deg ${s4}deg`);
        parts.push(`${pal[4]} ${s4}deg ${end}deg`);
      }

      acc = end;
    }

    return `conic-gradient(${parts.join(", ")})`;
  }, [wheel]);

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

  const computeFinalRotation = (current, idx) => {
    // Land chosen slice center at top (after BASE_OFFSET)
    const center = idx * SEG_DEG + SEG_DEG / 2;
    const toZero = (360 - (center % 360)) % 360;
    const extra = 5 + Math.floor(Math.random() * 3); // 5..7 spins
    return current + extra * 360 + toZero;
  };

  const play = async (r) => {
    try {
      if (r?.current) {
        r.current.currentTime = 0;
        await r.current.play();
      }
    } catch {}
  };
  const stop = (r) => {
    try {
      if (r?.current) {
        r.current.pause();
        r.current.currentTime = 0;
      }
    } catch {}
  };

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
          <div className={`pointer ${lastWin && !spinning ? "pulse" : ""}`}>
            <div className="pointer-led" />
          </div>

          <div
            className={`wheel ${spinning ? "motion" : ""}`}
            style={{
              background: wheelBackground,
              transform: `rotate(${BASE_OFFSET + rotation}deg)`,
            }}
          >
            {/* DOMINANT gold outer rim (2× thicker) */}
            <div className="outer-trim" aria-hidden />
            <div className="trim-gleam" aria-hidden />
            <div className="trim-studs" aria-hidden />

            {/* Chrome inner ring divider */}
            <div className="inner-chrome" aria-hidden />

            {/* (No per-slice noise/image overlays to avoid artifacts) */}
            <div className="spokes" aria-hidden />
            <div className="specular" aria-hidden />

            {/* Center hardware + YOUR LOGO on black puck */}
            <div className="center-ring" aria-hidden />
            <div className="center-cap" aria-hidden />
            <img className="center-logo-img" src={CENTER_LOGO_SRC} alt="logo" />
            <div className="center-gloss" aria-hidden />

            {/* Labels: every slice has its own payout; winner gets subtle halo */}
            {labels.map(({ idx, text, angle, isMax }) => (
              <div
                key={idx}
                className={`slice-label ${isMax ? "is-max" : ""} ${
                  lastWin && lastWin.index === idx ? "won" : ""
                }`}
                style={{
                  transform: `rotate(${angle}deg) translate(0, -43%) rotate(${-angle}deg)`,
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>

        {lastWin && (
          <div className="result">
            Stopped on <b>#{lastWin.index + 1}</b> —{" "}
            <span className={`pill ${lastWin.type === "max" ? "max" : ""}`}>{lastWin.label}</span> ⇒{" "}
            <b>+{lastWin.amount}</b>
          </div>
        )}
      </div>
    </div>
  );
}
