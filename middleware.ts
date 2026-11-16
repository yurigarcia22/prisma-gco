import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Só as rotas da equipe dependem de sessão. Links de cliente (/p) e
// corretor (/c) usam token e não passam por aqui.
export const config = {
  matcher: ["/app/:path*", "/login"],
};
