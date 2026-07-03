import { useEffect, useRef } from "react";
import { useTips } from "../context/TipsContext";

export default function SponsoredTip() {
  const { currentTip, isShowing, dismissTip, impressionComplete } = useTips();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (isShowing && currentTip) {
      reportedRef.current = false;
      // Auto-dismiss after 6 seconds, credit after 2 seconds of view
      const creditTimer = setTimeout(() => {
        if (!reportedRef.current) {
          reportedRef.current = true;
          impressionComplete();
        }
      }, 2000);

      const dismissTimer = setTimeout(() => {
        dismissTip();
      }, 6000);

      timerRef.current = dismissTimer;
      return () => {
        clearTimeout(creditTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [isShowing, currentTip, dismissTip, impressionComplete]);

  if (!currentTip) return null;

  return (
    <div
      className={`sponsored-tip${isShowing ? " sponsored-tip--visible" : " sponsored-tip--exit"}`}
      role="status"
      aria-live="polite"
    >
      <div className="sponsored-tip__indicator">
        <div className="sponsored-tip__progress" />
      </div>
      <div className="sponsored-tip__content">
        <div className="sponsored-tip__header">
          <span className="sponsored-tip__sponsor">
            <span className="sponsored-tip__sponsor-icon">{currentTip.sponsorIcon}</span>
            {currentTip.sponsor}
          </span>
          <span className="sponsored-tip__label">Sponsored</span>
          <button className="sponsored-tip__close" onClick={dismissTip} aria-label="Dismiss tip">
            x
          </button>
        </div>
        <div className="sponsored-tip__headline">{currentTip.headline}</div>
        <div className="sponsored-tip__body">{currentTip.body}</div>
        <div className="sponsored-tip__footer">
          <button className="sponsored-tip__cta" onClick={dismissTip}>
            {currentTip.cta}
          </button>
          <span className="sponsored-tip__credits">
            +{currentTip.credits.toFixed(4)} credits earned
          </span>
        </div>
      </div>
    </div>
  );
}
