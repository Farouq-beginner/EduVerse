import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="route-loading">
      <Loader2 size={22} className="spin" />
      <strong>Memuat konsol admin…</strong>
      <span>Menyiapkan ringkasan platform.</span>
    </div>
  );
}
