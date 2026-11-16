import Link from "next/link";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import FormProcesso from "@/components/FormProcesso";
import Icon from "@/components/Icon";
import { novoProcesso } from "../actions";

export const metadata: Metadata = { title: "Novo processo" };

export default async function NovoProcesso({ searchParams }: { searchParams: Promise<{ fluxo?: string }> }) {
  const { fluxo } = await searchParams;
  const { supabase } = await getSessao();
  const [{ data: fluxos }, { data: corretores }] = await Promise.all([
    supabase.from("fluxos").select("id, nome").eq("ativo", true).order("criado_em"),
    supabase.from("corretores").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/processos" className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand">
        <Icon name="arrowLeft" size={15} /> Processos
      </Link>
      <h1 className="font-display mt-2 text-2xl font-bold sm:text-3xl">Novo processo</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Se já existir cliente com o mesmo CPF, o cadastro dele é reaproveitado.
      </p>
      <FormProcesso acao={novoProcesso} fluxos={fluxos ?? []} corretores={corretores ?? []} fluxoPadrao={fluxo} />
    </div>
  );
}
