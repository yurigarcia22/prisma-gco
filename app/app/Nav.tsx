"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import { sair } from "@/app/login/actions";

type Item = { href: string; rotulo: string; icone: string; exato?: boolean };

const ITENS: Item[] = [
  { href: "/app", rotulo: "Visão geral", icone: "grid", exato: true },
  { href: "/app/processos", rotulo: "Processos", icone: "kanban" },
  { href: "/app/clientes", rotulo: "Clientes", icone: "user" },
  { href: "/app/corretores", rotulo: "Corretores", icone: "briefcase" },
  { href: "/app/fluxos", rotulo: "Fluxos e etapas", icone: "layers" },
  { href: "/app/whatsapp", rotulo: "Mensagens", icone: "chat" },
];
const ADMIN: Item[] = [
  { href: "/app/equipe", rotulo: "Equipe", icone: "users" },
  { href: "/app/configuracoes", rotulo: "Configurações", icone: "settings" },
];

export default function Nav({ empresa, nome, admin }: { empresa: string; nome: string; admin: boolean }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const itens = admin ? [...ITENS, ...ADMIN] : ITENS;
  const ativo = (href: string, exato?: boolean) => (exato ? path === href : path === href || path.startsWith(href + "/"));

  return (
    <>
      {/* Barra do celular */}
      <header className="brand-gradient sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden">
        <Logo empresa={empresa} />
        <button className="rounded-lg p-2 text-white" onClick={() => setAberto((v) => !v)} aria-label="Menu">
          <Icon name={aberto ? "x" : "menu"} size={22} />
        </button>
      </header>

      <aside
        className={`brand-gradient fixed inset-y-0 left-0 z-40 w-64 shrink-0 text-white transition-transform lg:static lg:block lg:translate-x-0 lg:self-stretch ${
          aberto ? "block translate-x-0" : "hidden -translate-x-full lg:block"
        }`}
      >
        {/* O fundo azul acompanha a página inteira; o conteúdo fica fixo no topo */}
        <div className="flex h-dvh flex-col overflow-y-auto p-4 lg:sticky lg:top-0">
        <div className="px-2 py-2">
          <Logo empresa={empresa} />
        </div>
        <nav className="mt-6 flex-1 space-y-1">
          {itens.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setAberto(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                ativo(i.href, i.exato) ? "bg-white text-brand" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name={i.icone} size={18} />
              {i.rotulo}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-white/15 pt-4">
          <div className="px-3 text-sm font-semibold">{nome}</div>
          <div className="px-3 text-xs text-white/60">{admin ? "Administrador" : "Operador"}</div>
          <form action={sair}>
            <button className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10">
              <Icon name="logout" size={18} />
              Sair
            </button>
          </form>
        </div>
        </div>
      </aside>
      {aberto ? <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setAberto(false)} /> : null}
    </>
  );
}
