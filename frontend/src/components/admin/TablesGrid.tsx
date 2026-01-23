import type { ReactNode } from "react";
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

export function TablesGrid({ tables }: { tables: Tables | null }) {
  const slice = <T,>(rows?: { data: T[] }, limit = 6) => rows?.data?.slice(0, limit) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
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

      <SimpleTable
        title="Tournaments"
        rows={slice(tables?.tournaments)}
        columns={[
          { header: "ID", render: (r: any) => r.id },
          { header: "Nom", render: (r: any) => r.name ?? "—" },
          { header: "Jeu", render: (r: any) => r.game?.name ?? "—" },
          { header: "Participants", render: (r: any) => r.participants_count ?? "—" },
          { header: "Actif", render: (r: any) => (r.is_active ? "Oui" : "Non") },
        ]}
      />

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
    </div>
  );
}
