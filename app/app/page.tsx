import Link from "next/link";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import Atraso, { atrasado } from "@/components/Atraso";
import { dataHora, diasDesde, moeda } from "@/lib/format";

export const metadata: Metadata = { title: "Visão geral" };

interface Linha {
  id: string;
  numero: number;
  status: string;
  etapa_desde: string;
  atualizado_em: string;
  valor_financiado: number | null;
  clientes: { nome: string } | null;
  corretores: { nome: string } | null;
  etapas: { nome: string; prazo_dias: number | null } | null;
}

export default async function VisaoGeral() {
  const { supabase, membro } = await getSessao();

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [{ data: procs }, { count: pendencias }, { count: msgsProblema }, { data: eventos }] = await Promise.all([
    supabase
      .from("processos")
      .select(
        "id, numero, status, etapa_desde, atualizado_em, valor_financiado, clientes(nome), corretores(nome), etapas(nome, prazo_dias)",
      )
      .in("status", ["ativo", "concluido"])
      .order("etapa_desde")
      .returns<Linha[]>(),
    supabase.from("pendencias").select("id", { count: "exact", head: true }).neq("status", "resolvida"),
    supabase.from("notificacoes").select("id", { count: "exact", head: true }).in("status", ["manual", "falhou"]),
    supabase
      .from("eventos")
      .select("id, tipo, texto, criado_em, autor, processo_id, processos(numero, clientes(nome))")
      .in("tipo", ["etapa", "criado", "pendencia_resolvida", "documento"])
      .order("criado_em", { ascending: false })
      .limit(12),
  ]);

  const lista = procs ?? [];
  const ativos = lista.filter((p) => p.status === "ativo");
  const atrasados = ativos
    .filter((p) => atrasado(p.etapa_desde, p.etapas?.prazo_dias))
    .sort(
      (a, b) =>
        diasDesde(b.etapa_desde) - (b.etapas?.prazo_dias ?? 0) - (diasDesde(a.etapa_desde) - (a.etapas?.prazo_dias ?? 0)),
    );
  const concluidosMes = lista.filter((p) => p.status === "concluido" && new Date(p.atualizado_em) >= inicioMes);
  const carteira = ativos.reduce((s, p) => s + Number(p.valor_financiado ?? 0), 0);

  const kpis = [
    { rotulo: "Em andamento", valor: ativos.length, icone: "kanban", cor: "text-brand", href: "/app/processos" },
    { rotulo: "Acima do prazo", valor: atrasados.length, icone: "alert", cor: "text-bad", href: "/app/processos?filtro=atrasados" },
    { rotulo: "Concluídos no mês", valor: concluidosMes.length, icone: "flag", cor: "text-ok", href: "/app/processos?status=concluido" },
    { rotulo: "Pendências abertas", valor: pendencias ?? 0, icone: "file", cor: "text-warn", href: "/app/processos" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">Olá, {membro.nome.split(" ")[0]}</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Visão geral</h1>
        </div>
        <Link href="/app/processos/novo" className="btn btn-coral">
          <Icon name="plus" size={16} /> Novo processo
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.rotulo} href={k.href} className="card p-4 transition hover:border-brand">
            <div className={`flex items-center gap-2 text-sm font-medium ${k.cor}`}>
              <Icon name={k.icone} size={16} />
              {k.rotulo}
            </div>
            <div className="font-display tnum mt-2 text-3xl font-bold">{k.valor}</div>
          </Link>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center justify-between p-4">
          <span className="text-sm text-ink-soft">Valor financiado em andamento</span>
          <span className="font-display tnum text-lg font-bold">{moeda(carteira)}</span>
        </div>
        <Link
          href="/app/whatsapp"
          className={`card flex items-center justify-between p-4 ${msgsProblema ? "border-amber-300 bg-amber-50" : ""}`}
        >
          <span className="flex items-center gap-2 text-sm text-ink-soft">
            <Icon name="chat" size={16} /> Mensagens para enviar à mão
          </span>
          <span className="font-display tnum text-lg font-bold">{msgsProblema ?? 0}</span>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold">
            <Icon name="alert" size={18} className="text-bad" /> Precisam de atenção
          </h2>
          <p className="text-sm text-ink-soft">Processos que já passaram do prazo médio da etapa.</p>
          {atrasados.length === 0 ? (
            <p className="mt-6 rounded-lg bg-emerald-50 px-4 py-6 text-center text-sm text-ok">
              Nenhum processo acima do prazo. Tudo andando.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {atrasados.slice(0, 10).map((p) => (
                <li key={p.id}>
                  <Link href={`/app/processos/${p.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        <span className="text-ink-soft">#{p.numero}</span> {p.clientes?.nome}
                      </div>
                      <div className="truncate text-xs text-ink-soft">
                        {p.etapas?.nome}
                        {p.corretores?.nome ? ` · ${p.corretores.nome}` : ""}
                      </div>
                    </div>
                    <Atraso desde={p.etapa_desde} prazo={p.etapas?.prazo_dias} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Últimas movimentações</h2>
          {!eventos?.length ? (
            <p className="mt-6 text-sm text-ink-soft">Ainda não tem movimentação.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {eventos.map((e) => {
                const p = e.processos as unknown as { numero: number; clientes: { nome: string } | null } | null;
                return (
                  <li key={e.id} className="text-sm">
                    <Link href={`/app/processos/${e.processo_id}`} className="hover:text-brand">
                      <span className="font-semibold">
                        #{p?.numero} {p?.clientes?.nome}
                      </span>
                      <span className="block text-ink-soft">
                        {e.tipo === "etapa"
                          ? `Foi para ${e.texto}`
                          : e.tipo === "criado"
                            ? "Processo aberto"
                            : e.tipo === "documento"
                              ? `Documento: ${e.texto}`
                              : `Pendência resolvida: ${e.texto}`}
                      </span>
                      <span className="text-xs text-ink-soft/80">
                        {dataHora(e.criado_em)}
                        {e.autor ? ` · ${e.autor}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
