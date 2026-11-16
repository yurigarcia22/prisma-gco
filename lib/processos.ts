import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avisarMudancaEtapa, enviarBoasVindas } from "@/lib/notificacoes";
import { normalizarTelefone } from "@/lib/whatsapp";
import type { Etapa } from "@/lib/types";

export interface DadosNovoProcesso {
  org_id: string;
  fluxo_id: string;
  corretor_id: string | null;
  cliente: { nome: string; cpf: string | null; telefone: string | null; email: string | null };
  modalidade: string | null;
  imovel: string | null;
  valor_imovel: number | null;
  valor_financiado: number | null;
  observacoes: string | null;
  autor: string;
  enviar_boas_vindas: boolean;
}

function mensagemErro(e: { message?: string } | null, padrao: string) {
  return e?.message && !e.message.includes("violates") ? e.message : padrao;
}

/**
 * Cria o processo já na primeira etapa do fluxo, numa ida só ao banco.
 * `db` é o cliente da sessão da equipe (RLS) ou o da chave secreta (portal do
 * corretor, que já validou o token e o org_id).
 * A boas-vindas no WhatsApp sai em segundo plano, depois da resposta.
 */
export async function criarProcesso(db: SupabaseClient, d: DadosNovoProcesso) {
  const cpf = d.cliente.cpf?.replace(/\D/g, "") || null;
  const telefone = normalizarTelefone(d.cliente.telefone) ?? d.cliente.telefone;

  const { data, error } = await db.rpc("criar_processo", {
    p_org: d.org_id,
    p_fluxo: d.fluxo_id,
    p_corretor: d.corretor_id,
    p_nome: d.cliente.nome,
    p_cpf: cpf,
    p_telefone: telefone,
    p_email: d.cliente.email,
    p_modalidade: d.modalidade,
    p_imovel: d.imovel,
    p_valor_imovel: d.valor_imovel,
    p_valor_financiado: d.valor_financiado,
    p_observacoes: d.observacoes,
    p_autor: d.autor,
  });
  if (error || !data) throw new Error(mensagemErro(error, "Não deu para criar o processo."));
  const proc = data as { id: string; numero: number };

  if (d.enviar_boas_vindas) {
    after(() => enviarBoasVindas(proc.id).catch((e) => console.error("Boas-vindas falhou:", e)));
  }
  return proc;
}

/** Move o processo para outra etapa (uma ida ao banco) e avisa em segundo plano. */
export async function moverEtapa(
  db: SupabaseClient,
  opts: { processo_id: string; etapa_id: string; autor: string; avisar_cliente: boolean },
) {
  const { data, error } = await db.rpc("mover_etapa", {
    p_processo: opts.processo_id,
    p_etapa: opts.etapa_id,
    p_autor: opts.autor,
  });
  if (error) throw new Error(mensagemErro(error, "Não deu para mover o processo."));
  const r = data as { mudou: boolean; etapa?: Etapa };
  if (!r?.mudou || !r.etapa) return;

  const etapa = r.etapa;
  after(() =>
    avisarMudancaEtapa(opts.processo_id, etapa, opts.avisar_cliente).catch((e) =>
      console.error("Aviso de etapa falhou:", e),
    ),
  );
}
