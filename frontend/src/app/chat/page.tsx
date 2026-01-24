"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import {
  Bell,
  Crown,
  Loader2,
  MessageCircle,
  MicOff,
  Send,
  ShieldBan,
  Users,
} from "lucide-react";

type ChatUser = {
  id: number;
  name: string;
  game_username?: string;
  is_premium?: boolean;
  premium_level?: number;
  premium_expiration?: string | null;
  premium_color?: string;
  premium_badge?: boolean;
  premium_renewals?: number;
  role?: string;
};

type ChatMessage = {
  id: number;
  room_id: number;
  message: string;
  mentions: number[];
  created_at: string;
  user: ChatUser | null;
};

type ChatRoom = {
  id: number;
  name: string;
  type: string;
  is_active: boolean;
  messages_count: number;
  member?: {
    role: string;
    muted_until: string | null;
    banned_until: string | null;
  } | null;
};

type Paginated<T> = {
  data: T[];
  current_page: number;
  next_page_url: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const mentionClass = "text-amber-300 font-semibold";

function ChatScreen() {
  const { token } = useAuth();
  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);
  const isAuthenticated = Boolean(token);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<{ page: number; hasMore: boolean }>({ page: 1, hasMore: false });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [lastId, setLastId] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const currentRoom = useMemo(
    () => rooms.find((room) => room.id === currentRoomId) ?? null,
    [rooms, currentRoomId],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadUser = async () => {
      const res = await fetch(`${API_BASE}/user`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    };
    loadUser();
  }, [authHeaders, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchRooms = async () => {
      const res = await fetch(`${API_BASE}/chat/rooms`, { headers: authHeaders });
      if (res.ok) {
        const data: ChatRoom[] = await res.json();
        setRooms(data);
        if (!currentRoomId && data.length > 0) {
          setCurrentRoomId(data[0].id);
        }
      }
    };

    fetchRooms();
  }, [authHeaders, currentRoomId, isAuthenticated]);

  useEffect(() => {
    if (!currentRoomId || !isAuthenticated) return;
    let cancelled = false;

    const fetchMessages = async () => {
      setLoading(true);
      const res = await fetch(`${API_BASE}/chat/messages/${currentRoomId}?per_page=30`, {
        headers: authHeaders,
      });
      setLoading(false);
      if (!res.ok || cancelled) return;
      const data: Paginated<ChatMessage> = await res.json();
      const ordered = [...data.data].reverse();
      setMessages(ordered);
      setMeta({ page: data.current_page ?? 1, hasMore: Boolean(data.next_page_url) });
      const startId = ordered.length ? ordered[ordered.length - 1].id : 0;
      setLastId(startId);
      lastIdRef.current = startId;
      scrollToBottom();
      connectStream(currentRoomId, startId);
    };

    fetchMessages();

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId]);

  const connectStream = (roomId: number, fromId: number) => {
    if (typeof window === "undefined" || !token) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const url = new URL(`${API_BASE}/chat/stream/${roomId}`);
    if (fromId) url.searchParams.set("last_id", `${fromId}`);
    if (token) url.searchParams.set("token", token);

    setConnecting(true);

    const es = new EventSource(url.toString());
    es.onmessage = (event) => {
      const payload: ChatMessage = JSON.parse(event.data);
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, payload];
      });
      setLastId(payload.id);
      lastIdRef.current = payload.id;
      scrollToBottom();
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => connectStream(roomId, lastIdRef.current), 2500);
    };

    es.onopen = () => setConnecting(false);

    eventSourceRef.current = es;
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentRoomId) return;
    const message = input.trim();
    setInput("");
    const res = await fetch(`${API_BASE}/chat/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ room_id: currentRoomId, message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.message ?? "Envoi impossible");
      return;
    }

    const data: ChatMessage = await res.json();
    setMessages((prev) => [...prev, data]);
    setLastId(data.id);
    lastIdRef.current = data.id;
    scrollToBottom();
  };

  const loadMore = async () => {
    if (!currentRoomId || !meta.hasMore || loading) return;
    const nextPage = meta.page + 1;
    setLoading(true);
    const res = await fetch(`${API_BASE}/chat/messages/${currentRoomId}?per_page=30&page=${nextPage}`, {
      headers: authHeaders,
    });
    setLoading(false);
    if (!res.ok) return;
    const data: Paginated<ChatMessage> = await res.json();
    const ordered = [...data.data].reverse();
    setMessages((prev) => [...ordered, ...prev]);
    setMeta({ page: data.current_page ?? nextPage, hasMore: Boolean(data.next_page_url) });
  };

  const deleteMessage = async (messageId: number) => {
    const res = await fetch(`${API_BASE}/chat/messages/${messageId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  const moderate = async (action: "mute" | "ban", userId: number, minutes: number) => {
    if (!currentRoomId) return;
    const res = await fetch(`${API_BASE}/admin/chat/rooms/${currentRoomId}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ user_id: userId, minutes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.message ?? "Action non autorisée");
      return;
    }
    setStatus(action === "mute" ? "Utilisateur muté" : "Utilisateur banni");
  };

  const renderMessageBody = (text: string) => {
    const parts = text.split(/(@[A-Za-z0-9_.]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("@")) {
        return (
          <span key={idx} className={mentionClass}>
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_-10%,#1f2937_0%,#0b1220_45%,#020617_100%)] pb-24">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-black/60 backdrop-blur-lg">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 lg:px-12 xl:px-20 2xl:px-28 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-lg shadow-emerald-500/30">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">BADBOYSHOP</p>
              <h1 className="text-2xl font-black">Chat temps réel</h1>
              {status && <p className="text-xs text-amber-300">{status}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <Users className="h-4 w-4" />
            <span>{rooms.length} salons</span>
            {connecting && <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-6 px-6 lg:px-12 xl:px-20 2xl:px-28 py-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-3 rounded-3xl border border-white/5 bg-white/5 p-4 shadow-2xl shadow-emerald-500/5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
            <span>Salons</span>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/80">Global + Groupes</span>
          </div>
          <div className="flex flex-col gap-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setCurrentRoomId(room.id)}
                className={`flex w-full flex-col gap-1 rounded-2xl border px-3 py-3 text-left transition ${
                  room.id === currentRoomId
                    ? "border-emerald-400/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                    : "border-white/5 bg-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{room.name}</span>
                    {room.type === "global" && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">Global</span>
                    )}
                    {room.member?.banned_until && (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] text-red-100">
                        <ShieldBan className="h-3 w-3" />
                        Bannissement
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/60">{room.messages_count} msgs</span>
                </div>
                {room.member?.muted_until && !room.member?.banned_until && (
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <MicOff className="h-3 w-3" />
                    Muté jusqu'au {new Date(room.member.muted_until).toLocaleString()}
                  </div>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex h-[calc(100vh-160px)] flex-col gap-3 rounded-3xl border border-white/5 bg-white/5 p-4 shadow-2xl shadow-blue-500/5">
          <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/70">
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold">{currentRoom?.name ?? "Sélectionne un salon"}</span>
              {currentRoom?.member?.banned_until && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-[11px] text-red-100">
                  <ShieldBan className="h-3 w-3" /> Banni
                </span>
              )}
              {currentRoom?.member?.muted_until && !currentRoom?.member?.banned_until && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-[11px] text-amber-100">
                  <MicOff className="h-3 w-3" /> Muté
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Bell className="h-4 w-4 text-emerald-300" /> Mentions @pseudo notif.
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/5 bg-black/30 p-3">
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={!meta.hasMore || loading}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/20 disabled:opacity-40"
              >
                {loading ? "Chargement..." : meta.hasMore ? "Charger plus" : "Début de l'historique"}
              </button>
            </div>

            <AnimatePresence>
              {messages.map((message) => {
                const premiumColor = message.user?.premium_color ?? "#e5e7eb";
                const isMine = currentUser && message.user?.id === currentUser.id;
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex flex-col gap-1 rounded-2xl border px-3 py-2 ${
                      isMine
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-white/5 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: premiumColor }}>
                          {message.user?.game_username || message.user?.name || "Anonyme"}
                        </span>
                        {message.user?.premium_badge && (
                          <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/30 to-yellow-500/20 px-2 py-0.5 text-[11px] text-amber-100">
                            <Crown className="h-3 w-3" />
                            Lvl {message.user?.premium_level ?? 1}
                          </span>
                        )}
                        {(message.user?.premium_renewals ?? 0) > 0 && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                            {message.user?.premium_renewals} renouvellements
                          </span>
                        )}
                        {message.user?.role === "admin" && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-100">Admin</span>
                        )}
                      </div>
                      <span className="text-[11px] text-white/50">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-white/90">{renderMessageBody(message.message)}</p>

                    {isAdmin && message.user && (
                      <div className="flex gap-2 text-[11px] text-white/60">
                        <button
                          onClick={() => moderate("mute", message.user!.id, 30)}
                          className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-amber-100"
                        >
                          <MicOff className="h-3 w-3" /> Mute 30m
                        </button>
                        <button
                          onClick={() => moderate("ban", message.user!.id, 120)}
                          className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-red-100"
                        >
                          <ShieldBan className="h-3 w-3" /> Ban 2h
                        </button>
                        <button
                          onClick={() => deleteMessage(message.id)}
                          className="rounded-full bg-white/10 px-2 py-1 text-white hover:bg-white/20"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/50 px-3 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={currentRoom?.member?.banned_until ? "Banni de ce salon" : "Tape @pseudo pour notifier"}
              disabled={Boolean(currentRoom?.member?.banned_until)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/50 focus:border-emerald-300/70 focus:outline-none"
            />
            <button
              onClick={sendMessage}
              className="rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Chat() {
  return (
    <RequireAuth>
      <ChatScreen />
    </RequireAuth>
  );
}