import Link from "next/link";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import { SubmitButton } from "@/components/ui";
import { criarFluxo } from "./actions";

export const metadata: Metadata = { title: "Fluxos e etapas" };

export default async function Fluxos() {
  const { supabase } = await getSessao();
  const { data: fluxos } = await supabase
    .from("fluxos")
    .select("id, nome, descricao, ativo, etapas(count), processos(count)")
    .order("criado_em");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Fluxos e etapas</h1>
      <p className="text-sm text-ink-soft">
        Cada fluxo é um caminho de financiamento com as suas etapas. Monte do jeito que a sua operação funciona.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(fluxos ?? []).map((f) => {
          const nEtapas = (f.etapas as unknown as { count: number }[])[0]?.count ?? 0;
          const nProc = (f.processos as unknown as { count: number }[])[0]?.count ?? 0;
          return (
            <Link key={f.id} href={`/app/fluxos/${f.id}`} className="card block p-5 transition hover:border-brand">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-bold">{f.nome}</h2>
                {!f.ativo ? <span className="chip bg-[#eef1f3] text-ink-soft">inativo</span> : null}
              </div>
              {f.descricao ? <p className="mt-1 text-sm text-ink-soft">{f.descricao}</p> : null}
              <div className="mt-4 flex gap-4 text-sm text-ink-soft">
                <span className="flex items-center gap-1">
                  <Icon name="layers" size={15} /> {nEtapas} etapas
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="kanban" size={15} /> {nProc} processos
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <form action={criarFluxo} className="card mt-6 space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Novo fluxo</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nome</label>
            <input name="nome" required placeholder="Ex.: Construção em terreno próprio" className="field" />
          </div>
          <div>
            <label className="label">Começar com as etapas de</label>
            <select name="copiar_de" className="field" defaultValue="">
              <option value="">Nenhum (em branco)</option>
              {(fluxos ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descrição</label>
            <input name="descricao" className="field" />
          </div>
        </div>
        <SubmitButton>
          <Icon name="plus" size={15} /> Criar fluxo
        </SubmitButton>
      </form>
    </div>
  );
}
