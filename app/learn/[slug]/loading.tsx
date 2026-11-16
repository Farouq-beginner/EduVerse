import { Loader2 } from "lucide-react";

export default function LearnLoading() {
  return (
    <div className="route-loading">
      <Loader2 size={22} className="spin" />
      <strong>Memuat pembelajaran…</strong>
      <span>Menyiapkan pertemuan dan materi untukmu.</span>
    </div>
  );
}
