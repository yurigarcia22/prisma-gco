"use client";

import { useActionState } from "react";
import { testarWhatsapp } from "./actions";

export default function TesteWhatsapp() {
  const [estado, acao, pendente] = useActionState(testarWhatsapp, null);
  return (
    <form action={acao} className="card space-y-3 p-5">
      <h2 className="font-display text-lg font-bold">Testar envio</h2>
      <div className="flex flex-wrap gap-2">
        <input name="numero" placeholder="Seu WhatsApp" inputMode="tel" className="field max-w-xs" />
        <button className="btn btn-ghost" disabled={pendente}>
          {pendente ? "Enviando..." : "Mandar teste"}
        </button>
      </div>
      {estado?.msg ? <p className={`text-sm ${estado.ok ? "text-ok" : "text-bad"}`}>{estado.msg}</p> : null}
    </form>
  );
}
