import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarSemNovidade, dispararPendentes, pedirPendencia } from "@/lib/notificacoes";
import { evolutionPronto, type ConfigEvolution } from "@/lib/whatsapp";
import type { Etapa } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIA = 86_400_000;

/**
 * Roda 1x por dia (vercel.json). Para cada correspondente:
 * 1) reenvia o que falhou;
 * 2) avisa "sem novidade" quem está há X dias sem mensagem;
 * 3) cobra documento pedido que não chegou.
 * Os avisos automáticos (2 e 3) só saem com o WhatsApp automático ligado,
 * e não saem no fim de semana.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const db = createAdminClient();
  const diaSemana = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
  const { data: orgs } = await db.from("organizacoes").select("id, dias_sem_novidade, dias_lembrete_pendencia");
  const relatorio: Record<string, unknown>[] = [];

  for (const org of orgs ?? []) {
    const r: Record<string, unknown> = { org: org.id };
    r.reenvio = await dispararPendentes(org.id);

    const { data: cfg } = await db
      .from("org_whatsapp")
      .select("evolution_url, evolution_key, instancia, ativo")
      .eq("org_id", org.id)
      .maybeSingle<ConfigEvolution>();
    if (!evolutionPronto(cfg) || fimDeSemana) {
      r.avisos = "pulado (WhatsApp desligado ou fim de semana)";
      relatorio.push(r);
      continue;
    }

    // Sem novidade
    let semNovidade = 0;
    if (org.dias_sem_novidade > 0) {
      const limite = Date.now() - org.dias_sem_novidade * DIA;
      const { data: procs } = await db
        .from("processos")
        .select("id, etapa_desde, ultimo_aviso_cliente, etapas(*), clientes(telefone)")
        .eq("org_id", org.id)
        .eq("status", "ativo");
      for (const p of procs ?? []) {
        const etapa = p.etapas as unknown as Etapa | null;
        const cliente = p.clientes as unknown as { telefone: string | null } | null;
        if (!etapa?.visivel_cliente || !cliente?.telefone) continue;
        const ultimo = Math.max(new Date(p.etapa_desde).getTime(), p.ultimo_aviso_cliente ? new Date(p.ultimo_aviso_cliente).getTime() : 0);
        if (ultimo > limite) continue;
        await avisarSemNovidade(p.id, etapa);
        semNovidade++;
      }
    }
    r.sem_novidade = semNovidade;

    // Lembrete de documento
    let lembretes = 0;
    if (org.dias_lembrete_pendencia > 0) {
      const limite = Date.now() - org.dias_lembrete_pendencia * DIA;
      const { data: pend } = await db
        .from("pendencias")
        .select("id, processo_id, descricao, criado_em, ultimo_lembrete, processos!inner(status)")
        .eq("org_id", org.id)
        .eq("status", "aberta")
        .eq("processos.status", "ativo");
      for (const x of pend ?? []) {
        const ultimo = new Date(x.ultimo_lembrete ?? x.criado_em).getTime();
        if (ultimo > limite) continue;
        await pedirPendencia(x.processo_id, x.descricao, true);
        await db.from("pendencias").update({ ultimo_lembrete: new Date().toISOString() }).eq("id", x.id);
        lembretes++;
      }
    }
    r.lembretes = lembretes;
    relatorio.push(r);
  }

  return NextResponse.json({ ok: true, relatorio });
}
