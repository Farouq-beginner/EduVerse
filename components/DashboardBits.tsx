import { ArrowUpRight, CheckCircle2, Clock3, Sparkles, TrendingUp, Users } from "lucide-react";

export function ProgressRing({ value, color = "violet", size = "md" }: { value: number; color?: string; size?: "sm" | "md" | "lg" }) {
  const radius = size === "lg" ? 42 : size === "sm" ? 25 : 34;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (value / 100) * circumference;
  return <div className={`progress-ring progress-ring--${size}`} style={{ "--ring-color": `var(--${color})`, "--dash": `${dash}px`, "--circumference": `${circumference}px` } as React.CSSProperties}><svg viewBox="0 0 100 100" aria-label={`${value}% selesai`}><circle className="progress-ring__track" cx="50" cy="50" r={radius} /><circle className="progress-ring__value" cx="50" cy="50" r={radius} /></svg><strong>{value}%</strong></div>;
}

export function MetricCard({ label, value, delta, icon, tone = "violet" }: { label: string; value: string; delta: string; icon: "users" | "check" | "clock" | "trend"; tone?: string }) {
  const Icon = icon === "users" ? Users : icon === "check" ? CheckCircle2 : icon === "clock" ? Clock3 : TrendingUp;
  return <div className={`metric-card metric-card--${tone}`}><div className="metric-card__top"><span className="metric-icon"><Icon size={18} /></span><ArrowUpRight size={16} className="metric-arrow" /></div><div className="metric-card__value">{value}</div><div className="metric-card__label">{label}</div><div className="metric-card__delta"><TrendingUp size={13} /> {delta}</div></div>;
}

export function ChartBars() {
  const bars = [42, 58, 50, 76, 62, 84, 68, 92, 72, 98, 86, 100];
  return <div className="chart-bars" aria-label="Grafik progres mingguan">{bars.map((height, index) => <div className="chart-bar-wrap" key={index}><div className="chart-bar" style={{ height: `${height}%`, animationDelay: `${index * 35}ms` }} /><span>{index % 3 === 0 ? ["2 Sep", "9 Sep", "16 Sep", "23 Sep"][index / 3] : ""}</span></div>)}</div>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>{action}</div>;
}

export function StatusPill({ children, tone = "teal" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status-pill status-pill--${tone}`}><span className="status-pill__dot" />{children}</span>;
}

export function EmptyState({ title, copy, icon = <Sparkles size={24} /> }: { title: string; copy: string; icon?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-state__icon">{icon}</span><strong>{title}</strong><p>{copy}</p></div>;
}
