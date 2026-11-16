import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import { ConfirmarBotao, SubmitButton } from "@/components/ui";
import { MODELO_ETAPA_PADRAO } from "@/lib/notificacoes";
import type { Etapa, Fluxo } from "@/lib/types";
import { atualizarEtapa, atualizarFluxo, criarEtapa, excluirEtapa, excluirFluxo, moverOrdemEtapa } from "../actions";

export const metadata: Metadata = { title: "Editar fluxo" };

const ERROS: Record<string, string> = {
  "tem-processos": "Esse fluxo tem processos. Desative em vez de excluir.",
  "etapa-com-processos": "Tem processo parado nessa etapa. Mova os processos antes de excluir.",
};

export default async function EditarFluxo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { supabase } = await getSessao();
  const [{ data: fluxo }, { data: etapas }, { data: contagem }] = await Promise.all([
    supabase.from("fluxos").select("*").eq("id", id).maybeSingle<Fluxo>(),
    supabase.from("etapas").select("*").eq("fluxo_id", id).order("ordem").returns<Etapa[]>(),
    supabase.from("processos").select("etapa_id").eq("fluxo_id", id).eq("status", "ativo"),
  ]);
  if (!fluxo) notFound();
  const porEtapa = new Map<string, number>();
  (contagem ?? []).forEach((p) => p.etapa_id && porEtapa.set(p.etapa_id, (porEtapa.get(p.etapa_id) ?? 0) + 1));
  const lista = etapas ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/fluxos" className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand">
        <Icon name="arrowLeft" size={15} /> Fluxos
      </Link>

      {erro && ERROS[erro] ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{ERROS[erro]}</p> : null}

      <form action={atualizarFluxo} className="card mt-3 p-5">
        <input type="hidden" name="fluxo_id" value={fluxo.id} />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label">Nome do fluxo</label>
            <input name="nome" defaultValue={fluxo.nome} className="field font-semibold" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <input name="descricao" defaultValue={fluxo.descricao ?? ""} className="field" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="ativo" defaultChecked={fluxo.ativo} /> Ativo
          </label>
        </div>
        <div className="mt-3">
          <SubmitButton className="btn btn-primary btn-sm">Salvar fluxo</SubmitButton>
        </div>
      </form>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Etapas</h2>
          <p className="text-sm text-ink-soft">Clique numa etapa para editar o que o cliente vê e a mensagem do WhatsApp.</p>
        </div>
      </div>

      <ol className="mt-3 space-y-2">
        {lista.map((e, i) => (
          <li key={e.id} className="card">
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky font-bold text-brand">{e.ordem}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{e.nome}</div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-ink-soft">
                    {e.nome_cliente && e.nome_cliente !== e.nome ? <span>Cliente vê: {e.nome_cliente}</span> : null}
                    {e.prazo_dias ? <span>prazo {e.prazo_dias} dias</span> : <span>sem prazo</span>}
                    {!e.visivel_cliente ? <span>interna</span> : null}
                    {e.notificar && e.visivel_cliente ? <span className="text-ok">avisa no WhatsApp</span> : null}
                    {e.final ? <span className="font-semibold text-ok">conclui o processo</span> : null}
                    {porEtapa.get(e.id) ? <span>{porEtapa.get(e.id)} processo(s) aqui</span> : null}
                  </div>
                </div>
                <Icon name="pen" size={16} className="text-ink-soft" />
              </summary>

              <div className="border-t border-line p-4">
                <form action={atualizarEtapa} className="space-y-3">
                  <input type="hidden" name="fluxo_id" value={fluxo.id} />
                  <input type="hidden" name="etapa_id" value={e.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="label">Nome interno</label>
                      <input name="nome" defaultValue={e.nome} className="field" />
                    </div>
                    <div>
                      <label className="label">Nome que o cliente vê</label>
                      <input name="nome_cliente" defaultValue={e.nome_cliente ?? ""} placeholder={e.nome} className="field" />
                    </div>
                    <div>
                      <label className="label">Prazo médio (dias)</label>
                      <input name="prazo_dias" type="number" min={1} defaultValue={e.prazo_dias ?? ""} className="field" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Explicação para o cliente</label>
                    <textarea
                      name="descricao_cliente"
                      defaultValue={e.descricao_cliente ?? ""}
                      placeholder="O que acontece nesta etapa, em linguagem simples"
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">Mensagem do WhatsApp ao entrar nesta etapa</label>
                    <textarea name="mensagem" defaultValue={e.mensagem ?? ""} placeholder={MODELO_ETAPA_PADRAO} rows={4} className="field" />
                    <p className="mt-1 text-xs text-ink-soft">
                      Deixe em branco para usar a mensagem padrão. Pode usar: {"{nome}"} {"{etapa}"} {"{descricao}"} {"{prazo}"}{" "}
                      {"{empresa}"} {"{link}"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="visivel_cliente" defaultChecked={e.visivel_cliente} /> Cliente vê esta etapa
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="notificar" defaultChecked={e.notificar} /> Avisar no WhatsApp
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="final" defaultChecked={e.final} /> Etapa final (conclui o processo)
                    </label>
                  </div>
                  <SubmitButton className="btn btn-primary btn-sm">Salvar etapa</SubmitButton>
                </form>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  <form action={moverOrdemEtapa}>
                    <input type="hidden" name="fluxo_id" value={fluxo.id} />
                    <input type="hidden" name="etapa_id" value={e.id} />
                    <input type="hidden" name="direcao" value="cima" />
                    <button className="btn btn-ghost btn-sm" disabled={i === 0}>
                      <Icon name="up" size={14} /> Subir
                    </button>
                  </form>
                  <form action={moverOrdemEtapa}>
                    <input type="hidden" name="fluxo_id" value={fluxo.id} />
                    <input type="hidden" name="etapa_id" value={e.id} />
                    <input type="hidden" name="direcao" value="baixo" />
                    <button className="btn btn-ghost btn-sm" disabled={i === lista.length - 1}>
                      <Icon name="down" size={14} /> Descer
                    </button>
                  </form>
                  <form action={excluirEtapa} className="ml-auto">
                    <input type="hidden" name="fluxo_id" value={fluxo.id} />
                    <input type="hidden" name="etapa_id" value={e.id} />
                    <ConfirmarBotao mensagem={`Excluir a etapa ${e.nome}?`} className="btn btn-ghost btn-sm text-bad">
                      <Icon name="trash" size={14} /> Excluir
                    </ConfirmarBotao>
                  </form>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>

      <form action={criarEtapa} className="card mt-3 flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="fluxo_id" value={fluxo.id} />
        <div className="min-w-48 flex-1">
          <label className="label">Nova etapa</label>
          <input name="nome" required placeholder="Ex.: Laudo de engenharia" className="field" />
        </div>
        <div className="w-32">
          <label className="label">Prazo (dias)</label>
          <input name="prazo_dias" type="number" min={1} className="field" />
        </div>
        <SubmitButton className="btn btn-primary">
          <Icon name="plus" size={15} /> Adicionar
        </SubmitButton>
      </form>

      <form action={excluirFluxo} className="mt-8 text-right">
        <input type="hidden" name="fluxo_id" value={fluxo.id} />
        <ConfirmarBotao mensagem="Excluir este fluxo e todas as etapas?" className="text-sm text-ink-soft underline hover:text-bad">
          Excluir fluxo
        </ConfirmarBotao>
      </form>
    </div>
  );
}
