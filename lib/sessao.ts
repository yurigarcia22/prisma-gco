import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Membro, Organizacao } from "@/lib/types";

/**
 * Usuário logado + membro + organização. Redireciona pro login se faltar algo.
 * getClaims valida o token localmente (chave ES256 publicada pelo Supabase),
 * sem ida ao servidor de Auth em cada clique.
 */
export const getSessao = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("membros")
    .select("*, organizacoes(*)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<Membro & { organizacoes: Organizacao }>();
  if (!data?.organizacoes) redirect("/login?erro=sem-acesso");

  const { organizacoes: org, ...membro } = data;
  return { supabase, userId, membro: membro as Membro, org };
});

export async function exigirAdmin() {
  const s = await getSessao();
  if (s.membro.papel !== "admin") redirect("/app");
  return s;
}
