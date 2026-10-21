"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Toast } from "@/components/Toast";
import { loginUser } from "@/lib/actions/auth";

export default function AdminAuthPage() {
  return (
    <div className="auth-page auth-page--admin">
      <div className="auth-form-wrap">
        <BrandMark />
        <div className="eyebrow" style={{ marginTop: 20 }}>HALAMAN TIDAK TERSEDIA</div>
        <h2 style={{ margin: "6px 0 4px" }}>Fitur ini belum aktif</h2>
        <p style={{ marginTop: 12 }}>Halaman admin belum tersedia saat ini. Silakan gunakan login Guru atau Siswa.</p>
        <Link href="/auth" className="button button--primary" style={{ marginTop: 18 }}>
          <ArrowLeft size={15} /> Kembali ke login
        </Link>
      </div>
    </div>
  );
}
