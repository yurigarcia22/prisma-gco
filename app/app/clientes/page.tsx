import Link from "next/link";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import { cpfBonito, data, telefoneBonito } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes" };

interface Linha {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  criado_em: string;
  processos: { id: string; numero: number; status: string; etapas: { nome: string } | null }[];
}

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await getSessao();
  let consulta = supabase
    .from("clientes")
    .select("id, nome, cpf, telefone, criado_em, processos(id, numero, status, etapas(nome))")
    .order("nome")
    .limit(300);
  const busca = (q ?? "").trim();
  if (busca) {
    const dig = busca.replace(/\D/g, "");
    consulta =
      dig.length >= 4
        ? consulta.or(`cpf.ilike.%${dig}%,telefone.ilike.%${dig}%`)
        : consulta.ilike("nome", `%${busca.replace(/[%,()]/g, "")}%`);
  }
  const { data: clientes } = await consulta.returns<Linha[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Clientes</h1>
      <p className="text-sm text-ink-soft">O cliente é cadastrado sozinho quando um processo é aberto.</p>

      <form className="mt-5 flex gap-2" action="/app/clientes">
        <div className="relative w-full sm:w-80">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input name="q" defaultValue={q} placeholder="Nome, CPF ou telefone" className="field pl-9" />
        </div>
        <button className="btn btn-ghost">Buscar</button>
      </form>

      <div className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Processos</th>
                <th className="px-4 py-3">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(clientes ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.nome}</td>
                  <td className="px-4 py-3">{telefoneBonito(c.telefone)}</td>
                  <td className="px-4 py-3">{cpfBonito(c.cpf)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.processos.map((p) => (
                        <Link
                          key={p.id}
                          href={`/app/processos/${p.id}`}
                          className={`chip hover:underline ${p.status === "ativo" ? "bg-sky text-brand" : "bg-[#eef1f3] text-ink-soft"}`}
                        >
                          #{p.numero} {p.status === "ativo" ? p.etapas?.nome : p.status}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{data(c.criado_em)}</td>
                </tr>
              ))}
              {!clientes?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
