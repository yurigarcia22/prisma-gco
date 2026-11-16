import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { ConfirmarBotao } from "@/components/ui";
import type { Membro } from "@/lib/types";
import { mudarPapel, removerMembro } from "../configuracoes/actions";
import { NovoMembro, TrocarSenha } from "./Forms";

export const metadata: Metadata = { title: "Equipe" };

export default async function Equipe() {
  const { supabase, membro } = await exigirAdmin();
  const { data: membros } = await supabase.from("membros").select("*").order("nome").returns<Membro[]>();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Equipe</h1>
        <p className="text-sm text-ink-soft">
          Quem entra no painel. Operador mexe nos processos. Administrador também configura equipe e WhatsApp.
        </p>
      </div>

      <div className="card divide-y divide-line">
        {(membros ?? []).map((m) => (
          <div key={m.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {m.nome} {m.id === membro.id ? <span className="text-xs font-normal text-ink-soft">(você)</span> : null}
                </div>
                <div className="text-xs text-ink-soft">{m.email}</div>
              </div>
              {m.id === membro.id ? (
                <span className="chip bg-sky text-brand">{m.papel === "admin" ? "Administrador" : "Operador"}</span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={mudarPapel} className="flex gap-2">
                    <input type="hidden" name="membro_id" value={m.id} />
                    <select name="papel" defaultValue={m.papel} className="field w-auto py-1.5 text-xs">
                      <option value="operador">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <button className="btn btn-ghost btn-sm">Salvar</button>
                  </form>
                  <form action={removerMembro}>
                    <input type="hidden" name="membro_id" value={m.id} />
                    <ConfirmarBotao mensagem={`Tirar ${m.nome} da equipe?`} className="btn btn-ghost btn-sm text-bad">
                      Remover
                    </ConfirmarBotao>
                  </form>
                </div>
              )}
            </div>
            <TrocarSenha membroId={m.id} />
          </div>
        ))}
      </div>

      <NovoMembro />
    </div>
  );
}
