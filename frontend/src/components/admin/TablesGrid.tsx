import { useState, type ReactNode } from "react";
import { Tables } from "./types";

type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
};

type TableProps<T> = {
  title: string;
  rows: T[];
  columns: Column<T>[];
};

function SimpleTable<T>({ title, rows, columns }: TableProps<T>) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
      <div className="mb-3 text-sm font-semibold text-white">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-white/80">
          <thead className="text-xs uppercase tracking-wide text-white/60">
            <tr>
              {columns.map((col) => (
                <th key={col.header} className="pb-2 pr-4">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 && (
              <tr>
                <td className="py-3 text-white/60" colSpan={columns.length}>
                  Aucune donnée.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/5">
                {columns.map((col) => (
                  <td key={col.header} className="py-2 pr-4">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TablesGrid({
  tables,
  visibleTables,
}: {
  tables: Tables | null;
  visibleTables?: string[];
}) {
  const slice = <T,>(rows?: { data: T[] }, limit = 6) => rows?.data?.slice(0, limit) ?? [];
  const [emailDetail, setEmailDetail] = useState<any | null>(null);
  const isVisible = (key: string) => !visibleTables || visibleTables.includes(key);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {isVisible("orders") && (
      <SimpleTable
        title="Orders"
        rows={slice(tables?.orders)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "Client", render: (r: any) => r.user?.email ?? "—" },
          { header: "Statut", render: (r: any) => r.status ?? "—" },
          { header: "Paiement", render: (r: any) => r.payment?.status ?? "—" },
          { header: "Créé", render: (r: any) => r.created_at ?? "—" },
        ]}
      />
      )}

      {isVisible("payments") && (
      <SimpleTable
        title="Payments"
        rows={slice(tables?.payments)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "Order", render: (r: any) => r.order_id ?? r.order?.id ?? "—" },
          { header: "Client", render: (r: any) => r.order?.user?.email ?? "—" },
          { header: "Montant", render: (r: any) => r.amount },
          { header: "Statut", render: (r: any) => r.status },
        ]}
      />
      )}

      {isVisible("users") && (
      <SimpleTable
        title="Users"
        rows={slice(tables?.users)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "Email", render: (r: any) => r.email ?? "—" },
          { header: "Premium", render: (r: any) => (r.is_premium ? "Oui" : "Non") },
          { header: "Niveau", render: (r: any) => r.premium_level ?? "—" },
        ]}
      />
      )}

      {isVisible("premium_memberships") && (
      <SimpleTable
        title="Premium memberships"
        rows={slice(tables?.premium_memberships)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "User", render: (r: any) => r.user?.email ?? "—" },
          { header: "Jeu", render: (r: any) => r.game?.name ?? "—" },
          { header: "Niveau", render: (r: any) => r.level },
          { header: "Expire", render: (r: any) => r.expiration_date ?? "—" },
        ]}
      />
      )}

      {isVisible("products") && (
      <SimpleTable
        title="Products"
        rows={slice(tables?.products)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "Nom", render: (r: any) => r.name ?? "—" },
          { header: "Type", render: (r: any) => r.type ?? "—" },
          { header: "Stock", render: (r: any) => r.stock ?? "—" },
          { header: "Likes", render: (r: any) => r.likes_count ?? "—" },
        ]}
      />
      )}

      {isVisible("likes") && (
      <SimpleTable
        title="Likes"
        rows={slice(tables?.likes)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "User", render: (r: any) => r.user?.email ?? "—" },
          { header: "Produit", render: (r: any) => r.product?.name ?? "—" },
          { header: "Date", render: (r: any) => r.created_at ?? "—" },
        ]}
      />
      )}

      {isVisible("chat_messages") && (
      <SimpleTable
        title="Chat moderation"
        rows={slice(tables?.chat_messages)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "Room", render: (r: any) => r.room?.name ?? "—" },
          { header: "User", render: (r: any) => r.user?.email ?? "—" },
          { header: "Message", render: (r: any) => r.message ?? "—" },
        ]}
      />
      )}

      {isVisible("email_logs") && (
      <SimpleTable
        title="Delivery emails"
        rows={slice(tables?.email_logs)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "User", render: (r: any) => r.user?.email ?? "—" },
          { header: "To", render: (r: any) => r.to ?? "—" },
          { header: "Type", render: (r: any) => r.type ?? "—" },
          { header: "Sujet", render: (r: any) => r.subject ?? "—" },
          { header: "Statut", render: (r: any) => r.status ?? "—" },
          { header: "Erreur", render: (r: any) => r.error ?? "—" },
          { header: "Envoyé", render: (r: any) => r.sent_at ?? "—" },
          {
            header: "Détails",
            render: (r: any) => (
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80"
                onClick={() => setEmailDetail(r)}
              >
                Voir
              </button>
            ),
          },
        ]}
      />
      )}

      {isVisible("payouts") && (
        <SimpleTable
          title="Payouts"
          rows={slice(tables?.payouts)}
          columns={[
            { header: "ID", render: (r: any) => r.id },
            { header: "User", render: (r: any) => r.user?.email ?? "—" },
            { header: "Montant", render: (r: any) => r.amount ?? "—" },
            { header: "Devise", render: (r: any) => r.currency ?? "—" },
            { header: "Statut", render: (r: any) => r.status ?? "—" },
            { header: "Provider", render: (r: any) => r.provider ?? "—" },
            { header: "Ref", render: (r: any) => r.provider_ref ?? "—" },
            { header: "Créé", render: (r: any) => r.created_at ?? "—" },
          ]}
        />
      )}
      {emailDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold">Détail email</div>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm"
                onClick={() => setEmailDetail(null)}
              >
                Fermer
              </button>
            </div>
            <div className="grid gap-3 text-sm text-white/80">
              <div><span className="text-white/50">ID:</span> {emailDetail.id}</div>
              <div><span className="text-white/50">User:</span> {emailDetail.user?.email ?? "—"}</div>
              <div><span className="text-white/50">To:</span> {emailDetail.to ?? "—"}</div>
              <div><span className="text-white/50">Type:</span> {emailDetail.type ?? "—"}</div>
              <div><span className="text-white/50">Sujet:</span> {emailDetail.subject ?? "—"}</div>
              <div><span className="text-white/50">Statut:</span> {emailDetail.status ?? "—"}</div>
              <div><span className="text-white/50">Erreur:</span> {emailDetail.error ?? "—"}</div>
              <div><span className="text-white/50">Envoyé:</span> {emailDetail.sent_at ?? "—"}</div>
              <div><span className="text-white/50">Créé:</span> {emailDetail.created_at ?? "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
