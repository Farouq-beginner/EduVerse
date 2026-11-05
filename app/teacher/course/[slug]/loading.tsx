import { Loader2 } from "lucide-react";

export default function CourseBuilderLoading() {
  return (
    <div className="route-loading">
      <Loader2 size={22} className="spin" />
      <strong>Membuka course builder…</strong>
      <span>Memuat pertemuan, materi, dan kolaborasi.</span>
    </div>
  );
}
