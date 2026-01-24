"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Share2 } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

export default function TransfersPage() {
  const { authFetch } = useAuth();
  const [amount, setAmount] = useState("50000");
  const [country, setCountry] = useState("Togo");
  const [currency, setCurrency] = useState("XOF");
  const [method, setMethod] = useState("Mobile Money");
  const [note, setNote] = useState("");
  const [showBalance, setShowBalance] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderCountry, setSenderCountry] = useState("Togo");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [useWalletBalance, setUseWalletBalance] = useState(true);

  const fee = Math.round(Number(amount || 0) * 0.02);
  const total = Number(amount || 0) + fee;
  const [totalTransferred, setTotalTransferred] = useState(0);
  const [history, setHistory] = useState<Array<{ id: number; reference: string; status: string; amount: number }>>([]);
  const supportedCountries = useMemo(() => ["Togo", "Bénin", "Cameroun", "Côte d'Ivoire"], []);

  const handleOpenTransfer = () => {
    setTransferError(null);
    setShowModal(true);
  };

  const handleSubmitTransfer = async () => {
    setTransferError(null);
    if (!senderName || !receiverName || !senderPhone || !senderCountry) {
      setTransferError("Merci de compléter tous les champs.");
      return;
    }
    if (!supportedCountries.includes(senderCountry)) {
      setTransferError("On ne peut pas envoyer de l'argent vers ce pays pour le moment.");
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/transfers/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          country: senderCountry,
          phone: senderPhone,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTransferError(err.message ?? "Transfert refusé.");
        return;
      }
      setShowModal(false);
    } catch {
      setTransferError("Connexion au serveur impossible.");
    }
  };

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const res = await authFetch(`${API_BASE}/transfers/history`);
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        if (!active) return;
        setHistory(
          items.map((item: any) => ({
            id: item.id,
            reference: item.provider_ref ?? item.idempotency_key ?? `TR-${item.id}`,
            status: item.status ?? "queued",
            amount: Number(item.amount ?? 0),
          })),
        );
        const total = items.reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0);
        setTotalTransferred(total);
      } catch {
        if (!active) return;
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [authFetch]);

  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="w-full py-10">
        <div className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-8">
          <header className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">BADBOYTrans</p>
            <h1 className="text-3xl lg:text-4xl font-black">Transferts internationaux rapides</h1>
            <p className="text-sm text-white/60 max-w-2xl">
              Envoie instantané vers l'Afrique, frais clairs, sécurité renforcée.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,1fr]">
            <div className="space-y-6">
              <div
                className="wallet-card p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(7, 51, 122, 0.9), rgba(4, 30, 73, 0.85))",
                }}
              >
                <div className="relative z-10">
                  <p className="text-sm text-white/70">Total transféré</p>
                  <div className="mt-2 flex items-center justify-between">
                    <h2 className="text-3xl font-black">
                      {showBalance ? `${totalTransferred.toLocaleString("fr-FR")} FCFA` : "XXXX"}
                    </h2>
                    <button
                      onClick={() => setShowBalance((prev) => !prev)}
                      className="h-10 w-10 rounded-full bg-white/15 grid place-items-center"
                      aria-label="Afficher ou masquer le montant"
                    >
                      {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-white/60 mt-2">Dernière actualisation : 22/01/2026</p>
                </div>
              </div>

              <div className="flex justify-center -mt-4">
                <button
                  onClick={handleOpenTransfer}
                  className="h-16 w-16 rounded-2xl bg-white text-blue-800 shadow-[0_10px_30px_rgba(0,0,0,0.25)] grid place-items-center"
                  aria-label="Transfert"
                >
                  <Share2 className="h-6 w-6" />
                </button>
              </div>

              <div className="glass-card rounded-2xl p-6 border border-white/10">
                <SectionTitle eyebrow="Activité" label="Transferts récents" />
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {history.length ? (
                    history.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                        <p className="text-xs text-white/50">Référence</p>
                        <p className="font-semibold text-white">{item.reference}</p>
                        <p className="text-xs text-emerald-300 mt-2">
                          {item.status} • {item.amount.toLocaleString("fr-FR")} FCFA
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                      Aucun transfert pour le moment.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
              <SectionTitle eyebrow="Simulateur" label="Créer un transfert" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-white/70">Montant</label>
                  <input
                    className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-white/70">Devise</label>
                  <select
                    className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="XOF">XOF</option>
                    <option value="XAF">XAF</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-white/70">Pays</label>
                  <select
                    className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="Togo">Togo</option>
                    <option value="Bénin">Bénin</option>
                    <option value="Ghana">Ghana</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-white/70">Moyen</label>
                  <select
                    className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Carte">Carte</option>
                    <option value="Banque">Banque</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-white/70">Note</label>
                  <textarea
                    className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <GlowButton className="w-full justify-center" variant="primary" onClick={handleOpenTransfer}>
                Continuer
              </GlowButton>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border border-white/10 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">Nouveau transfert</h3>
            <div className="space-y-3 text-sm">
              <input
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                placeholder="Nom de l'expéditeur"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
              <input
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                placeholder="Nom du receveur"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
              />
              <input
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                placeholder="Numéro de l'expéditeur"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
              />
              <input
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                placeholder="Pays"
                value={senderCountry}
                onChange={(e) => setSenderCountry(e.target.value)}
              />
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                <span>Utiliser le solde BD Wallet</span>
                <input
                  type="checkbox"
                  checked={useWalletBalance}
                  onChange={(e) => setUseWalletBalance(e.target.checked)}
                  className="h-4 w-4 accent-cyan-300"
                />
              </label>
              {transferError && <p className="text-xs text-amber-300">{transferError}</p>}
            </div>
            <div className="flex gap-3">
              <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => setShowModal(false)}>
                Annuler
              </GlowButton>
              <GlowButton className="flex-1 justify-center" onClick={handleSubmitTransfer}>
                Valider
              </GlowButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
