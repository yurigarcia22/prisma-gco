import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import { ConfirmarBotao, CopiarBotao, SubmitButton } from "@/components/ui";
import { telefoneBonito } from "@/lib/format";
import { linkCorretor } from "@/lib/links";
import { linkWaMe } from "@/lib/whatsapp";
import { mensagemAcessoCorretor } from "@/lib/notificacoes";
import type { Corretor } from "@/lib/types";
import { atualizarCorretor, criarCorretor, enviarAcesso, novoTokenCorretor } from "./actions";

export const metadata: Metadata = { title: "Corretores" };

export default async function Corretores() {
  const { supabase, org } = await getSessao();
  const [{ data: corretores }, { data: procs }] = await Promise.all([
    supabase.from("corretores").select("*").order("nome").returns<Corretor[]>(),
    supabase.from("processos").select("corretor_id").eq("status", "ativo"),
  ]);
  const ativosPor = new Map<string, number>();
  (procs ?? []).forEach((p) => p.corretor_id && ativosPor.set(p.corretor_id, (ativosPor.get(p.corretor_id) ?? 0) + 1));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Corretores</h1>
      <p className="text-sm text-ink-soft">
        Cada corretor tem um link próprio: vê só os processos dele e pode cadastrar processo novo.
      </p>

      <form action={criarCorretor} className="card mt-6 p-5">
        <h2 className="font-display text-lg font-bold">Novo corretor</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Nome *</label>
            <input name="nome" required className="field" />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input name="telefone" inputMode="tel" placeholder="(37) 99999-9999" className="field" />
          </div>
          <div>
            <label className="label">Imobiliária</label>
            <input name="imobiliaria" className="field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">E-mail</label>
            <input name="email" type="email" className="field" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 sm:self-end sm:pb-2">
            <input type="checkbox" name="enviar" defaultChecked /> Mandar o acesso no WhatsApp dele
          </label>
        </div>
        <div className="mt-3">
          <SubmitButton>
            <Icon name="plus" size={15} /> Cadastrar corretor
          </SubmitButton>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {(corretores ?? []).map((c) => {
          const link = linkCorretor(c.token);
          return (
            <div key={c.id} className={`card p-4 ${c.ativo ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky font-bold text-brand">
                  {c.nome.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {c.nome} {!c.ativo ? <span className="chip bg-[#eef1f3] text-ink-soft">inativo</span> : null}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {[telefoneBonito(c.telefone), c.imobiliaria, `${ativosPor.get(c.id) ?? 0} processo(s) em andamento`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopiarBotao texto={link} rotulo="Copiar acesso" />
                  {c.telefone ? (
                    <>
                      <form action={enviarAcesso}>
                        <input type="hidden" name="corretor_id" value={c.id} />
                        <SubmitButton className="btn btn-ghost btn-sm" pendente="Enviando...">
                          <Icon name="send" size={14} /> Enviar automático
                        </SubmitButton>
                      </form>
                      <a
                        href={linkWaMe(c.telefone, mensagemAcessoCorretor(c.nome, org.nome, c.token))}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-wpp btn-sm"
                      >
                        <Icon name="chat" size={14} /> Pelo meu WhatsApp
                      </a>
                    </>
                  ) : null}
                </div>
              </div>

              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand">Editar</summary>
                <form action={atualizarCorretor} className="mt-3 grid gap-3 sm:grid-cols-4">
                  <input type="hidden" name="corretor_id" value={c.id} />
                  <div className="sm:col-span-2">
                    <label className="label">Nome</label>
                    <input name="nome" defaultValue={c.nome} className="field" />
                  </div>
                  <div>
                    <label className="label">WhatsApp</label>
                    <input name="telefone" defaultValue={c.telefone ?? ""} className="field" />
                  </div>
                  <div>
                    <label className="label">Imobiliária</label>
                    <input name="imobiliaria" defaultValue={c.imobiliaria ?? ""} className="field" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">E-mail</label>
                    <input name="email" defaultValue={c.email ?? ""} className="field" />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-2">
                    <input type="checkbox" name="ativo" defaultChecked={c.ativo} /> Ativo (link funciona)
                  </label>
                  <div className="sm:self-end">
                    <SubmitButton className="btn btn-primary btn-sm w-full">Salvar</SubmitButton>
                  </div>
                </form>
                <form action={novoTokenCorretor} className="mt-3">
                  <input type="hidden" name="corretor_id" value={c.id} />
                  <ConfirmarBotao
                    mensagem="Gerar um link novo? O antigo para de funcionar na hora."
                    className="text-xs text-ink-soft underline hover:text-bad"
                  >
                    Gerar link novo (se o antigo vazou)
                  </ConfirmarBotao>
                </form>
              </details>
            </div>
          );
        })}
        {!corretores?.length ? <p className="text-sm text-ink-soft">Nenhum corretor cadastrado ainda.</p> : null}
      </div>
    </div>
  );
}
