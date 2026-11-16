"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { corretorPorToken, nomeArquivoSeguro } from "@/lib/portal";
import { criarProcesso } from "@/lib/processos";
import { lerValor, texto } from "@/lib/format";

export async function novoProcessoCorretor(token: string, _prev: unknown, fd: FormData) {
  const c = await corretorPorToken(token);
  if (!c) return { erro: "Link inválido." };
  const nome = texto(fd.get("cliente_nome"));
  const telefone = texto(fd.get("cliente_telefone"));
  const fluxo = texto(fd.get("fluxo_id"));
  if (!nome || !telefone) return { erro: "Informe nome e WhatsApp do cliente." };
  if (!fluxo) return { erro: "Escolha o fluxo." };

  let id: string;
  try {
    const p = await criarProcesso(createAdminClient(), {
      org_id: c.org_id,
      fluxo_id: fluxo,
      corretor_id: c.id,
      cliente: { nome, telefone, cpf: texto(fd.get("cliente_cpf")), email: texto(fd.get("cliente_email")) },
      modalidade: texto(fd.get("modalidade")),
      imovel: texto(fd.get("imovel")),
      valor_imovel: lerValor(fd.get("valor_imovel")),
      valor_financiado: lerValor(fd.get("valor_financiado")),
      observacoes: texto(fd.get("observacoes")),
      autor: `${c.nome} (corretor)`,
      enviar_boas_vindas: fd.get("boas_vindas") === "on",
    });
    id = p.id;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar o processo." };
  }
  redirect(`/c/${token}/p/${id}?novo=1`);
}

async function processoDoCorretor(token: string, processoId: string) {
  const c = await corretorPorToken(token);
  if (!c) return null;
  const { data } = await createAdminClient()
    .from("processos")
    .select("id, org_id")
    .eq("id", processoId)
    .eq("corretor_id", c.id)
    .maybeSingle();
  return data ? { c, p: data } : null;
}

export async function prepararUploadCorretor(token: string, processoId: string, nome: string) {
  const r = await processoDoCorretor(token, processoId);
  if (!r) return { erro: "Sem acesso." };
  const path = `${r.p.org_id}/${r.p.id}/corretor-${Date.now()}-${nomeArquivoSeguro(nome)}`;
  const { data, error } = await createAdminClient().storage.from("documentos").createSignedUploadUrl(path);
  if (error || !data) return { erro: "Não deu para preparar o envio." };
  return { path, token: data.token };
}

export async function registrarDocumentoCorretor(token: string, processoId: string, path: string, nome: string, tamanho: number) {
  const r = await processoDoCorretor(token, processoId);
  if (!r) return { erro: "Sem acesso." };
  if (!path.startsWith(`${r.p.org_id}/${r.p.id}/corretor-`)) return { erro: "Caminho inválido." };
  const db = createAdminClient();
  await db.from("documentos").insert({
    org_id: r.p.org_id,
    processo_id: r.p.id,
    nome,
    path,
    tamanho,
    enviado_por: "corretor",
  });
  await db.from("eventos").insert({
    org_id: r.p.org_id,
    processo_id: r.p.id,
    tipo: "documento",
    texto: nome,
    publico: false,
    autor: `${r.c.nome} (corretor)`,
  });
  revalidatePath(`/c/${token}/p/${processoId}`);
  return { ok: true };
}
