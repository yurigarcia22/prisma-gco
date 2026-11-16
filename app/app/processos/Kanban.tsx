"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import Atraso from "@/components/Atraso";
import { moeda } from "@/lib/format";
import type { Etapa } from "@/lib/types";
import { moverEtapaKanban } from "./actions";

export interface CardProcesso {
  id: string;
  numero: number;
  etapa_id: string | null;
  etapa_desde: string;
  modalidade: string | null;
  valor_financiado: number | null;
  cliente: string;
  cpf: string;
  telefone: string;
  corretor: string | null;
  pendencias: number;
}

export default function Kanban({ etapas, cards }: { etapas: Etapa[]; cards: CardProcesso[] }) {
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [lista, mover] = useOptimistic(cards, (atual: CardProcesso[], m: { id: string; etapa: string }) =>
    atual.map((c) => (c.id === m.id ? { ...c, etapa_id: m.etapa, etapa_desde: new Date().toISOString() } : c)),
  );

  function soltar(etapaId: string) {
    const id = arrastando;
    setArrastando(null);
    setSobre(null);
    if (!id) return;
    const card = lista.find((c) => c.id === id);
    if (!card || card.etapa_id === etapaId) return;
    setErro(null);
    startTransition(async () => {
      mover({ id, etapa: etapaId });
      const r = await moverEtapaKanban(id, etapaId);
      if (r?.erro) setErro(r.erro);
    });
  }

  const semEtapa = lista.filter((c) => !c.etapa_id || !etapas.some((e) => e.id === c.etapa_id));

  return (
    <>
      {erro ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{erro}</p> : null}
      {semEtapa.length ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-warn">
          {semEtapa.length} processo(s) estão numa etapa que foi apagada. Abra o processo e escolha uma etapa.
        </p>
      ) : null}
      <div className="scroll-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {etapas.map((e) => {
          const daEtapa = lista.filter((c) => c.etapa_id === e.id);
          return (
            <div
              key={e.id}
              onDragOver={(ev) => {
                ev.preventDefault();
                setSobre(e.id);
              }}
              onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
              onDrop={() => soltar(e.id)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border p-2 transition ${
                sobre === e.id ? "border-brand bg-sky" : "border-transparent bg-[#e9eff3]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">
                    {e.ordem}. {e.nome}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-ink-soft">
                    {e.prazo_dias ? <span>prazo {e.prazo_dias} d</span> : null}
                    {!e.visivel_cliente ? (
                      <span className="flex items-center gap-1">
                        <Icon name="eyeOff" size={11} /> interna
                      </span>
                    ) : null}
                    {e.final ? <span className="text-ok">final</span> : null}
                  </div>
                </div>
                <span className="chip bg-white text-ink-soft">{daEtapa.length}</span>
              </div>
              <div className="flex min-h-24 flex-col gap-2">
                {daEtapa.map((c) => (
                  <Link
                    key={c.id}
                    href={`/app/processos/${c.id}`}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.effectAllowed = "move";
                      setArrastando(c.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                    className={`card block cursor-grab p-3 transition hover:border-brand active:cursor-grabbing ${
                      arrastando === c.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 font-semibold leading-snug">{c.cliente}</div>
                      <span className="text-xs text-ink-soft">#{c.numero}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-ink-soft">
                      {[c.modalidade, c.corretor].filter(Boolean).join(" · ") || "Sem corretor"}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Atraso desde={c.etapa_desde} prazo={e.prazo_dias} />
                      {c.pendencias ? (
                        <span className="chip bg-amber-50 text-warn">
                          <Icon name="file" size={11} /> {c.pendencias}
                        </span>
                      ) : null}
                      {c.valor_financiado ? (
                        <span className="tnum ml-auto text-xs font-semibold text-ink-soft">{moeda(c.valor_financiado)}</span>
                      ) : null}
                    </div>
                  </Link>
                ))}
                {daEtapa.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#c9d5dd] px-3 py-6 text-center text-xs text-ink-soft">
                    Nenhum processo
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
