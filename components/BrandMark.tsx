import { Orbit } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark--compact" : ""}`} aria-label="EduVerse">
      <span className="brand-mark__icon"><Orbit size={compact ? 17 : 20} strokeWidth={2.4} /></span>
      {!compact && <span className="brand-mark__word">edu<span>verse</span></span>}
    </div>
  );
}
