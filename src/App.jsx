import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 25-section wheel mapping (1-indexed spec -> 0-indexed code)
 * 1:  MAX WIN — 1000 (Solana gradient)
 * 2,4,6,8,10,12,14,16,18,20,22,24: 5 (green)
 * 3,7,11,15,19,23: 10 (blue)
 * 5,9,13: 20 (purple)
 * 17,25: 50 (red)
 * 21: 100 (gold)
 */

const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°

const COLORS = {
  // professional, slightly muted casino palette
  green: "#22c55e",   // 5
  blue:  "#2563eb",   // 10
  purple:"#7c3aed",   // 20
  red:   "#ef4444",   // 50
  gold:  "#f59e0b",   // 100
  sol1:  "#9945FF",   // MAX gradient
  sol2:  "#19FB9B",
  sol3:  "#00E1FF",
};

const tg = window.Telegram?.WebApp;

function buildWheel25() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  // Section 1 (index 0): MAX
  slots[0] = { label: "MAX WIN", amount: 1000, type: "max" };

  const put = (indices1, amount, color) => {
    indices1.forEach((sec1) => {
      const i = sec1 - 1;
      slots[i] = { label: String(amount), amount, color, type: "flat" };
    });
  };

  put([2,4,6,8,10,12,14,16,18,20,22,24], 5, COLORS.green);
  put([3,7,11,15,19,23], 10, COLORS.blue);
  put([5,9,13], 20, COLORS.purple);
  put([17,25], 50, COLORS.red);
  put([21], 100, COLORS.gold);

  // Safety fill (shouldn't be needed)
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) slots[i] = { label: "5", amount: 5, color: COLORS.green, type: "flat" };
  }
  return slots;
}

export default function App() {
  const wheel = useMemo(buildWheel25, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // dynamic spin rotation in degrees
  const [lastWin, setLastWin] = useState(null);
  const [bank, setBank] = useState(0);
  const [theme, setTheme] = useState({ bg: "#0b0b13", text: "#eaeaea", sectionRing: "#2a1c4d" });

  // highlight wedge (for winner overlay)
  const [winAngles, setWinAngles] = useState({ start: null, end: null });

  // sounds
  const clickSfx = useRef(null);
  const rollLoopSfx = useRef(null);
  const winSfx = useRef(null);

  useEffect(() => {
    clickSfx.current = new Audio("/sounds/click.mp3"); clickSfx.current.preload = "auto";
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3"); rollLoopSfx.current.loop = true; rollLoopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3"); winSfx.current.preload = "auto";
  }, []);

  // Telegram theme sync
  useEffect(() => {
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({
        bg: p.bg_color || "#0b0b13",
        text: p.text_color || "#eaeaea",
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

  /**
   * Build conic-gradient background:
   * - Only MAX uses a real Solana gradient
   * - All other slices are solid colors (professional palette)
   */
  const wheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc;
      const end = acc + SEG_DEG;
      const s = wheel[i];
      if (s.type === "max") {
        // three-stop gradient inside the slice for richer MAX
        const mid1 = start + SEG_DEG * 0.33;
        const mid2 = start + SEG_DEG * 0.66;
        parts.push(`${COLORS.sol1} ${start}deg ${mid1}deg`);
        parts.push(`${COLORS.sol2} ${mid1}deg ${mid2}deg`);
        parts.push(`${COLORS.sol3} ${mid2}deg ${end}deg`);
      } else {
        parts.push(`${s.color} ${start}deg ${end}deg`);
      }
      acc = end;
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, [wheel]);

  /**
   * STOP ALIGNMENT — Make the chosen slice center land under the TOP pointer.
   *
   * We introduce a base rotation offset of -90deg so that "0deg" visually points UP.
   * Then we target the chosen slice center at 0deg (after offset), which is the pointer.
   *
   * Final transform on the wheel: rotate( baseOffset + rotation )
   * So here, we compute 'rotation' so that (indexCenter + rotation) % 360 = 0
   */
  const BASE_OFFSET = -90; // degrees, rotate wheel so 0deg is at top
  const chooseIndex = () => Math.floor(Math.random() * SEGMENTS_TOTAL);

  const computeFinalRotation = (currentRot, targetIndex) => {
    const indexCenter = targetIndex * SEG_DEG + SEG_DEG / 2; // from CSS 0deg (right)
    // We want (indexCenter + rotation) % 360 = 0 (after base offset already applied in CSS)
    const toZero = (360 - (indexCenter % 360)) % 360; // amount to bring center to 0deg
    const extraTurns = 5 + Math.floor(Math.random() * 3); // 5..7 spins for feel
    return currentRot + extraTurns * 360 + toZero;
  };

  const play = async (ref) => { try { if (ref?.current) { ref.current.currentTime = 0; await ref.current.play(); } } catch {} };
  const stop = (ref) => { try { if (ref?.current) { ref.current.pause(); ref.current.currentTime = 0; } } catch {} };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWin(null);
    setWinAngles({ start: null, end: null });

    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx);
    await play(rollLoopSfx);

    const targetIndex = chooseIndex();
    const finalRot = computeFinalRotation(rotation, targetIndex);
    requestAnimationFrame(() => setRotation(finalRot));

    const DURATION = 4800; // matches CSS transition easing feel
    setTimeout(() => {
      const win = wheel[targetIndex];
      setLastWin({ index: targetIndex, ...win });
      setBank((b) => b + (win.amount || 0));

      // highlight wedge angles (in wheel space)
      const start = targetIndex * SEG_DEG;
      const end = start + SEG_DEG;
      setWinAngles({ start, end });

      stop(rollLoopSfx);
      play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, DURATION + 80);
  };

  // Build text labels per slice (values around the rim)
  const sliceLabels = useMemo(
    () =>
      wheel.map((s, idx) => ({
        idx,
        text: s.type === "max" ? "MAX" : s.label,
        angle: idx * SEG_DEG + SEG_DEG / 2,
      })),
    [wheel]
  );

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
          {/* top pointer */}
          <div className={`pointer ${lastWin && !spinning ? "pulse" : ""}`} />

          {/* wheel */}
          <div
            className={`wheel ${spinning ? "motion" : ""}`}
            style={{
              background: wheelBackground,
              transform: `rotate(${BASE_OFFSET + rotation}deg)`,
              "--win-start": winAngles.start != null ? `${winAngles.start}deg` : "0deg",
              "--win-end": winAngles.end != null ? `${winAngles.end}deg` : "0deg",
              "--show-win": winAngles.start != null ? 1 : 0,
            }}
          >
            {/* decorative layers */}
            <div className="spokes" aria-hidden />
            <div className="rim-glow" aria-hidden />
            <div className="center-cap" aria-hidden />
            <div className="center-ring" aria-hidden />

            {/* labels per slice */}
            {sliceLabels.map(({ idx, text, angle }) => (
              <div
                key={idx}
                className={`slice-label ${text === "MAX" ? "is-max" : ""}`}
                style={{ transform: `rotate(${angle}deg) translate(0, -43%) rotate(${-angle}deg)` }}
              >
                {text}
              </div>
            ))}

            {/* winner highlight */}
            <div className="winner-overlay" aria-hidden />
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
