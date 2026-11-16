/** Marca do Prisma: um prisma que separa a luz em faixas (cada etapa). */
export function PrismaMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M2 21h11" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      <path d="M20 5 33 31H7L20 5Z" fill="#ffffff" fillOpacity="0.16" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 17.5 39 13" stroke="#f05f4a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27.5 21 39 21" stroke="#f7b733" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M29 24.5 39 29" stroke="#7fd1ff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ empresa, claro = true }: { empresa?: string; claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid place-items-center rounded-xl ${claro ? "bg-white/10" : "brand-gradient"} p-1.5`}>
        <PrismaMark size={26} />
      </span>
      <div className="leading-tight">
        <div className={`font-display text-lg font-bold ${claro ? "text-white" : "text-ink"}`}>Prisma</div>
        {empresa ? (
          <div className={`text-[11px] ${claro ? "text-white/70" : "text-ink-soft"}`}>{empresa}</div>
        ) : null}
      </div>
    </div>
  );
}
