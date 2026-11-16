"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/sessao";
import { createAdminClient } from "@/lib/supabase/admin";
import { texto } from "@/lib/format";
import { enviarEvolution, normalizarTelefone } from "@/lib/whatsapp";

export async function salvarOrganizacao(fd: FormData) {
  const { supabase, org } = await exigirAdmin();
  const dias = parseInt(String(fd.get("dias_sem_novidade")), 10);
  const lembrete = parseInt(String(fd.get("dias_lembrete_pendencia")), 10);
  await supabase
    .from("organizacoes")
    .update({
      nome: texto(fd.get("nome")) ?? org.nome,
      whatsapp_contato: normalizarTelefone(texto(fd.get("whatsapp_contato"))) ?? texto(fd.get("whatsapp_contato")),
      dias_sem_novidade: Number.isFinite(dias) && dias >= 0 ? dias : 5,
      dias_lembrete_pendencia: Number.isFinite(lembrete) && lembrete >= 0 ? lembrete : 2,
      msg_boas_vindas: texto(fd.get("msg_boas_vindas")),
    })
    .eq("id", org.id);
  revalidatePath("/app", "layout");
}

export async function salvarWhatsapp(fd: FormData) {
  const { supabase, org } = await exigirAdmin();
  const chave = texto(fd.get("evolution_key"));
  await supabase.from("org_whatsapp").upsert({
    org_id: org.id,
    evolution_url: texto(fd.get("evolution_url")),
    instancia: texto(fd.get("instancia")),
    ...(chave ? { evolution_key: chave } : {}),
    ativo: fd.get("ativo") === "on",
    atualizado_em: new Date().toISOString(),
  });
  revalidatePath("/app/configuracoes");
}

export async function testarWhatsapp(_prev: unknown, fd: FormData) {
  const { supabase, org } = await exigirAdmin();
  const numero = texto(fd.get("numero"));
  if (!numero) return { msg: "Informe um número.", ok: false };
  const { data: cfg } = await supabase.from("org_whatsapp").select("*").eq("org_id", org.id).maybeSingle();
  if (!cfg?.evolution_url || !cfg.evolution_key || !cfg.instancia) {
    return { msg: "Preencha e salve a URL, a chave e a instância antes.", ok: false };
  }
  const r = await enviarEvolution(
    { ...cfg, ativo: true },
    numero,
    `Teste do Prisma da ${org.nome}: se você recebeu, o WhatsApp automático está funcionando.`,
  );
  return r.ok ? { msg: "Mensagem enviada. Confira o WhatsApp.", ok: true } : { msg: r.erro, ok: false };
}

// ---------------------------------------------------------------- equipe

export async function adicionarMembro(_prev: unknown, fd: FormData) {
  const { org } = await exigirAdmin();
  const nome = texto(fd.get("nome"));
  const email = texto(fd.get("email"))?.toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  const papel = fd.get("papel") === "admin" ? "admin" : "operador";
  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };

  const db = createAdminClient();
  const { data: criado, error } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  let userId = criado?.user?.id;
  if (error) {
    // Já existe no Auth: só liga à equipe
    const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 });
    userId = lista?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return { erro: `Não deu para criar o usuário: ${error.message}` };
  }
  const { error: e2 } = await db.from("membros").insert({ org_id: org.id, user_id: userId, nome, email, papel });
  if (e2) return { erro: e2.code === "23505" ? "Essa pessoa já está na equipe." : e2.message };
  revalidatePath("/app/equipe");
  return { ok: `${nome} foi adicionado. Envie o e-mail e a senha para a pessoa entrar.` };
}

export async function mudarPapel(fd: FormData) {
  const { supabase, membro } = await exigirAdmin();
  const id = String(fd.get("membro_id"));
  if (id === membro.id) return;
  await supabase
    .from("membros")
    .update({ papel: fd.get("papel") === "admin" ? "admin" : "operador" })
    .eq("id", id);
  revalidatePath("/app/equipe");
}

export async function removerMembro(fd: FormData) {
  const { supabase, membro } = await exigirAdmin();
  const id = String(fd.get("membro_id"));
  if (id === membro.id) return;
  await supabase.from("membros").delete().eq("id", id);
  revalidatePath("/app/equipe");
}

export async function trocarSenha(_prev: unknown, fd: FormData) {
  const { org } = await exigirAdmin();
  const id = String(fd.get("membro_id"));
  const senha = String(fd.get("senha") ?? "");
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  const db = createAdminClient();
  const { data: m } = await db.from("membros").select("user_id").eq("id", id).eq("org_id", org.id).single();
  if (!m) return { erro: "Membro não encontrado." };
  const { error } = await db.auth.admin.updateUserById(m.user_id, { password: senha });
  return error ? { erro: error.message } : { ok: "Senha trocada." };
}
