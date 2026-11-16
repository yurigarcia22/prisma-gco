import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Cliente, Etapa, Evento, Organizacao, Pendencia, Processo } from "@/lib/types";

const TOKEN_OK = /^[a-f0-9]{48}$/;

export type ProcessoPortal = Processo & {
  clientes: Cliente;
  corretores: { nome: string; telefone: string | null } | null;
  organizacoes: Pick<Organizacao, "nome" | "whatsapp_contato">;
};

/** Carrega tudo do processo pelo token do cliente. */
export const processoPorToken = cache(async (token: string) => {
  if (!TOKEN_OK.test(token)) return null;
  const db = createAdminClient();
  const { data: p } = await db
    .from("processos")
    .select("*, clientes(*), corretores(nome, telefone), organizacoes(nome, whatsapp_contato)")
    .eq("token_cliente", token)
    .maybeSingle<ProcessoPortal>();
  if (!p) return null;

  const [{ data: etapas }, { data: eventos }, { data: pendencias }] = await Promise.all([
    db.from("etapas").select("*").eq("fluxo_id", p.fluxo_id).order("ordem").returns<Etapa[]>(),
    db
      .from("eventos")
      .select("*")
      .eq("processo_id", p.id)
      .eq("publico", true)
      .order("criado_em", { ascending: false })
      .limit(60)
      .returns<Evento[]>(),
    db.from("pendencias").select("*").eq("processo_id", p.id).neq("status", "resolvida").order("criado_em").returns<Pendencia[]>(),
  ]);
  return { p, etapas: etapas ?? [], eventos: eventos ?? [], pendencias: pendencias ?? [] };
});

export interface CorretorPortal {
  id: string;
  org_id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  organizacoes: Pick<Organizacao, "nome" | "whatsapp_contato">;
}

export const corretorPorToken = cache(async (token: string) => {
  if (!TOKEN_OK.test(token)) return null;
  const { data } = await createAdminClient()
    .from("corretores")
    .select("id, org_id, nome, telefone, ativo, organizacoes(nome, whatsapp_contato)")
    .eq("token", token)
    .eq("ativo", true)
    .maybeSingle<CorretorPortal>();
  return data;
});

/**
 * O cliente não vê etapas internas. A etapa "atual" pra ele é a última visível
 * que já foi alcançada.
 */
export function etapasDoCliente(etapas: Etapa[], etapaAtualId: string | null) {
  const visiveis = etapas.filter((e) => e.visivel_cliente);
  const atual = etapas.find((e) => e.id === etapaAtualId);
  let idx = -1;
  if (atual) {
    visiveis.forEach((e, i) => {
      if (e.ordem <= atual.ordem) idx = i;
    });
  }
  if (idx < 0) idx = 0;
  return { visiveis, idx };
}

export function nomeArquivoSeguro(nome: string) {
  return nome.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
}
