"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

interface Msg { role: "bot" | "user"; text: string }
interface Option { handle: string; label: string }

export function WidgetChat({ flowId, apiBase = "" }: { flowId: string; apiBase?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [awaitsInput, setAwaitsInput] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const startedRef = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function call(payload: { text?: string; handle?: string }) {
    setBusy(true);
    setOptions(null);
    try {
      const res = await fetch(`${apiBase}/api/widget`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flowId, sessionId, ...payload }),
      });
      const data = await res.json();
      if (data.error) { setMsgs((m) => [...m, { role: "bot", text: `⚠️ ${data.error}` }]); return; }
      if (data.sessionId) setSessionId(data.sessionId);
      for (const t of (data.messages as string[]) ?? []) setMsgs((m) => [...m, { role: "bot", text: t }]);
      setOptions(data.options ?? null);
      setAwaitsInput(Boolean(data.awaitsInput));
      if (data.ended || data.handedOff) setEnded(true);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "⚠️ Connection error. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  // Start the flow on mount (guard against React StrictMode double-invoke).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void call({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, options, busy]);

  function submitText() {
    const t = input.trim();
    if (!t || busy || ended) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setInput("");
    void call({ text: t });
  }

  function pick(o: Option) {
    if (busy || ended) return;
    setMsgs((m) => [...m, { role: "user", text: o.label }]);
    void call({ text: o.label, handle: o.handle });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">C</span>
        <div><p className="text-sm font-semibold leading-tight">Chat with us</p><p className="text-xs opacity-80">We typically reply in a moment</p></div>
      </div>

      <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-[14px] px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-[14px] bg-secondary px-3 py-2 text-sm text-muted-foreground">…</div></div>}
        {options && options.length > 0 && !busy && (
          <div className="flex flex-wrap gap-2 pt-1">
            {options.map((o) => (
              <button key={o.handle} onClick={() => pick(o)} className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
                {o.label}
              </button>
            ))}
          </div>
        )}
        {ended && <p className="pt-2 text-center text-xs text-muted-foreground">This conversation has ended.</p>}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitText()}
            disabled={busy || ended || (!awaitsInput && !!options?.length)}
            placeholder={options?.length && !awaitsInput ? "Choose an option above…" : ended ? "Chat ended" : "Type a message…"}
            className="h-10 flex-1 rounded-[10px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          />
          <button onClick={submitText} disabled={busy || ended || !input.trim()} className="flex size-10 items-center justify-center rounded-[10px] bg-primary text-primary-foreground disabled:opacity-50">
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
