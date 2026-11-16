"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/sessao";
import { texto } from "@/lib/format";
import type { Etapa } from "@/lib/types";

function numero(v: FormDataEntryValue | null) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function criarFluxo(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const nome = texto(fd.get("nome"));
  if (!nome) return;
  const { data: f } = await supabase
    .from("fluxos")
    .insert({ org_id: membro.org_id, nome, descricao: texto(fd.get("descricao")) })
    .select("id")
    .single();
  if (!f) return;

  const copiarDe = texto(fd.get("copiar_de"));
  if (copiarDe) {
    const { data: base } = await supabase.from("etapas").select("*").eq("fluxo_id", copiarDe).order("ordem").returns<Etapa[]>();
    if (base?.length) {
      await supabase.from("etapas").insert(
        base.map((e) => ({
          org_id: membro.org_id,
          fluxo_id: f.id,
          ordem: e.ordem,
          nome: e.nome,
          nome_cliente: e.nome_cliente,
          descricao_cliente: e.descricao_cliente,
          prazo_dias: e.prazo_dias,
          visivel_cliente: e.visivel_cliente,
          notificar: e.notificar,
          mensagem: e.mensagem,
          final: e.final,
        })),
      );
    }
  }
  redirect(`/app/fluxos/${f.id}`);
}

export async function atualizarFluxo(fd: FormData) {
  const { supabase } = await getSessao();
  const id = String(fd.get("fluxo_id"));
  await supabase
    .from("fluxos")
    .update({ nome: texto(fd.get("nome")) ?? "Sem nome", descricao: texto(fd.get("descricao")), ativo: fd.get("ativo") === "on" })
    .eq("id", id);
  revalidatePath(`/app/fluxos/${id}`);
  revalidatePath("/app/fluxos");
}

export async function excluirFluxo(fd: FormData) {
  const { supabase } = await getSessao();
  const id = String(fd.get("fluxo_id"));
  const { count } = await supabase.from("processos").select("id", { count: "exact", head: true }).eq("fluxo_id", id);
  if (count) redirect(`/app/fluxos/${id}?erro=tem-processos`);
  await supabase.from("fluxos").delete().eq("id", id);
  redirect("/app/fluxos");
}

export async function criarEtapa(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const fluxo = String(fd.get("fluxo_id"));
  const nome = texto(fd.get("nome"));
  if (!nome) return;
  const { data: ult } = await supabase
    .from("etapas")
    .select("ordem")
    .eq("fluxo_id", fluxo)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("etapas").insert({
    org_id: membro.org_id,
    fluxo_id: fluxo,
    ordem: (ult?.ordem ?? 0) + 1,
    nome,
    prazo_dias: numero(fd.get("prazo_dias")),
  });
  revalidatePath(`/app/fluxos/${fluxo}`);
}

export async function atualizarEtapa(fd: FormData) {
  const { supabase } = await getSessao();
  const fluxo = String(fd.get("fluxo_id"));
  await supabase
    .from("etapas")
    .update({
      nome: texto(fd.get("nome")) ?? "Etapa",
      nome_cliente: texto(fd.get("nome_cliente")),
      descricao_cliente: texto(fd.get("descricao_cliente")),
      prazo_dias: numero(fd.get("prazo_dias")),
      visivel_cliente: fd.get("visivel_cliente") === "on",
      notificar: fd.get("notificar") === "on",
      mensagem: texto(fd.get("mensagem")),
      final: fd.get("final") === "on",
    })
    .eq("id", String(fd.get("etapa_id")));
  revalidatePath(`/app/fluxos/${fluxo}`);
}

export async function moverOrdemEtapa(fd: FormData) {
  const { supabase } = await getSessao();
  const fluxo = String(fd.get("fluxo_id"));
  const id = String(fd.get("etapa_id"));
  const direcao = fd.get("direcao") === "cima" ? -1 : 1;
  const { data: etapas } = await supabase.from("etapas").select("id, ordem").eq("fluxo_id", fluxo).order("ordem");
  if (!etapas) return;
  const i = etapas.findIndex((e) => e.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= etapas.length) return;
  [etapas[i], etapas[j]] = [etapas[j], etapas[i]];
  // Renumera tudo em sequência (1, 2, 3...)
  await Promise.all(etapas.map((e, k) => supabase.from("etapas").update({ ordem: k + 1 }).eq("id", e.id)));
  revalidatePath(`/app/fluxos/${fluxo}`);
}

export async function excluirEtapa(fd: FormData) {
  const { supabase } = await getSessao();
  const fluxo = String(fd.get("fluxo_id"));
  const id = String(fd.get("etapa_id"));
  const { count } = await supabase.from("processos").select("id", { count: "exact", head: true }).eq("etapa_id", id);
  if (count) redirect(`/app/fluxos/${fluxo}?erro=etapa-com-processos`);
  await supabase.from("etapas").delete().eq("id", id);
  const { data: etapas } = await supabase.from("etapas").select("id").eq("fluxo_id", fluxo).order("ordem");
  await Promise.all((etapas ?? []).map((e, k) => supabase.from("etapas").update({ ordem: k + 1 }).eq("id", e.id)));
  revalidatePath(`/app/fluxos/${fluxo}`);
}
