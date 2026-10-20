import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function NotFound() {
  return <main className="not-found"><BrandMark /><div className="not-found__orb"><Compass size={42} /></div><div className="eyebrow">HALAMAN TIDAK DITEMUKAN</div><h1>Sepertinya halaman ini sedang bersembunyi.</h1><p>Coba kembali ke ruang utama atau buka link pembelajaran demo.</p><div><Link href="/" className="button button--primary"><ArrowLeft size={16} /> Kembali ke beranda</Link><Link href="/learn/operasi-bilangan-bulat" className="text-link">Buka demo siswa <span>↗</span></Link></div></main>;
}
