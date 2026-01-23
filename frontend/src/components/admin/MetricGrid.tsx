import type { JSX } from "react";
import { Flame, PiggyBank, TrendingUp, Wallet, Zap } from "lucide-react";
import { Summary } from "./types";

const cards = (
  summary: Summary | null,
): Array<{ title: string; value: string; accent: string; icon: JSX.Element }> => {
  const brut = summary ? summary.brut.toLocaleString("fr-FR") + " FCFA" : "—";
  const net = summary ? summary.net.toLocaleString("fr-FR") + " FCFA" : "—";
  const funds = summary ? summary.funds.toLocaleString("fr-FR") + " FCFA" : "—";
  const sales = summary ? summary.sales_today.toLocaleString("fr-FR") : "—";

  return [
    {
      title: "Brut encaisse",
      value: brut,
      accent: "from-indigo-500 to-cyan-400",
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: "Net (15%)",
      value: net,
      accent: "from-emerald-500 to-lime-400",
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      title: "Fonds (85%)",
      value: funds,
      accent: "from-amber-500 to-orange-400",
      icon: <PiggyBank className="h-5 w-5" />,
    },
    {
      title: "Ventes du jour",
      value: sales,
      accent: "from-rose-500 to-fuchsia-400",
      icon: <Flame className="h-5 w-5" />,
    },
  ];
};

export function MetricGrid({ summary }: { summary: Summary | null }) {
  const premium = summary?.premium;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards(summary).map((card) => (
        <div
          key={card.title}
          className={`rounded-2xl border border-white/5 bg-gradient-to-br ${card.accent} p-4 shadow-lg shadow-black/30`}
        >
          <div className={`flex items-center justify-between text-sm text-white/80 ${card.accent}`}>
            <span>{card.title}</span>
            <span className="rounded-full bg-black/20 p-2 text-white">{card.icon}</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-white">{card.value}</div>
        </div>
      ))}

      <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between text-sm text-white/80">
          <span>Premium actifs</span>
          <Zap className="h-5 w-5 text-amber-400" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm text-white">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <div className="text-xs text-amber-200">Bronze</div>
            <div className="text-lg font-semibold">{premium ? premium.bronze : "—"}</div>
          </div>
          <div className="rounded-lg bg-yellow-500/10 p-2">
            <div className="text-xs text-yellow-200">Or</div>
            <div className="text-lg font-semibold">{premium ? premium.or : "—"}</div>
          </div>
          <div className="rounded-lg bg-sky-500/10 p-2">
            <div className="text-xs text-sky-200">Platine</div>
            <div className="text-lg font-semibold">{premium ? premium.platine : "—"}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-white/70">
          Taux de conversion premium :
          <span className="ml-2 font-semibold text-emerald-300">
            {premium ? `${premium.conversion_rate}%` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
