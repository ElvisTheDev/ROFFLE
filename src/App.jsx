import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25-section wheel
 * Sections are 1-indexed in your spec; code uses 0-index internally.
 *
 * Section 1:  "MAX WIN" — 1000 coins  -> index 0
 * Sections 2,4,6,8,10,12,14,16,18,20,22,24 -> 5 coins
 * Sections 3,7,11,15,19,23                  -> 10 coins
 * Sections 5,9,13                           -> 20 coins
 * Sections 17,25                            -> 50 coins
 * Section 21                                -> 100 coins
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

/** Build the wheel with your exact mapping by index (0..24). */
function buildWheel25() {
  // start with MAX at index 0
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  slots[0] = { label: "MAX WIN", amount: 1000, type: "max" };

  // helpers to drop values into specific 1-indexed sections
  const put = (indices1, amount, color) => {
    indices1.forEach((sec1) => {
      const i = sec1 - 1; // convert to 0-index
      slots[i] = { label: String(amount), amount, color, type: "flat" };
    });
  };

  put([2,4,6,8,10,12,14,16,18,20,22,24], 5, COLORS.green);
  put([3,7,11,15,19,23],                  10, COLORS.blue);
  put([5,9,13],                            20, COLORS.purple);
  put([17,25],                             50, COLORS.red);
  put([21],                                100, COLORS.gold);

  // safety: if any nulls remain (shouldn't), fill with 5
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) slots[i] = { label: "5", amount: 5, color: COLORS.green, type: "flat" };
  }
  return slots;
}

export default function App() {
  const wheel = useMemo(buildWheel25, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [bank, setBank] = useState(0);
  const [theme, setTheme] = useState({ bg: "#0a0118", text: "#ffffff", sectionRing: "#2a1c4d" });

  // sounds
  const clickSfx = useRef(null);
  const rollLoopSfx = useRef(null);
  const winSfx = useRef(null);

  useEffect(() => {
    clickSfx.current = new Audio("/sounds/click.mp3");
    clickSfx.current.preload = "auto";
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3");
    rollLoopSfx.current.loop = true;
    rollLoopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3");
    winSfx.current.preload = "auto";
  }, []);

  // Telegram theme sync
  useEffect(() => {
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({
        bg: p.bg_color || "#0a0118",
        text: p.text_color || "#ffffff",
        sectionRing: "#2a1c4d",
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

  // conic-gradient for 25 fixed slices (MAX uses Solana gradient)
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

  const chooseIndex = () => Math.floor(Math.random() * SEGMENTS_TOTAL);

  // Align target slice center under top pointer (12 o'clock = 90deg from CSS 0deg)
  const computeFinalRotation = (currentRot, targetIndex) => {
    const indexCenter = targetIndex * SEG_DEG + SEG_DEG / 2;
    const base = 90 - indexCenter;
    const baseNorm = ((base % 360) + 360) % 360;
    const extraTurns = 5 + Math.floor(Math.random() * 3); // 5..7 turns
    return currentRot + extraTurns * 360 + baseNorm;
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

    const DURATION = 4500; // must match CSS transition
    setTimeout(() => {
      const win = wheel[targetIndex];
      setLastWin({ index: targetIndex, ...win });
      setBank((b) => b + (win.amount || 0));
      stop(rollLoopSfx);
      play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, DURATION + 60);
  };

  return (
    <div
      className="tg-app"
      style={{ "--bg": theme.bg, "--text": theme.text, "--ring": theme.sectionRing }}
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
            className="wheel"
            style={{
              background: wheelBackground,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {/* Only one MAX label now — section 1 (index 0) */}
            <SectionLabel index={0} text="MAX" />
            {/* Tick marks (keep majors every 5 sections) */}
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
  const angle = index * SEG_DEG; // boundary tick
  return (
    <div
      className={`tick ${major ? "major" : ""}`}
      style={{ transform: `rotate(${angle}deg)` }}
    />
  );
}
