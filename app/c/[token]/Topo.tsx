import Link from "next/link";
import { PrismaMark } from "@/components/Logo";

export default function Topo({ token, empresa, nome }: { token: string; empresa: string; nome: string }) {
  return (
    <header className="brand-gradient px-4 py-4 text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <Link href={`/c/${token}`} className="flex items-center gap-2.5">
          <span className="rounded-xl bg-white/10 p-1.5">
            <PrismaMark size={24} />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-base font-bold">Prisma</span>
            <span className="block text-[11px] text-white/70">{empresa}</span>
          </span>
        </Link>
        <span className="text-right text-sm">
          <span className="block text-[11px] text-white/70">Corretor</span>
          <span className="font-semibold">{nome}</span>
        </span>
      </div>
    </header>
  );
}
