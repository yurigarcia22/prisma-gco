import Icon from "@/components/Icon";
import { dataHora } from "@/lib/format";
import type { Evento } from "@/lib/types";

const VISUAL: Record<string, { icone: string; cor: string; titulo: (e: Evento, nomeEtapa?: string) => string }> = {
  criado: { icone: "flag", cor: "bg-brand text-white", titulo: () => "Processo aberto" },
  etapa: { icone: "arrowRight", cor: "bg-brand text-white", titulo: (e, n) => `Etapa: ${n ?? e.texto}` },
  recado: { icone: "chat", cor: "bg-coral text-white", titulo: () => "Recado" },
  nota: { icone: "note", cor: "bg-[#e9eff3] text-ink-soft", titulo: () => "Nota interna" },
  pendencia: { icone: "alert", cor: "bg-amber-100 text-warn", titulo: () => "Documento pedido" },
  pendencia_resolvida: { icone: "check", cor: "bg-emerald-100 text-ok", titulo: () => "Documento recebido" },
  documento: { icone: "file", cor: "bg-sky text-brand", titulo: () => "Documento enviado" },
  status: { icone: "flag", cor: "bg-[#e9eff3] text-ink-soft", titulo: (e) => e.texto ?? "Status" },
};

export default function Timeline({
  eventos,
  nomesEtapa,
  visaoCliente = false,
  acaoExcluir,
}: {
  eventos: Evento[];
  /** id da etapa -> nome mostrado (no cliente usa o nome_cliente) */
  nomesEtapa?: Map<string, string>;
  visaoCliente?: boolean;
  acaoExcluir?: (id: string) => React.ReactNode;
}) {
  if (!eventos.length) return <p className="text-sm text-ink-soft">Nada por aqui ainda.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-line">
      {eventos.map((e) => {
        const v = VISUAL[e.tipo] ?? VISUAL.nota;
        const nomeEtapa = e.etapa_id ? nomesEtapa?.get(e.etapa_id) : undefined;
        const mostrarTexto = e.tipo !== "etapa" && e.tipo !== "criado" && e.tipo !== "status" && e.texto;
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${v.cor}`}>
              <Icon name={v.icone} size={15} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="text-sm font-semibold">{v.titulo(e, nomeEtapa)}</span>
                {!visaoCliente && !e.publico && e.tipo !== "nota" ? (
                  <span className="chip bg-[#eef1f3] text-ink-soft">
                    <Icon name="eyeOff" size={10} /> só equipe
                  </span>
                ) : null}
                {!visaoCliente && e.tipo === "recado" ? (
                  <span className="chip bg-sky text-brand">
                    <Icon name="eye" size={10} /> cliente vê
                  </span>
                ) : null}
              </div>
              {mostrarTexto ? <p className="mt-1 whitespace-pre-line text-sm text-ink">{e.texto}</p> : null}
              <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                {dataHora(e.criado_em)}
                {!visaoCliente && e.autor ? <span>· {e.autor}</span> : null}
                {acaoExcluir && (e.tipo === "nota" || e.tipo === "recado") ? acaoExcluir(e.id) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
