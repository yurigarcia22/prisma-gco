"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Icon from "@/components/Icon";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendente = "Salvando...",
}: {
  children: React.ReactNode;
  className?: string;
  pendente?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendente : children}
    </button>
  );
}

export function CopiarBotao({
  texto,
  rotulo = "Copiar link",
  className = "btn btn-ghost btn-sm",
}: {
  texto: string;
  rotulo?: string;
  className?: string;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
        } catch {
          const t = document.createElement("textarea");
          t.value = texto;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1800);
      }}
    >
      <Icon name={ok ? "check" : "copy"} size={15} />
      {ok ? "Copiado" : rotulo}
    </button>
  );
}

/** Botão que pede confirmação antes de enviar o form. */
export function ConfirmarBotao({
  children,
  mensagem,
  className = "btn btn-ghost btn-sm",
}: {
  children: React.ReactNode;
  mensagem: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(mensagem)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
