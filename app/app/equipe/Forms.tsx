"use client";

import { useActionState } from "react";
import { adicionarMembro, trocarSenha } from "../configuracoes/actions";

export function NovoMembro() {
  const [estado, acao, pendente] = useActionState(adicionarMembro, null);
  return (
    <form action={acao} className="card space-y-3 p-5">
      <h2 className="font-display text-lg font-bold">Adicionar pessoa</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nome</label>
          <input name="nome" required className="field" />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input name="email" type="email" required className="field" />
        </div>
        <div>
          <label className="label">Senha inicial</label>
          <input name="senha" required minLength={8} className="field" />
        </div>
        <div>
          <label className="label">Papel</label>
          <select name="papel" className="field" defaultValue="operador">
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>
      {estado?.erro ? <p className="text-sm text-bad">{estado.erro}</p> : null}
      {estado?.ok ? <p className="text-sm text-ok">{estado.ok}</p> : null}
      <button className="btn btn-primary" disabled={pendente}>
        {pendente ? "Adicionando..." : "Adicionar"}
      </button>
    </form>
  );
}

export function TrocarSenha({ membroId }: { membroId: string }) {
  const [estado, acao, pendente] = useActionState(trocarSenha, null);
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-brand">Trocar senha</summary>
      <form action={acao} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="membro_id" value={membroId} />
        <input name="senha" minLength={8} required placeholder="Nova senha" className="field max-w-52 py-1.5 text-sm" />
        <button className="btn btn-ghost btn-sm" disabled={pendente}>
          {pendente ? "..." : "Trocar"}
        </button>
        {estado?.erro ? <span className="text-xs text-bad">{estado.erro}</span> : null}
        {estado?.ok ? <span className="text-xs text-ok">{estado.ok}</span> : null}
      </form>
    </details>
  );
}
