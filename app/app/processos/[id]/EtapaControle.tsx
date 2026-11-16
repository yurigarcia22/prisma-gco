"use client";

import { useOptimistic, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import Atraso from "@/components/Atraso";
import { moverEtapaRapido } from "../actions";

interface EtapaMin {
  id: string;
  nome: string;
  ordem: number;
  prazo_dias: number | null;
}

/** Barra de etapas + botões. Muda na hora (otimista) e confirma no servidor por trás. */
export default function EtapaControle({
  processoId,
  etapas,
  etapaAtual,
  etapaDesde,
  ativo,
}: {
  processoId: string;
  etapas: EtapaMin[];
  etapaAtual: string | null;
  etapaDesde: string;
  ativo: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [avisar, setAvisar] = useState(true);
  const [estado, mudar] = useOptimistic(
    { id: etapaAtual, desde: etapaDesde },
    (_atual, novo: string) => ({ id: novo, desde: new Date().toISOString() }),
  );
  const [escolhida, setEscolhida] = useState(etapaAtual ?? "");

  const idx = etapas.findIndex((e) => e.id === estado.id);
  const atual = idx >= 0 ? etapas[idx] : undefined;
  const proxima = idx >= 0 ? etapas[idx + 1] : etapas[0];

  function ir(etapaId: string, comAviso: boolean) {
    if (!etapaId || etapaId === estado.id) return;
    setErro(null);
    setEscolhida(etapaId);
    startTransition(async () => {
      mudar(etapaId);
      const r = await moverEtapaRapido(processoId, etapaId, comAviso);
      if (r?.erro) {
        setErro(r.erro);
        setEscolhida(etapaAtual ?? "");
      }
    });
  }

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Etapa atual
            {pendente ? <span className="normal-case tracking-normal text-brand">salvando...</span> : null}
          </div>
          <div className="font-display text-xl font-bold">{atual?.nome ?? "Sem etapa"}</div>
        </div>
        {atual ? <Atraso desde={estado.desde} prazo={atual.prazo_dias} /> : null}
      </div>

      <ol className="scroll-x mt-4 flex gap-1 overflow-x-auto pb-1">
        {etapas.map((e, i) => {
          const feito = idx >= 0 && i < idx;
          const agora = i === idx;
          return (
            <li key={e.id} className="min-w-[88px] flex-1">
              <button
                type="button"
                disabled={!ativo}
                title={ativo ? `Mover para ${e.nome}` : undefined}
                onClick={() => ativo && !agora && confirm(`Mover para "${e.nome}"?`) && ir(e.id, avisar)}
                className="block w-full text-left disabled:cursor-default"
              >
                <div
                  className={`h-1.5 rounded-full transition-colors ${feito ? "bg-brand" : agora ? "bg-coral" : "bg-line"}`}
                />
                <div className={`mt-1.5 text-[11px] leading-tight ${agora ? "font-bold text-ink" : "text-ink-soft"}`}>
                  {e.nome}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {erro ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{erro}</p> : null}

      {ativo ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 lg:flex-row lg:items-center">
          {proxima ? (
            <button type="button" className="btn btn-primary" onClick={() => ir(proxima.id, avisar)}>
              Avançar para {proxima.nome} <Icon name="arrowRight" size={15} />
            </button>
          ) : null}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <select
              value={escolhida}
              onChange={(ev) => setEscolhida(ev.target.value)}
              className="field w-auto min-w-48 flex-1"
            >
              {etapas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ordem}. {e.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={escolhida === estado.id}
              onClick={() => ir(escolhida, avisar)}
            >
              Mover
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={avisar} onChange={(ev) => setAvisar(ev.target.checked)} /> Avisar o cliente
            </label>
          </div>
        </div>
      ) : null}
    </section>
  );
}
