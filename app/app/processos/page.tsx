import Link from "next/link";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import Kanban, { type CardProcesso } from "./Kanban";
import { atrasado } from "@/components/Atraso";
import type { Etapa, Fluxo } from "@/lib/types";

export const metadata: Metadata = { title: "Processos" };

export default async function Processos({
  searchParams,
}: {
  searchParams: Promise<{ fluxo?: string; q?: string; status?: string; filtro?: string; corretor?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await getSessao();

  const [{ data: fluxos }, { data: corretores }] = await Promise.all([
    supabase.from("fluxos").select("*").eq("ativo", true).order("criado_em").returns<Fluxo[]>(),
    supabase.from("corretores").select("id, nome").order("nome"),
  ]);
  const listaFluxos = fluxos ?? [];
  const fluxo = listaFluxos.find((f) => f.id === sp.fluxo) ?? listaFluxos[0];

  if (!fluxo) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-bold">Processos</h1>
        <div className="card mt-6 p-8 text-center">
          <p>Antes de cadastrar processos, crie um fluxo com as etapas.</p>
          <Link href="/app/fluxos" className="btn btn-primary mt-4">
            Criar fluxo
          </Link>
        </div>
      </div>
    );
  }

  const status = sp.status === "concluido" || sp.status === "cancelado" ? sp.status : "ativo";

  let q = supabase
    .from("processos")
    .select(
      "id, numero, etapa_id, etapa_desde, modalidade, valor_financiado, status, clientes(nome, cpf, telefone), corretores(nome), pendencias(status)",
    )
    .eq("fluxo_id", fluxo.id)
    .eq("status", status)
    .order("etapa_desde");
  if (sp.corretor) q = q.eq("corretor_id", sp.corretor);

  const [{ data: etapas }, { data: procs }] = await Promise.all([
    supabase.from("etapas").select("*").eq("fluxo_id", fluxo.id).order("ordem").returns<Etapa[]>(),
    q,
  ]);

  const busca = (sp.q ?? "").trim().toLowerCase();
  const soDigitos = busca.replace(/\D/g, "");
  const listaEtapas = etapas ?? [];
  const prazoPorEtapa = new Map(listaEtapas.map((e) => [e.id, e.prazo_dias]));

  const cards: CardProcesso[] = (procs ?? [])
    .map((p) => {
      const c = p.clientes as unknown as { nome: string; cpf: string | null; telefone: string | null } | null;
      const corr = p.corretores as unknown as { nome: string } | null;
      const pend = (p.pendencias as unknown as { status: string }[] | null) ?? [];
      return {
        id: p.id,
        numero: p.numero,
        etapa_id: p.etapa_id,
        etapa_desde: p.etapa_desde,
        modalidade: p.modalidade,
        valor_financiado: p.valor_financiado,
        cliente: c?.nome ?? "Sem nome",
        cpf: c?.cpf ?? "",
        telefone: c?.telefone ?? "",
        corretor: corr?.nome ?? null,
        pendencias: pend.filter((x) => x.status !== "resolvida").length,
      };
    })
    .filter((c) => {
      if (busca) {
        const okNome = c.cliente.toLowerCase().includes(busca) || String(c.numero) === busca.replace("#", "");
        const okDoc = soDigitos.length >= 4 && (c.cpf.includes(soDigitos) || c.telefone.includes(soDigitos));
        if (!okNome && !okDoc) return false;
      }
      if (sp.filtro === "atrasados" && !atrasado(c.etapa_desde, prazoPorEtapa.get(c.etapa_id ?? ""))) return false;
      return true;
    });

  const montarUrl = (mudar: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base = { fluxo: fluxo.id, q: sp.q, status: sp.status, filtro: sp.filtro, corretor: sp.corretor, ...mudar };
    Object.entries(base).forEach(([k, v]) => v && p.set(k, v));
    return `/app/processos?${p.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Processos</h1>
          <p className="text-sm text-ink-soft">Arraste o card para mudar de etapa. O cliente e o corretor são avisados.</p>
        </div>
        <Link href={`/app/processos/novo?fluxo=${fluxo.id}`} className="btn btn-coral">
          <Icon name="plus" size={16} /> Novo processo
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {listaFluxos.map((f) => (
          <Link
            key={f.id}
            href={montarUrl({ fluxo: f.id })}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              f.id === fluxo.id ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
            }`}
          >
            {f.nome}
          </Link>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/app/processos">
        <input type="hidden" name="fluxo" value={fluxo.id} />
        <div className="relative w-full sm:w-72">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input name="q" defaultValue={sp.q} placeholder="Nome, CPF, telefone ou nº" className="field pl-9" />
        </div>
        <select name="corretor" defaultValue={sp.corretor ?? ""} className="field w-auto">
          <option value="">Todos os corretores</option>
          {(corretores ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="field w-auto">
          <option value="ativo">Em andamento</option>
          <option value="concluido">Concluídos</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <input type="checkbox" name="filtro" value="atrasados" defaultChecked={sp.filtro === "atrasados"} />
          Só acima do prazo
        </label>
        <button className="btn btn-ghost">Filtrar</button>
        {sp.q || sp.corretor || sp.filtro || sp.status ? (
          <Link href={`/app/processos?fluxo=${fluxo.id}`} className="text-sm text-ink-soft underline">
            Limpar
          </Link>
        ) : null}
      </form>

      <div className="mt-5">
        <Kanban etapas={listaEtapas} cards={cards} />
      </div>
    </div>
  );
}
