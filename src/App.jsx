import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25-section wheel mapping (1-indexed spec -> 0-indexed code)
 * 1:  MAX WIN — 1000 (metallic black)
 * 2,4,6,8,10,12,14,16,18,20,22,24: 5  (green)
 * 3,7,11,15,19,23: 10 (blue)
 * 5,9,13: 20 (purple)
 * 17,25: 50 (red)
 * 21: 100 (gold)
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°

const COLORS = {
  // professional, slightly-muted metallic hues
  green: "#1fa24f",   // 5
  blue:  "#1f56c4",   // 10
  purple:"#6a2fd8",   // 20
  red:   "#d83a34",   // 50
  gold:  "#d49a06",   // 100
  // metallic black stops for MAX wedge
  maxA:  "#0c0c10",
  maxB:  "#16161b",
  maxC:  "#0a0a0e",
};

const tg = window.Telegram?.WebApp;

function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  // Section 1 (index 0): MAX
  slots[0] = { label: "+1000", amount: 1000, type: "max" };

  const put = (indices1, amount, color) => {
    indices1.forEach((sec1) => {
      const i = sec1 - 1;
      slots[i] = { label: `+${amount}`, amount, color, type: "flat" };
    });
  };

  put([2,4,6,8,10,12,14,16,18,20,22,24], 5, COLORS.green);
  put([3,7,11,15,19,23], 10, COLORS.blue);
  put([5,9,13], 20, COLORS.purple);
  put([17,25], 50, COLORS.red);
  put([21], 100, COLORS.gold);

  // safety fill (shouldn't be needed)
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) slots[i] = { label: "+5", amount: 5, color: COLORS.green, type: "flat" };
  }
  return slots;
}

export default function App() {
  const wheel = useMemo(buildWheel25, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // cumulative rotation (deg)
  const [lastWin, setLastWin] = useState(null);
  const [bank, setBank] = useState(0);
  const [theme, setTheme] = useState({ bg: "#0b0b13", text: "#eaeaea" });

  // sounds
  const clickSfx = useRef(null);
  const rollLoopSfx = useRef(null);
  const winSfx = useRef(null);

  // ────────────────────────── audio
  useEffect(() => {
    clickSfx.current = new Audio("/sounds/click.mp3"); clickSfx.current.preload = "auto";
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3"); rollLoopSfx.current.loop = true; rollLoopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3"); winSfx.current.preload = "auto";
  }, []);

  // ────────────────────────── Telegram theme sync
  useEffect(() => {
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({
        bg: p.bg_color || "#0b0b13",
        text: p.text_color || "#eaeaea",
      });
    };
    sync();
    tg.onEvent?.("themeChanged", sync);
    return () => tg.offEvent?.("themeChanged", sync);
  }, []);

  // ────────────────────────── Telegram MainButton mirrors Spin
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setText(spinning ? "Spinning..." : "Spin");
    spinning ? tg.MainButton.showProgress() : tg.MainButton.hideProgress();
    tg.MainButton[spinning ? "disable" : "enable"]?.();
    tg.MainButton.show();
    const handler = () => handleSpin();
    tg.MainButton.onClick(handler);
    return () => tg.MainButton.offClick(handler);
  }, [spinning]);

  /**
   * BASE_OFFSET aligns CSS 0deg (right) to TOP (pointer).
   * So "target slice center at 0deg after offset" guarantees the winner sits under the pointer.
   */
  const BASE_OFFSET = -90; // degrees
  const chooseIndex = () => Math.floor(Math.random() * SEGMENTS_TOTAL);

  const computeFinalRotation = (currentRot, targetIndex) => {
    const indexCenter = targetIndex * SEG_DEG + SEG_DEG / 2; // from CSS 0deg (right)
    // We want center at 0deg (after BASE_OFFSET applied in CSS)
    const toZero = (360 - (indexCenter % 360)) % 360;
    const extraTurns = 5 + Math.floor(Math.random() * 3); // 5..7 spins
    return currentRot + extraTurns * 360 + toZero;
  };

  const play = async (ref) => { try { if (ref?.current) { ref.current.currentTime = 0; await ref.current.play(); } } catch {} };
  const stop = (ref) => { try { if (ref?.current) { ref.current.pause(); ref.current.currentTime = 0; } } catch {} };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWin(null);

    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx);
    await play(rollLoopSfx);

    const targetIndex = chooseIndex();
    const finalRot = computeFinalRotation(rotation, targetIndex);
    requestAnimationFrame(() => setRotation(finalRot));

    const DURATION = 4800; // keep in sync with CSS transition
    setTimeout(() => {
      const win = wheel[targetIndex];
      setLastWin({ index: targetIndex, ...win });
      setBank((b) => b + (win.amount || 0));
      stop(rollLoopSfx);
      play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, DURATION + 90);
  };

  // ────────────────────────── Wheel paint (conic)
  // MAX uses metallic black: split its slice into 3 stops
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc;
      const end = acc + SEG_DEG;
      const s = wheel[i];
      if (s.type === "max") {
        const mid1 = start + SEG_DEG * 0.33;
        const mid2 = start + SEG_DEG * 0.66;
        parts.push(`${COLORS.maxA} ${start}deg ${mid1}deg`);
        parts.push(`${COLORS.maxB} ${mid1}deg ${mid2}deg`);
        parts.push(`${COLORS.maxC} ${mid2}deg ${end}deg`);
      } else {
        parts.push(`${s.color} ${start}deg ${end}deg`);
      }
      acc = end;
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, [wheel]);

  // Slice labels (around the rim)
  const sliceLabels = useMemo(
    () =>
      wheel.map((s, idx) => ({
        idx,
        text: s.type === "max" ? "+1000" : s.label,
        angle: idx * SEG_DEG + SEG_DEG / 2,
        isMax: s.type === "max",
      })),
    [wheel]
  );

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
          {/* pointer (top) */}
          <div className={`pointer ${lastWin && !spinning ? "pulse" : ""}`}>
            <div className="pointer-led" />
          </div>

          {/* wheel */}
          <div
            className={`wheel ${spinning ? "motion" : ""}`}
            style={{
              background: wheelBackground,
              transform: `rotate(${BASE_OFFSET + rotation}deg)`,
              // winner glow: always illuminate the top wedge exactly (fixed arc width = 1 slice)
              "--hl-width": `${SEG_DEG}deg`,
              "--show-win": lastWin && !spinning ? 1 : 0,
            }}
          >
            {/* metallic trim + sheen + noise */}
            <div className="rim" aria-hidden />
            <div className="rim-gleam" aria-hidden />
            <div className="noise" aria-hidden />

            {/* separators & speculars */}
            <div className="spokes" aria-hidden />
            <div className="specular" aria-hidden />

            {/* center hardware */}
            <div className="center-ring" aria-hidden />
            <div className="center-cap" aria-hidden />
            <div className="center-gloss" aria-hidden />

            {/* labels on each slice */}
            {sliceLabels.map(({ idx, text, angle, isMax }) => (
              <div
                key={idx}
                className={`slice-label ${isMax ? "is-max" : ""}`}
                style={{ transform: `rotate(${angle}deg) translate(0, -43%) rotate(${-angle}deg)` }}
              >
                {text}
              </div>
            ))}

            {/* winner highlight (fixed to top, independent of rotation) */}
            <div className="winner-overlay" aria-hidden />
          </div>
        </div>

        {lastWin && (
          <div className="result">
            <div>
              Stopped on <b>#{lastWin.index + 1}</b> — <span className={`pill ${lastWin.type === "max" ? "max" : ""}`}>{lastWin.label}</span> ⇒ <b>+{lastWin.amount}</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
