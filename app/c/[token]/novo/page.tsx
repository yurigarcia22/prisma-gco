import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import FormProcesso from "@/components/FormProcesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { corretorPorToken } from "@/lib/portal";
import { novoProcessoCorretor } from "../actions";
import Topo from "../Topo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo processo", robots: { index: false, follow: false } };

export default async function NovoCorretor({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await corretorPorToken(token);
  if (!c) notFound();
  const { data: fluxos } = await createAdminClient()
    .from("fluxos")
    .select("id, nome")
    .eq("org_id", c.org_id)
    .eq("ativo", true)
    .order("criado_em");

  return (
    <main className="min-h-dvh pb-16">
      <Topo token={token} empresa={c.organizacoes.nome} nome={c.nome} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href={`/c/${token}`} className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand">
          <Icon name="arrowLeft" size={15} /> Meus processos
        </Link>
        <h1 className="font-display mt-2 text-2xl font-bold">Novo processo</h1>
        <p className="mb-6 text-sm text-ink-soft">
          O processo cai direto no painel da {c.organizacoes.nome}. Depois você pode enviar os documentos por aqui.
        </p>
        <FormProcesso acao={novoProcessoCorretor.bind(null, token)} fluxos={fluxos ?? []} textoBotao="Enviar processo" />
      </div>
    </main>
  );
}
