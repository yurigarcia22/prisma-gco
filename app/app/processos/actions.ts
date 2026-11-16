"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/sessao";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarProcesso, moverEtapa } from "@/lib/processos";
import { dispararPendentes, enviarBoasVindas, enviarRecado, pedirPendencia } from "@/lib/notificacoes";
import { lerValor, texto } from "@/lib/format";

function caminhoProcesso(id: string) {
  return `/app/processos/${id}`;
}

export async function novoProcesso(_prev: unknown, fd: FormData) {
  const { supabase, membro } = await getSessao();
  const nome = texto(fd.get("cliente_nome"));
  const telefone = texto(fd.get("cliente_telefone"));
  const fluxo = texto(fd.get("fluxo_id"));
  if (!nome) return { erro: "Informe o nome do cliente." };
  if (!fluxo) return { erro: "Escolha o fluxo." };

  let id: string;
  try {
    const p = await criarProcesso(supabase, {
      org_id: membro.org_id,
      fluxo_id: fluxo,
      corretor_id: texto(fd.get("corretor_id")),
      cliente: {
        nome,
        cpf: texto(fd.get("cliente_cpf")),
        telefone,
        email: texto(fd.get("cliente_email")),
      },
      modalidade: texto(fd.get("modalidade")),
      imovel: texto(fd.get("imovel")),
      valor_imovel: lerValor(fd.get("valor_imovel")),
      valor_financiado: lerValor(fd.get("valor_financiado")),
      observacoes: texto(fd.get("observacoes")),
      autor: membro.nome,
      enviar_boas_vindas: fd.get("boas_vindas") === "on" && !!telefone,
    });
    id = p.id;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar o processo." };
  }
  revalidatePath("/app/processos");
  redirect(caminhoProcesso(id));
}

/** Usado pelo kanban (arrastar card). */
export async function moverEtapaKanban(processoId: string, etapaId: string) {
  const { supabase, membro } = await getSessao();
  try {
    await moverEtapa(supabase, {
      processo_id: processoId,
      etapa_id: etapaId,
      autor: membro.nome,
      avisar_cliente: true,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao mover." };
  }
  revalidatePath("/app/processos");
  revalidatePath("/app");
  return { ok: true };
}

/** Usado pela ficha do processo (botão Avançar / Mover). */
export async function moverEtapaRapido(processoId: string, etapaId: string, avisar: boolean) {
  const { supabase, membro } = await getSessao();
  try {
    await moverEtapa(supabase, {
      processo_id: processoId,
      etapa_id: etapaId,
      autor: membro.nome,
      avisar_cliente: avisar,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao mover." };
  }
  revalidatePath(caminhoProcesso(processoId));
  return { ok: true };
}

export async function adicionarAtualizacao(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const id = String(fd.get("processo_id"));
  const msg = texto(fd.get("texto"));
  const tipo = fd.get("tipo") === "recado" ? "recado" : "nota";
  if (!msg) return;
  await supabase.from("eventos").insert({
    org_id: membro.org_id,
    processo_id: id,
    tipo,
    texto: msg,
    publico: tipo === "recado",
    autor: membro.nome,
  });
  if (tipo === "recado" && fd.get("whatsapp") === "on") after(() => enviarRecado(id, msg));
  revalidatePath(caminhoProcesso(id));
}

export async function excluirEvento(fd: FormData) {
  const { supabase } = await getSessao();
  const id = String(fd.get("processo_id"));
  await supabase
    .from("eventos")
    .delete()
    .eq("id", String(fd.get("evento_id")))
    .in("tipo", ["nota", "recado"]);
  revalidatePath(caminhoProcesso(id));
}

export async function atualizarProcesso(fd: FormData) {
  const { supabase } = await getSessao();
  const id = String(fd.get("processo_id"));
  await supabase
    .from("processos")
    .update({
      corretor_id: texto(fd.get("corretor_id")),
      modalidade: texto(fd.get("modalidade")),
      imovel: texto(fd.get("imovel")),
      valor_imovel: lerValor(fd.get("valor_imovel")),
      valor_financiado: lerValor(fd.get("valor_financiado")),
      observacoes: texto(fd.get("observacoes")),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  const clienteId = texto(fd.get("cliente_id"));
  if (clienteId) {
    await supabase
      .from("clientes")
      .update({
        nome: texto(fd.get("cliente_nome")) ?? undefined,
        cpf: texto(fd.get("cliente_cpf"))?.replace(/\D/g, "") ?? null,
        telefone: texto(fd.get("cliente_telefone")),
        email: texto(fd.get("cliente_email")),
      })
      .eq("id", clienteId);
  }
  revalidatePath(caminhoProcesso(id));
}

export async function mudarStatus(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const id = String(fd.get("processo_id"));
  const status = String(fd.get("status"));
  if (!["ativo", "cancelado", "concluido"].includes(status)) return;
  await supabase.from("processos").update({ status, atualizado_em: new Date().toISOString() }).eq("id", id);
  await supabase.from("eventos").insert({
    org_id: membro.org_id,
    processo_id: id,
    tipo: "status",
    texto: status === "cancelado" ? "Processo cancelado" : status === "ativo" ? "Processo reaberto" : "Processo concluído",
    publico: false,
    autor: membro.nome,
  });
  revalidatePath(caminhoProcesso(id));
  revalidatePath("/app/processos");
}

export async function excluirProcesso(fd: FormData) {
  const { supabase, membro } = await getSessao();
  if (membro.papel !== "admin") return;
  const id = String(fd.get("processo_id"));
  const db = createAdminClient();
  const { data: docs } = await db.from("documentos").select("path").eq("processo_id", id).eq("org_id", membro.org_id);
  if (docs?.length) await db.storage.from("documentos").remove(docs.map((d) => d.path));
  await supabase.from("processos").delete().eq("id", id);
  revalidatePath("/app/processos");
  redirect("/app/processos");
}

export async function novoLinkCliente(fd: FormData) {
  const { supabase } = await getSessao();
  const id = String(fd.get("processo_id"));
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  await supabase.from("processos").update({ token_cliente: token }).eq("id", id);
  revalidatePath(caminhoProcesso(id));
}

export async function reenviarBoasVindas(fd: FormData) {
  await getSessao();
  const id = String(fd.get("processo_id"));
  await enviarBoasVindas(id);
  revalidatePath(caminhoProcesso(id));
}

// ---------------------------------------------------------------- pendências

export async function criarPendencia(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const id = String(fd.get("processo_id"));
  const descricao = texto(fd.get("descricao"));
  if (!descricao) return;
  await supabase.from("pendencias").insert({ org_id: membro.org_id, processo_id: id, descricao });
  await supabase.from("eventos").insert({
    org_id: membro.org_id,
    processo_id: id,
    tipo: "pendencia",
    texto: descricao,
    publico: true,
    autor: membro.nome,
  });
  if (fd.get("whatsapp") === "on") after(() => pedirPendencia(id, descricao));
  revalidatePath(caminhoProcesso(id));
}

export async function resolverPendencia(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const id = String(fd.get("processo_id"));
  const pid = String(fd.get("pendencia_id"));
  const { data: p } = await supabase
    .from("pendencias")
    .update({ status: "resolvida", resolvido_em: new Date().toISOString() })
    .eq("id", pid)
    .select("descricao")
    .single();
  if (p) {
    await supabase.from("eventos").insert({
      org_id: membro.org_id,
      processo_id: id,
      tipo: "pendencia_resolvida",
      texto: p.descricao,
      publico: true,
      autor: membro.nome,
    });
  }
  revalidatePath(caminhoProcesso(id));
}

export async function excluirPendencia(fd: FormData) {
  const { supabase } = await getSessao();
  const id = String(fd.get("processo_id"));
  await supabase.from("pendencias").delete().eq("id", String(fd.get("pendencia_id")));
  revalidatePath(caminhoProcesso(id));
}

// ---------------------------------------------------------------- documentos

/** Gera um link assinado para o navegador subir o arquivo direto no Storage. */
export async function prepararUploadEquipe(processoId: string, nomeArquivo: string) {
  const { supabase, membro } = await getSessao();
  const { data: p } = await supabase.from("processos").select("id").eq("id", processoId).single();
  if (!p) return { erro: "Processo não encontrado." };
  const limpo = nomeArquivo.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${membro.org_id}/${processoId}/${Date.now()}-${limpo}`;
  const { data, error } = await createAdminClient().storage.from("documentos").createSignedUploadUrl(path);
  if (error || !data) return { erro: "Não deu para preparar o envio." };
  return { path, token: data.token };
}

export async function registrarDocumentoEquipe(processoId: string, path: string, nome: string, tamanho: number) {
  const { supabase, membro } = await getSessao();
  if (!path.startsWith(`${membro.org_id}/${processoId}/`)) return { erro: "Caminho inválido." };
  await supabase.from("documentos").insert({
    org_id: membro.org_id,
    processo_id: processoId,
    nome,
    path,
    tamanho,
    enviado_por: "equipe",
  });
  revalidatePath(caminhoProcesso(processoId));
  return { ok: true };
}

export async function excluirDocumento(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const id = String(fd.get("processo_id"));
  const { data: d } = await supabase
    .from("documentos")
    .delete()
    .eq("id", String(fd.get("documento_id")))
    .eq("org_id", membro.org_id)
    .select("path")
    .single();
  if (d) await createAdminClient().storage.from("documentos").remove([d.path]);
  revalidatePath(caminhoProcesso(id));
}

// ---------------------------------------------------------------- notificações

export async function reenviarNotificacao(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const nid = String(fd.get("notificacao_id"));
  await supabase.from("notificacoes").update({ status: "pendente", tentativas: 0, erro: null }).eq("id", nid);
  await dispararPendentes(membro.org_id, [nid]);
  const volta = texto(fd.get("voltar"));
  if (volta) revalidatePath(volta);
  revalidatePath("/app/whatsapp");
}

export async function marcarEnviadaManual(fd: FormData) {
  const { supabase } = await getSessao();
  const nid = String(fd.get("notificacao_id"));
  await supabase
    .from("notificacoes")
    .update({ status: "enviada", enviada_em: new Date().toISOString(), erro: "Enviada à mão" })
    .eq("id", nid);
  const volta = texto(fd.get("voltar"));
  if (volta) revalidatePath(volta);
  revalidatePath("/app/whatsapp");
}
