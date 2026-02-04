"use client";

import Image from "next/image";

type Avatar = { id: string; name: string; src: string };

type AvatarPickerModalProps = {
  open: boolean;
  avatars: Avatar[];
  pendingAvatarId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
};

export default function AvatarPickerModal({
  open,
  avatars,
  pendingAvatarId,
  onSelect,
  onClose,
  onSave,
  saving,
}: AvatarPickerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-[32px] bg-black/70 border border-white/15 backdrop-blur-xl overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="font-bold">Choisir ton personnage</div>
            <div className="text-sm opacity-70">Défile, sélectionne, puis valide.</div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {avatars.map((a) => {
              const selected = a.id === pendingAvatarId;
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  className={[
                    "shrink-0 w-44 rounded-2xl border overflow-hidden text-left transition",
                    selected ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10",
                  ].join(" ")}
                >
                  <div className="relative h-44 w-44">
                    <Image src={a.src} alt={a.name} fill className="object-cover" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.65),transparent_55%)]" />
                  </div>
                  <div className="p-3">
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs opacity-70">{a.id}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition text-sm"
            >
              Annuler
            </button>
            <button
              disabled={saving}
              onClick={onSave}
              className="px-4 py-2 rounded-2xl bg-cyan-400 text-black hover:bg-cyan-300 transition text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Validation..." : "Valider ce personnage"}
            </button>
          </div>

          <div className="mt-4 text-xs opacity-70">
            Note: par défaut à l’inscription on met <span className="font-semibold">avatarId="nova_ghost"</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
