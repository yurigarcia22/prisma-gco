import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Abre um documento: confere pela RLS que é da equipe e manda pro link assinado (5 min). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documentos").select("path, nome").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Documento não encontrado", { status: 404 });

  const { data } = await createAdminClient().storage.from("documentos").createSignedUrl(doc.path, 300);
  if (!data?.signedUrl) return new NextResponse("Não deu para abrir o documento", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
