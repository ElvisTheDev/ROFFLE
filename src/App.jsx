import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25-section wheel (1-indexed spec → 0-indexed code)
 *
 * 1:  "MAX WIN" — 1000 (Solana gradient)
 * 2,4,6,8,10,12,14,16,18,20,22,24: 5   (green)
 * 3,7,11,15,19,23:                   10 (blue)
 * 5,9,13:                            20 (purple)
 * 17,25:                             50 (red)
 * 21:                                100 (gold)
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°

const COLORS = {
  green: "#27ae60",   // 5
  blue: "#2980b9",    // 10
  purple: "#8e44ad",  // 20
  red: "#e74c3c",     // 50
  gold: "#f1c40f",    // 100
  sol1: "#9945FF",    // MAX gradient
  sol2: "#19FB9B",
};

const tg = window.Telegram?.WebApp;

/** Build the wheel with the exact mapping by visual section number. */
function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  // Section 1 (index 0): MAX
  slots[0] = { label: "MAX WIN", amount: 1000, type: "max" };

  const put = (secList, amount, color) => {
    secList.forEach((sec1) => {
      const i = sec1 - 1;
      slots[i] = { label: String(amount), amount, color, type: "flat" };
    });
  };

  put([2,4,6,8,10,12,14,16,18,20,22,24], 5, COLORS.green);
  put([3,7,11,15,19,23], 10, COLORS.blue);
  put([5,9,13], 20, COLORS.purple);
  put([17,25], 50, COLORS.red);
  put([21], 100, COLORS.gold);

  // Safety fallback (shouldn't be needed)
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) slots[i] = { label: "5", amount: 5, color: COLORS.green, type: "flat" };
  }
  return slots;
}

export default function App() {
  const wheel = useMemo(buildWheel25, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);           // cumulative deg
  const [lastWin, setLastWin] = useState(null);          // { index, label, amount, ... }
  const [bank, setBank] = useState(0);
  const [winHighlightIdx, setWinHighlightIdx] = useState(null); // for glow overlay

  // Telegram theming
  const [theme, setTheme] = useState({
    bg: "#0a0118",
    text: "#ffffff",
    ring: "#2a1c4d",
  });

  // sounds
  const clickSfx = useRef(null);
  const rollLoopSfx = useRef(null);
  const winSfx = useRef(null);

  useEffect(() => {
    clickSfx.current = new Audio("/sounds/click.mp3"); clickSfx.current.preload = "auto";
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3"); rollLoopSfx.current.loop = true; rollLoopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3"); winSfx.current.preload = "auto";
  }, []);

  // Telegram theme
  useEffect(() => {
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({
        bg: p.bg_color || "#0a0118",
        text: p.text_color || "#ffffff",
        ring: "#2a1c4d",
      });
    };
    sync();
    tg.onEvent?.("themeChanged", sync);
    return () => tg.offEvent?.("themeChanged", sync);
  }, []);

  // Telegram MainButton mirrors Spin
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

  // Build conic-gradient for slices (MAX uses Solana gradient)
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc;
      const end = acc + SEG_DEG;
      const s = wheel[i];
      if (s.type === "max") {
        const mid = start + SEG_DEG / 2;
        parts.push(`${COLORS.sol1} ${start}deg ${mid}deg`);
        parts.push(`${COLORS.sol2} ${mid}deg ${end}deg`);
      } else {
        parts.push(`${s.color} ${start}deg ${end}deg`);
      }
      acc = end;
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, [wheel]);

  // Utility: play/stop
  const play = async (ref) => { try { if (ref?.current) { ref.current.currentTime = 0; await ref.current.play(); } } catch {} };
  const stop = (ref) => { try { if (ref?.current) { ref.current.pause(); ref.current.currentTime = 0; } } catch {} };

  // Compute final rotation (aim near center of target index)
  const computeFinalRotation = (currentRot, targetIndex) => {
    // Angle of the slice center in wheel coords (0deg at 3 o'clock, clockwise)
    const indexCenter = targetIndex * SEG_DEG + SEG_DEG / 2;
    // We want that center under the pointer at 12 o'clock (90deg from 3 o'clock)
    const base = 90 - indexCenter;
    const baseNorm = ((base % 360) + 360) % 360;
    const extraTurns = 5 + Math.floor(Math.random() * 3); // 5..7 full spins
    return currentRot + extraTurns * 360 + baseNorm;
  };

  // Robust: derive the **visual** winning index from the actual end rotation
  // This guarantees the prize matches what the user sees under the pointer.
  const computeIndexFromRotation = (finalRotationDeg) => {
    const rot = ((finalRotationDeg % 360) + 360) % 360;
    // Angle under pointer in original wheel coordinates:
    const angleUnderPointer = ((90 - rot) % 360 + 360) % 360; // 12 o'clock
    let idx = Math.floor(angleUnderPointer / SEG_DEG + 1e-6); // epsilon avoids edge rounding
    idx = Math.max(0, Math.min(SEGMENTS_TOTAL - 1, idx));
    return idx;
  };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWin(null);
    setWinHighlightIdx(null);

    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx);
    await play(rollLoopSfx);

    // Choose any target (we'll still compute from visual final position)
    const targetIndex = Math.floor(Math.random() * SEGMENTS_TOTAL);
    const finalRot = computeFinalRotation(rotation, targetIndex);

    // Spin!
    requestAnimationFrame(() => setRotation(finalRot));

    const DURATION = 4600; // must match CSS transition ~4.6s
    setTimeout(() => {
      // Compute the actual landed index from the final rotation
      const landedIdx = computeIndexFromRotation(finalRot);
      const win = wheel[landedIdx];

      setWinHighlightIdx(landedIdx);
      setLastWin({ index: landedIdx, ...win });
      setBank((b) => b + (win.amount || 0));

      stop(rollLoopSfx);
      play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, DURATION + 80);
  };

  return (
    <div
      className="tg-app"
      style={{ "--bg": theme.bg, "--text": theme.text, "--ring": theme.ring }}
    >
      <div className="compact">
        <header className="header">
          <div className="bank">💰 {bank}</div>
          <button className="spin" onClick={handleSpin} disabled={spinning}>
            {spinning ? "Spinning..." : "Spin"}
          </button>
        </header>

        <div className="wheel-wrap">
          <div className="pointer" />
          <div
            className={`wheel ${spinning ? "spinning" : ""}`}
            style={{ background: wheelBackground, transform: `rotate(${rotation}deg)` }}
          >
            {/* Gloss + inner ring + hub are CSS (::before/::after). */}

            {/* Winner highlight overlay */}
            {winHighlightIdx != null && (
              <WinnerGlow index={winHighlightIdx} />
            )}

            {/* MAX label */}
            <SectionLabel index={0} text="MAX" />

            {/* Boundary ticks */}
            {Array.from({ length: SEGMENTS_TOTAL }).map((_, i) => (
              <Tick key={i} index={i} major={i % 5 === 0} />
            ))}
          </div>
        </div>

        {lastWin && (
          <div className="result">
            <div>
              Stopped on <b>#{lastWin.index + 1}</b> —{" "}
              {lastWin.label === "MAX WIN" ? (
                <span className="pill max">MAX WIN</span>
              ) : (
                <span className="pill">{lastWin.label}</span>
              )}{" "}
              ⇒ <b>+{lastWin.amount}</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ index, text }) {
  const angle = index * SEG_DEG + SEG_DEG / 2;
  return (
    <div
      className="label"
      style={{
        transform: `rotate(${angle}deg) translate(0, -46%) rotate(${-angle}deg)`,
      }}
    >
      {text}
    </div>
  );
}

function Tick({ index, major }) {
  const angle = index * SEG_DEG;
  return (
    <div
      className={`tick ${major ? "major" : ""}`}
      style={{ transform: `rotate(${angle}deg)` }}
    />
  );
}

/** Highlights the winning slice with a soft animated glow wedge. */
function WinnerGlow({ index }) {
  const start = index * SEG_DEG;
  const end = start + SEG_DEG;
  // Slightly inset to avoid covering pointer
  const mask = `conic-gradient(from 0deg, transparent ${start}deg, rgba(255,255,255,1) ${start}deg ${end}deg, transparent ${end}deg)`;
  return (
    <div
      className="win-glow"
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}
