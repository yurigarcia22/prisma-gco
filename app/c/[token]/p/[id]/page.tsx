import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import Atraso from "@/components/Atraso";
import Timeline from "@/components/Timeline";
import Upload from "@/components/Upload";
import { CopiarBotao } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { corretorPorToken } from "@/lib/portal";
import { data, moeda, primeiroNome, telefoneBonito } from "@/lib/format";
import { linkCliente } from "@/lib/links";
import { linkWaMe } from "@/lib/whatsapp";
import type { Etapa, Evento, Pendencia, Processo } from "@/lib/types";
import { prepararUploadCorretor, registrarDocumentoCorretor } from "../../actions";
import Topo from "../../Topo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Processo", robots: { index: false, follow: false } };

type P = Processo & { clientes: { nome: string; telefone: string | null } };

export default async function ProcessoCorretor({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  const { token, id } = await params;
  const { novo } = await searchParams;
  const c = await corretorPorToken(token);
  if (!c) notFound();
  const db = createAdminClient();
  const { data: p } = await db
    .from("processos")
    .select("*, clientes(nome, telefone)")
    .eq("id", id)
    .eq("corretor_id", c.id)
    .maybeSingle<P>();
  if (!p) notFound();

  const [{ data: etapas }, { data: eventos }, { data: pendencias }, { data: docs }] = await Promise.all([
    db.from("etapas").select("*").eq("fluxo_id", p.fluxo_id).order("ordem").returns<Etapa[]>(),
    db
      .from("eventos")
      .select("*")
      .eq("processo_id", p.id)
      .neq("tipo", "nota")
      .order("criado_em", { ascending: false })
      .limit(60)
      .returns<Evento[]>(),
    db.from("pendencias").select("*").eq("processo_id", p.id).neq("status", "resolvida").returns<Pendencia[]>(),
    db.from("documentos").select("id, nome, enviado_por, criado_em").eq("processo_id", p.id).order("criado_em", { ascending: false }),
  ]);
  const lista = etapas ?? [];
  const atual = lista.find((e) => e.id === p.etapa_id);
  const idx = atual ? lista.indexOf(atual) : -1;
  const link = linkCliente(p.token_cliente);

  return (
    <main className="min-h-dvh pb-16">
      <Topo token={token} empresa={c.organizacoes.nome} nome={c.nome} />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Link href={`/c/${token}`} className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand">
          <Icon name="arrowLeft" size={15} /> Meus processos
        </Link>

        {novo ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-ok">
            Processo enviado para a {c.organizacoes.nome}. Se quiser, já mande os documentos aqui embaixo.
          </p>
        ) : null}

        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-bold">{p.clientes.nome}</h1>
              <p className="text-sm text-ink-soft">
                #{p.numero} · {p.modalidade ?? "Financiamento"} · aberto em {data(p.criado_em)}
              </p>
            </div>
            {p.valor_financiado ? <span className="tnum font-semibold">{moeda(p.valor_financiado)}</span> : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Etapa atual</div>
              <div className="font-display text-lg font-bold">
                {p.status === "ativo" ? (atual?.nome ?? "-") : p.status === "concluido" ? "Concluído" : "Cancelado"}
              </div>
            </div>
            {p.status === "ativo" && atual ? <Atraso desde={p.etapa_desde} prazo={atual.prazo_dias} /> : null}
          </div>
          <ol className="scroll-x mt-4 flex gap-1 overflow-x-auto pb-1">
            {lista.map((e, i) => (
              <li key={e.id} className="min-w-[80px] flex-1">
                <div className={`h-1.5 rounded-full ${i < idx || p.status === "concluido" ? "bg-brand" : i === idx ? "bg-coral" : "bg-line"}`} />
                <div className={`mt-1.5 text-[11px] leading-tight ${i === idx ? "font-bold" : "text-ink-soft"}`}>{e.nome}</div>
              </li>
            ))}
          </ol>
        </section>

        {pendencias?.length ? (
          <section className="card border-amber-300 p-5">
            <h2 className="font-display text-lg font-bold">Documentos pedidos ao cliente</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {pendencias.map((x) => (
                <li key={x.id} className="flex items-center gap-2">
                  <Icon name={x.status === "enviada" ? "check" : "alert"} size={14} className={x.status === "enviada" ? "text-ok" : "text-warn"} />
                  {x.descricao}
                  {x.status === "enviada" ? <span className="text-xs text-ok">(enviado, em conferência)</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">Se você tiver algum desses, pode enviar aqui embaixo.</p>
          </section>
        ) : null}

        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Documentos</h2>
            <Upload
              preparar={prepararUploadCorretor.bind(null, token, p.id)}
              registrar={registrarDocumentoCorretor.bind(null, token, p.id)}
              rotulo="Enviar"
              className="btn btn-coral btn-sm"
            />
          </div>
          {docs?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <Icon name="file" size={14} className="text-brand" />
                  <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                  <span className="text-xs text-ink-soft">{d.enviado_por}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Nenhum documento ainda.</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">Link do cliente</h2>
          <p className="text-sm text-ink-soft">
            O cliente acompanha por aqui. Ele já recebe no WhatsApp, mas você pode reenviar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopiarBotao texto={link} />
            {p.clientes.telefone ? (
              <a
                href={linkWaMe(
                  p.clientes.telefone,
                  `Oi, ${primeiroNome(p.clientes.nome)}! Por este link você acompanha cada etapa do seu financiamento: ${link}`,
                )}
                target="_blank"
                rel="noreferrer"
                className="btn btn-wpp btn-sm"
              >
                <Icon name="chat" size={14} /> Mandar para {telefoneBonito(p.clientes.telefone)}
              </a>
            ) : null}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-display mb-4 text-lg font-bold">Histórico</h2>
          <Timeline eventos={eventos ?? []} nomesEtapa={new Map(lista.map((e) => [e.id, e.nome]))} visaoCliente />
        </section>
      </div>
    </main>
  );
}
