import { Loader2 } from "lucide-react";

export default function TeacherLoading() {
  return (
    <div className="route-loading">
      <Loader2 size={22} className="spin" />
      <strong>Memuat workspace guru…</strong>
      <span>Menyiapkan pembelajaran dan materinya.</span>
    </div>
  );
}
