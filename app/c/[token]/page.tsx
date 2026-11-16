import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import Atraso from "@/components/Atraso";
import { createAdminClient } from "@/lib/supabase/admin";
import { corretorPorToken } from "@/lib/portal";
import { moeda, primeiroNome } from "@/lib/format";
import Topo from "./Topo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meus processos", robots: { index: false, follow: false } };

interface Linha {
  id: string;
  numero: number;
  status: string;
  etapa_desde: string;
  modalidade: string | null;
  valor_financiado: number | null;
  clientes: { nome: string } | null;
  etapas: { nome: string; prazo_dias: number | null } | null;
  pendencias: { status: string }[];
}

export default async function PortalCorretor({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ver?: string; q?: string }>;
}) {
  const { token } = await params;
  const { ver, q } = await searchParams;
  const c = await corretorPorToken(token);
  if (!c) notFound();

  const { data } = await createAdminClient()
    .from("processos")
    .select("id, numero, status, etapa_desde, modalidade, valor_financiado, clientes(nome), etapas(nome, prazo_dias), pendencias(status)")
    .eq("corretor_id", c.id)
    .order("etapa_desde", { ascending: false })
    .returns<Linha[]>();

  const todos = data ?? [];
  const ativos = todos.filter((p) => p.status === "ativo");
  const outros = todos.filter((p) => p.status !== "ativo");
  let lista = ver === "encerrados" ? outros : ativos;
  const busca = (q ?? "").trim().toLowerCase();
  if (busca) lista = lista.filter((p) => p.clientes?.nome.toLowerCase().includes(busca) || String(p.numero) === busca);

  return (
    <main className="min-h-dvh pb-16">
      <Topo token={token} empresa={c.organizacoes.nome} nome={c.nome} />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Olá, {primeiroNome(c.nome)}</h1>
            <p className="text-sm text-ink-soft">
              {ativos.length} processo(s) em andamento. Você recebe no WhatsApp cada vez que um deles anda.
            </p>
          </div>
          <Link href={`/c/${token}/novo`} className="btn btn-coral">
            <Icon name="plus" size={16} /> Novo processo
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/c/${token}`}
            className={`rounded-full border px-4 py-1.5 text-sm ${ver !== "encerrados" ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
          >
            Em andamento ({ativos.length})
          </Link>
          <Link
            href={`/c/${token}?ver=encerrados`}
            className={`rounded-full border px-4 py-1.5 text-sm ${ver === "encerrados" ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
          >
            Concluídos e encerrados ({outros.length})
          </Link>
          <form className="ml-auto w-full sm:w-60" action={`/c/${token}`}>
            {ver ? <input type="hidden" name="ver" value={ver} /> : null}
            <input name="q" defaultValue={q} placeholder="Buscar cliente" className="field" />
          </form>
        </div>

        <ul className="mt-4 space-y-2">
          {lista.map((p) => {
            const pend = p.pendencias.filter((x) => x.status !== "resolvida").length;
            return (
              <li key={p.id}>
                <Link href={`/c/${token}/p/${p.id}`} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-brand">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {p.clientes?.nome} <span className="text-xs font-normal text-ink-soft">#{p.numero}</span>
                    </div>
                    <div className="text-sm text-ink-soft">
                      {p.status === "ativo" ? p.etapas?.nome : p.status === "concluido" ? "Concluído" : "Cancelado"}
                      {p.modalidade ? ` · ${p.modalidade}` : ""}
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    {pend ? (
                      <span className="chip bg-amber-50 text-warn">
                        <Icon name="file" size={11} /> {pend} pendência(s)
                      </span>
                    ) : null}
                    {p.status === "ativo" ? <Atraso desde={p.etapa_desde} prazo={p.etapas?.prazo_dias} /> : null}
                    {p.valor_financiado ? <span className="tnum text-sm font-semibold">{moeda(p.valor_financiado)}</span> : null}
                    <Icon name="arrowRight" size={16} className="ml-auto text-ink-soft sm:ml-0" />
                  </div>
                </Link>
              </li>
            );
          })}
          {!lista.length ? (
            <li className="card p-8 text-center text-sm text-ink-soft">
              {busca ? "Nenhum processo encontrado." : "Nenhum processo aqui ainda."}
            </li>
          ) : null}
        </ul>
      </div>
    </main>
  );
}
