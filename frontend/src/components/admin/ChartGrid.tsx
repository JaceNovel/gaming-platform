import { ChartPoint, Charts } from "./types";

function Bars({ data, accent }: { data: ChartPoint[]; accent: string }) {
  const max = Math.max(...data.map((d) => d.brut || 0), 1);

  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((point) => (
        <div key={point.label} className="flex-1">
          <div className="relative h-32 overflow-hidden rounded-md bg-white/5">
            <div
              className={`absolute bottom-0 w-full rounded-t-md ${accent}`}
              style={{ height: `${Math.max((point.brut / max) * 100, 8)}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-white/70 truncate" title={point.label}>
            {point.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartGrid({ charts }: { charts: Charts | null }) {
  const placeholder: ChartPoint[] = [{ label: "—", brut: 0 }];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between text-sm text-white/80">
          <span>Brut vs net (jour)</span>
          <span className="text-xs text-white/50">14 derniers jours</span>
        </div>
        <Bars data={charts?.daily ?? placeholder} accent="bg-gradient-to-t from-emerald-500 to-cyan-400" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between text-sm text-white/80">
          <span>Brut vs net (mois)</span>
          <span className="text-xs text-white/50">6 derniers mois</span>
        </div>
        <Bars data={charts?.monthly ?? placeholder} accent="bg-gradient-to-t from-indigo-500 to-sky-400" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between text-sm text-white/80">
          Revenus par type de produit
        </div>
        <Bars data={charts?.by_type ?? placeholder} accent="bg-gradient-to-t from-amber-500 to-orange-400" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between text-sm text-white/80">Revenus par jeu</div>
        <Bars data={charts?.by_game ?? placeholder} accent="bg-gradient-to-t from-fuchsia-500 to-rose-400" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30 lg:col-span-2">
        <div className="flex items-center justify-between text-sm text-white/80">
          Revenus par pays
        </div>
        <Bars data={charts?.by_country ?? placeholder} accent="bg-gradient-to-t from-lime-500 to-emerald-400" />
      </div>
    </div>
  );
}
