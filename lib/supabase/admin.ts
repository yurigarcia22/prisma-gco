import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave secreta: ignora a RLS.
 * Só usar no servidor, e sempre filtrando por token ou org_id já validados.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
