import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, ArrowLeft, Link as LinkIcon, MessageCircle, Send, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import PlayerList, { LobbyPlayer } from "@/src/components/PlayerList";
import { playClick, playMessagePop } from "@/src/lib/sounds";

export interface LobbyMessage {
  username: string;
  message: string;
  isSystem?: boolean;
}

interface LobbyProps {
  title: string;
  roomCode: string;
  inviteLink: string;
  meId?: string;
  players: LobbyPlayer[];
  messages: LobbyMessage[];
  chatPlaceholder?: string;
  canSendMessages?: boolean;
  canStart?: boolean;
  startLabel?: string;
  onStart?: () => void;
  onLeave: () => void;
  onSendMessage: (message: string) => void;
  headerAccentClassName: string;
  children: React.ReactNode;
}

type ShareOption = {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void | Promise<void>;
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);

  const markCopied = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  };

  const fallbackCopy = (value: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  };

  const copy = async (value: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        markCopied(key);
        return true;
      }
    } catch {
      // fall through to legacy copy
    }

    if (fallbackCopy(value)) {
      markCopied(key);
      return true;
    }

    return false;
  };

  const share = async (value: string, key: string, title: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: value });
        return true;
      }
    } catch {
      // If share is cancelled or unavailable, fall back to copy.
    }

    return copy(value, key);
  };

  return { copied, copy, share };
}

export default function Lobby({
  title,
  roomCode,
  inviteLink,
  players,
  messages,
  chatPlaceholder = "Type a message...",
  canSendMessages = true,
  canStart,
  startLabel = "Start Game",
  onStart,
  onLeave,
  onSendMessage,
  headerAccentClassName,
  children,
}: LobbyProps) {
  const { copied, copy, share } = useCopy();
  const [chatInput, setChatInput] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);

  const sortedPlayers = useMemo(() => {
    const owners = players.filter((p) => p.isOwner);
    const others = players.filter((p) => !p.isOwner);
    return [...owners, ...others];
  }, [players]);

  useEffect(() => {
    if (!shareOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!shareMenuRef.current?.contains(event.target as Node)) {
        setShareOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [shareOpen]);

  const shareText = `${title} room ${roomCode}: ${inviteLink}`;
  const shareOptions: ShareOption[] = [
    {
      id: "native",
      label: "Share",
      icon: <Share2 size={16} />,
      onClick: async () => {
        await share(inviteLink, "link", `${title} invite`);
        setShareOpen(false);
      },
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      icon: <MessageCircle size={16} />,
    },
    {
      id: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`${title} room ${roomCode}`)}`,
      icon: <Send size={16} />,
    },
    {
      id: "copy",
      label: "Copy Link",
      icon: <Copy size={16} />,
      onClick: async () => {
        await copy(inviteLink, "link");
        setShareOpen(false);
      },
    },
  ];

  return (
    <div className="min-h-[var(--app-height)] lg:min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className={cn("px-4 py-4 lg:px-6 lg:py-5 border-b border-slate-200", headerAccentClassName)}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                playClick();
                onLeave();
              }}
              className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="text-white font-black text-lg lg:text-xl truncate">{title}</div>
              <div className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">
                Room <span className="text-white">{roomCode}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playClick();
                void copy(roomCode, "code");
              }}
              className="px-3 py-2 rounded-2xl bg-white/15 hover:bg-white/20 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-2 transition-colors"
              title="Copy room code"
            >
              {copied === "code" ? <Check size={16} /> : <Copy size={16} />} Code
            </button>
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={() => {
                  playClick();
                  setShareOpen((prev) => !prev);
                }}
                className="px-3 py-2 rounded-2xl bg-white/15 hover:bg-white/20 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-2 transition-colors"
                title="Share invite link"
              >
                {copied === "link" ? <Check size={16} /> : <LinkIcon size={16} />} Invite
              </button>

              {shareOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                  {shareOptions.map((option) =>
                    option.href ? (
                      <a
                        key={option.id}
                        href={option.href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          playClick();
                          setShareOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        {option.icon}
                        {option.label}
                      </a>
                    ) : (
                      <button
                        key={option.id}
                        onClick={async () => {
                          playClick();
                          await option.onClick?.();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-6">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
            {children}
          </div>

          <div className="grid grid-rows-[320px_1fr] lg:grid-rows-[360px_1fr] gap-4">
            <PlayerList players={sortedPlayers} />

            <div className="flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="font-black text-[11px] tracking-wider uppercase text-slate-700">Chat</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{players.length} online</div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    No messages yet
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={`${idx}-${m.username}`}
                      className={cn(
                        "text-sm p-2 rounded-xl border",
                        m.isSystem
                          ? "bg-slate-100 border-slate-200 text-slate-600 text-center font-medium"
                          : "bg-white border-slate-100 text-slate-700 shadow-sm"
                      )}
                    >
                      {!m.isSystem && <span className="font-black text-indigo-600 mr-1">{m.username}:</span>}
                      {m.message}
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const msg = chatInput.trim();
                  if (!msg || !canSendMessages) return;
                  onSendMessage(msg);
                  playMessagePop();
                  setChatInput("");
                }}
                className="p-3 bg-white border-t border-slate-200 flex gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={chatPlaceholder}
                  disabled={!canSendMessages}
                  className="flex-1 px-3 py-2 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-[16px] transition-all font-medium disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!canSendMessages}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {canStart && onStart && (
        <div className="px-4 pb-5 lg:px-6 lg:pb-6">
          <div className="max-w-6xl mx-auto">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                playClick();
                onStart();
              }}
              className="w-full py-4 rounded-3xl bg-slate-900 text-white font-black text-base shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all"
            >
              {startLabel}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
