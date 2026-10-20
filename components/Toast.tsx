"use client";

import { CheckCircle2, X } from "lucide-react";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast" role="status"><CheckCircle2 size={18} /><span>{message}</span><button onClick={onClose} aria-label="Tutup notifikasi"><X size={15} /></button></div>;
}
