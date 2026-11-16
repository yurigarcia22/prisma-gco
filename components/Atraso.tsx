import Icon from "@/components/Icon";
import { diasDesde, plural } from "@/lib/format";

/** Chip com os dias na etapa, colorido pelo prazo médio. */
export default function Atraso({ desde, prazo }: { desde: string; prazo: number | null | undefined }) {
  const dias = diasDesde(desde);
  let cor = "bg-sky text-brand";
  if (prazo) {
    if (dias > prazo) cor = "bg-red-50 text-bad";
    else if (dias >= prazo * 0.8) cor = "bg-amber-50 text-warn";
    else cor = "bg-emerald-50 text-ok";
  }
  return (
    <span className={`chip ${cor}`} title={prazo ? `Prazo médio da etapa: ${prazo} dias` : "Etapa sem prazo médio"}>
      <Icon name="clock" size={12} />
      {dias === 0 ? "hoje" : plural(dias, "dia", "dias")}
      {prazo ? <span className="opacity-60">/ {prazo}</span> : null}
    </span>
  );
}

export function atrasado(desde: string, prazo: number | null | undefined) {
  return !!prazo && diasDesde(desde) > prazo;
}
