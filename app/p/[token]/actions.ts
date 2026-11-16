"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { nomeArquivoSeguro, processoPorToken } from "@/lib/portal";

export async function prepararUploadCliente(token: string, nome: string) {
  const dados = await processoPorToken(token);
  if (!dados) return { erro: "Link inválido." };
  const path = `${dados.p.org_id}/${dados.p.id}/cliente-${Date.now()}-${nomeArquivoSeguro(nome)}`;
  const { data, error } = await createAdminClient().storage.from("documentos").createSignedUploadUrl(path);
  if (error || !data) return { erro: "Não deu para preparar o envio." };
  return { path, token: data.token };
}

export async function registrarDocumentoCliente(
  token: string,
  pendenciaId: string | null,
  path: string,
  nome: string,
  tamanho: number,
) {
  const dados = await processoPorToken(token);
  if (!dados) return { erro: "Link inválido." };
  const { p, pendencias } = dados;
  if (!path.startsWith(`${p.org_id}/${p.id}/cliente-`)) return { erro: "Caminho inválido." };
  const pend = pendenciaId ? pendencias.find((x) => x.id === pendenciaId) : undefined;

  const db = createAdminClient();
  await db.from("documentos").insert({
    org_id: p.org_id,
    processo_id: p.id,
    pendencia_id: pend?.id ?? null,
    nome,
    path,
    tamanho,
    enviado_por: "cliente",
  });
  if (pend) await db.from("pendencias").update({ status: "enviada" }).eq("id", pend.id);
  await db.from("eventos").insert({
    org_id: p.org_id,
    processo_id: p.id,
    tipo: "documento",
    texto: pend ? `${pend.descricao} (${nome})` : nome,
    publico: true,
    autor: "Cliente",
  });
  revalidatePath(`/p/${token}`);
  return { ok: true };
}
