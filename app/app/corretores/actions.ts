"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSessao } from "@/lib/sessao";
import { texto } from "@/lib/format";
import { normalizarTelefone } from "@/lib/whatsapp";
import { enviarAcessoCorretor } from "@/lib/notificacoes";

export async function criarCorretor(fd: FormData) {
  const { supabase, membro } = await getSessao();
  const nome = texto(fd.get("nome"));
  if (!nome) return;
  const telefone = texto(fd.get("telefone"));
  const { data } = await supabase
    .from("corretores")
    .insert({
      org_id: membro.org_id,
      nome,
      telefone: normalizarTelefone(telefone) ?? telefone,
      email: texto(fd.get("email")),
      imobiliaria: texto(fd.get("imobiliaria")),
    })
    .select("id")
    .single();
  if (data && fd.get("enviar") === "on") after(() => enviarAcessoCorretor(data.id));
  revalidatePath("/app/corretores");
}

export async function atualizarCorretor(fd: FormData) {
  const { supabase } = await getSessao();
  const telefone = texto(fd.get("telefone"));
  await supabase
    .from("corretores")
    .update({
      nome: texto(fd.get("nome")) ?? "Corretor",
      telefone: normalizarTelefone(telefone) ?? telefone,
      email: texto(fd.get("email")),
      imobiliaria: texto(fd.get("imobiliaria")),
      ativo: fd.get("ativo") === "on",
    })
    .eq("id", String(fd.get("corretor_id")));
  revalidatePath("/app/corretores");
}

export async function enviarAcesso(fd: FormData) {
  await getSessao();
  await enviarAcessoCorretor(String(fd.get("corretor_id")));
  revalidatePath("/app/corretores");
}

export async function novoTokenCorretor(fd: FormData) {
  const { supabase } = await getSessao();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  await supabase.from("corretores").update({ token }).eq("id", String(fd.get("corretor_id")));
  revalidatePath("/app/corretores");
}
