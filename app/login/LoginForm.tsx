"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export default function LoginForm() {
  const [estado, acao, pendente] = useActionState(entrar, null);
  return (
    <form action={acao} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="senha">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className="field" />
      </div>
      {estado?.erro ? <p className="text-sm text-bad">{estado.erro}</p> : null}
      <button className="btn btn-primary w-full" disabled={pendente}>
        {pendente ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
