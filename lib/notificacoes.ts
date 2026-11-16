import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEvolution, evolutionPronto, normalizarTelefone, type ConfigEvolution } from "@/lib/whatsapp";
import { linkCliente, linkCorretor } from "@/lib/links";
import { primeiroNome } from "@/lib/format";
import type { Etapa } from "@/lib/types";

type Vars = Record<string, string | number | null | undefined>;

/** Troca {chave} pelos valores. Chave sem valor some. */
export function renderMensagem(modelo: string, vars: Vars) {
  return modelo
    .replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === null || vars[k] === undefined ? "" : String(vars[k])))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const MODELO_ETAPA_PADRAO =
  "Oi, {nome}! O seu processo de financiamento avançou para a etapa *{etapa}*.\n\n{descricao}\n\nAcompanhe tudo por aqui: {link}";

export const MODELO_BOAS_VINDAS_PADRAO =
  "Oi, {nome}! Aqui é da {empresa}. O seu processo de financiamento já está com a gente. Por este link você acompanha cada etapa: {link}";

const MODELO_CORRETOR =
  "Atualização do processo #{numero} ({cliente}): agora está em *{etapa}*.\n\nVer seus processos: {link}";

export interface NovaNotificacao {
  org_id: string;
  processo_id: string | null;
  destino: "cliente" | "corretor" | "equipe";
  motivo: string;
  telefone: string;
  mensagem: string;
}

/** Grava na fila e tenta mandar na hora. Retorna os ids criados. */
export async function notificar(lista: NovaNotificacao[]) {
  const validas = lista
    .map((n) => ({ ...n, telefone: normalizarTelefone(n.telefone) ?? "" }))
    .filter((n) => !!n.telefone && !!n.mensagem);
  if (validas.length === 0) return [];

  const db = createAdminClient();
  const { data, error } = await db.from("notificacoes").insert(validas).select("id");
  if (error || !data) {
    console.error("Erro ao enfileirar notificações:", error);
    return [];
  }
  const ids = data.map((d) => d.id as string);
  await dispararPendentes(validas[0].org_id, ids);
  return ids;
}

/**
 * Manda as notificações pendentes da organização (ou só os ids informados).
 * Sem Evolution configurado, marca como "manual" para a equipe enviar pelo botão.
 */
export async function dispararPendentes(orgId: string, ids?: string[]) {
  const db = createAdminClient();
  const { data: cfg } = await db
    .from("org_whatsapp")
    .select("evolution_url, evolution_key, instancia, ativo")
    .eq("org_id", orgId)
    .maybeSingle<ConfigEvolution>();

  let q = db
    .from("notificacoes")
    .select("id, telefone, mensagem, tentativas")
    .eq("org_id", orgId)
    .in("status", ["pendente", "falhou"])
    .lt("tentativas", 3)
    .order("criado_em");
  if (ids?.length) q = q.in("id", ids);
  const { data: fila } = await q.limit(50);
  if (!fila?.length) return { enviadas: 0, falhas: 0, manuais: 0 };

  if (!evolutionPronto(cfg)) {
    await db
      .from("notificacoes")
      .update({ status: "manual", erro: "WhatsApp automático não configurado" })
      .in(
        "id",
        fila.map((f) => f.id),
      );
    return { enviadas: 0, falhas: 0, manuais: fila.length };
  }

  let enviadas = 0;
  let falhas = 0;
  for (const n of fila) {
    const r = await enviarEvolution(cfg, n.telefone, n.mensagem);
    if (r.ok) enviadas++;
    else falhas++;
    await db
      .from("notificacoes")
      .update(
        r.ok
          ? { status: "enviada", enviada_em: new Date().toISOString(), erro: null, tentativas: n.tentativas + 1 }
          : { status: "falhou", erro: r.erro, tentativas: n.tentativas + 1 },
      )
      .eq("id", n.id);
    // Intervalo curto entre mensagens para não parecer disparo em massa
    if (fila.length > 1) await new Promise((res) => setTimeout(res, 1200));
  }
  return { enviadas, falhas, manuais: 0 };
}

interface ProcessoComRelacoes {
  id: string;
  org_id: string;
  numero: number;
  token_cliente: string;
  clientes: { nome: string; telefone: string | null } | null;
  corretores: { nome: string; telefone: string | null; token: string; ativo: boolean } | null;
  organizacoes: { nome: string; msg_boas_vindas: string | null } | null;
}

async function carregarProcesso(processoId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("processos")
    .select(
      "id, org_id, numero, token_cliente, clientes(nome, telefone), corretores(nome, telefone, token, ativo), organizacoes(nome, msg_boas_vindas)",
    )
    .eq("id", processoId)
    .single();
  return data as unknown as ProcessoComRelacoes | null;
}

async function marcarAvisoCliente(processoId: string) {
  await createAdminClient()
    .from("processos")
    .update({ ultimo_aviso_cliente: new Date().toISOString() })
    .eq("id", processoId);
}

/** Mudou de etapa: avisa cliente (se a etapa pede) e corretor. */
export async function avisarMudancaEtapa(processoId: string, etapa: Etapa, avisarCliente: boolean) {
  const p = await carregarProcesso(processoId);
  if (!p) return;
  const nomeEtapa = etapa.nome_cliente || etapa.nome;
  const lista: NovaNotificacao[] = [];

  if (avisarCliente && etapa.notificar && etapa.visivel_cliente && p.clientes?.telefone) {
    lista.push({
      org_id: p.org_id,
      processo_id: p.id,
      destino: "cliente",
      motivo: "etapa",
      telefone: p.clientes.telefone,
      mensagem: renderMensagem(etapa.mensagem || MODELO_ETAPA_PADRAO, {
        nome: primeiroNome(p.clientes.nome),
        etapa: nomeEtapa,
        descricao: etapa.descricao_cliente,
        prazo: etapa.prazo_dias ? `${etapa.prazo_dias} dias` : null,
        empresa: p.organizacoes?.nome,
        link: linkCliente(p.token_cliente),
      }),
    });
  }

  if (p.corretores?.ativo && p.corretores.telefone) {
    lista.push({
      org_id: p.org_id,
      processo_id: p.id,
      destino: "corretor",
      motivo: "etapa",
      telefone: p.corretores.telefone,
      mensagem: renderMensagem(MODELO_CORRETOR, {
        numero: p.numero,
        cliente: p.clientes?.nome,
        etapa: etapa.nome,
        link: linkCorretor(p.corretores.token),
      }),
    });
  }

  await notificar(lista);
  if (lista.some((n) => n.destino === "cliente")) await marcarAvisoCliente(p.id);
}

/** Processo novo: manda a boas-vindas com o link para o cliente. */
export async function enviarBoasVindas(processoId: string) {
  const p = await carregarProcesso(processoId);
  if (!p?.clientes?.telefone) return;
  await notificar([
    {
      org_id: p.org_id,
      processo_id: p.id,
      destino: "cliente",
      motivo: "boas_vindas",
      telefone: p.clientes.telefone,
      mensagem: renderMensagem(p.organizacoes?.msg_boas_vindas || MODELO_BOAS_VINDAS_PADRAO, {
        nome: primeiroNome(p.clientes.nome),
        empresa: p.organizacoes?.nome,
        link: linkCliente(p.token_cliente),
      }),
    },
  ]);
  await marcarAvisoCliente(p.id);
}

/** Recado público para o cliente (também vai pro WhatsApp). */
export async function enviarRecado(processoId: string, recado: string) {
  const p = await carregarProcesso(processoId);
  if (!p?.clientes?.telefone) return;
  await notificar([
    {
      org_id: p.org_id,
      processo_id: p.id,
      destino: "cliente",
      motivo: "recado",
      telefone: p.clientes.telefone,
      mensagem: `Oi, ${primeiroNome(p.clientes.nome)}! Recado da ${p.organizacoes?.nome ?? "equipe"} sobre o seu financiamento:\n\n${recado}\n\nAcompanhe por aqui: ${linkCliente(p.token_cliente)}`,
    },
  ]);
  await marcarAvisoCliente(p.id);
}

/** Pendência nova: pede o documento ao cliente. */
export async function pedirPendencia(processoId: string, descricao: string, lembrete = false) {
  const p = await carregarProcesso(processoId);
  if (!p?.clientes?.telefone) return;
  const nome = primeiroNome(p.clientes.nome);
  const link = linkCliente(p.token_cliente);
  await notificar([
    {
      org_id: p.org_id,
      processo_id: p.id,
      destino: "cliente",
      motivo: lembrete ? "lembrete_pendencia" : "pendencia",
      telefone: p.clientes.telefone,
      mensagem: lembrete
        ? `Oi, ${nome}! Passando para lembrar que ainda precisamos de: *${descricao}*. Assim que chegar, o seu financiamento segue. Dá para enviar por aqui: ${link}`
        : `Oi, ${nome}! Para o seu financiamento seguir, precisamos de: *${descricao}*.\n\nVocê pode enviar direto por este link: ${link}`,
    },
  ]);
}

/** Aviso tranquilo de quando o processo está parado sem novidade. */
export async function avisarSemNovidade(processoId: string, etapa: Etapa) {
  const p = await carregarProcesso(processoId);
  if (!p?.clientes?.telefone) return;
  const prazo = etapa.prazo_dias ? ` Essa etapa costuma levar uns ${etapa.prazo_dias} dias.` : "";
  await notificar([
    {
      org_id: p.org_id,
      processo_id: p.id,
      destino: "cliente",
      motivo: "sem_novidade",
      telefone: p.clientes.telefone,
      mensagem: `Oi, ${primeiroNome(p.clientes.nome)}! Passando para te deixar tranquilo: o seu processo segue na etapa *${etapa.nome_cliente || etapa.nome}*.${prazo} Assim que andar, avisamos por aqui.\n\n${linkCliente(p.token_cliente)}`,
    },
  ]);
  await marcarAvisoCliente(p.id);
}

/** Acesso do corretor ao portal. */
export async function enviarAcessoCorretor(corretorId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("corretores")
    .select("org_id, nome, telefone, token, organizacoes(nome)")
    .eq("id", corretorId)
    .single();
  const c = data as unknown as {
    org_id: string;
    nome: string;
    telefone: string | null;
    token: string;
    organizacoes: { nome: string } | null;
  } | null;
  if (!c?.telefone) return [];
  return notificar([
    {
      org_id: c.org_id,
      processo_id: null,
      destino: "corretor",
      motivo: "acesso",
      telefone: c.telefone,
      mensagem: mensagemAcessoCorretor(c.nome, c.organizacoes?.nome ?? "equipe", c.token),
    },
  ]);
}

export function mensagemAcessoCorretor(nome: string, empresa: string, token: string) {
  return `Oi, ${primeiroNome(nome)}! Este é o seu acesso ao Prisma da ${empresa}. Por ele você acompanha os processos dos seus clientes e cadastra processo novo:\n\n${linkCorretor(token)}\n\nGuarde este link, ele é só seu.`;
}
