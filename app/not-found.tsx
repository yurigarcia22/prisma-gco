import { PrismaMark } from "@/components/Logo";

export default function NaoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm">
        <span className="brand-gradient mx-auto grid h-14 w-14 place-items-center rounded-2xl">
          <PrismaMark size={32} />
        </span>
        <h1 className="font-display mt-5 text-2xl font-bold">Link não encontrado</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Esse link não existe ou foi trocado. Peça um link novo para quem te enviou.
        </p>
      </div>
    </main>
  );
}
