"use client";

import { useState } from "react";
import { X, RotateCcw, Send, Bot } from "lucide-react";
import { stepFlow, type SimStep } from "@/lib/chatbots/simulate";
import type { FlowDefinition } from "@/lib/chatbots/types";
import { Button } from "@/components/ui/button";

interface Bubble { from: "bot" | "user"; text: string }

export function Simulator({ definition, onClose }: { definition: FlowDefinition; onClose: () => void }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [pending, setPending] = useState<SimStep | null>(null);
  const [nextNode, setNextNode] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);

  function render(steps: SimStep[]) {
    const newBubbles: Bubble[] = [];
    let awaiting: SimStep | null = null;
    for (const s of steps) {
      if (s.say) newBubbles.push({ from: "bot", text: s.say });
      if (s.note) newBubbles.push({ from: "bot", text: `⚙︎ ${s.note}` });
      if (s.awaitsInput || s.options) awaiting = s;
    }
    setBubbles((b) => [...b, ...newBubbles]);
    setPending(awaiting);
  }

  function start() {
    setBubbles([]); setVars({}); setStarted(true);
    const res = stepFlow(definition, null, null, {});
    setNextNode(res.nextNodeId); setVars(res.vars); render(res.steps);
  }

  function advance(payload: { text?: string; handle?: string }, echo: string) {
    setBubbles((b) => [...b, { from: "user", text: echo }]);
    const res = stepFlow(definition, nextNode, payload, vars);
    setNextNode(res.nextNodeId); setVars(res.vars); render(res.steps);
    setInput("");
  }

  return (
    <div className="flex h-full w-[340px] flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-primary" /> Test simulator</span>
        <div className="flex items-center gap-1">
          <button onClick={start} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Restart"><RotateCcw className="size-4" /></button>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Close"><X className="size-4" /></button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-background p-3">
        {!started ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="size-8 text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Run your flow as a customer would experience it.</p>
            <Button size="sm" className="mt-3" onClick={start}>Start test</Button>
          </div>
        ) : (
          bubbles.map((b, i) => (
            <div key={i} className={b.from === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[80%] rounded-[12px] px-3 py-2 text-sm ${b.from === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                {b.text}
              </div>
            </div>
          ))
        )}
        {pending?.options && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {pending.options.map((o) => (
              <button key={o.handle} onClick={() => advance({ handle: o.handle }, o.label)} className="rounded-full border border-primary bg-secondary px-3 py-1 text-xs font-medium text-primary hover:bg-cyan-50">
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {pending?.awaitsInput && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) advance({ text: input.trim() }, input.trim()); }}
          className="flex items-center gap-2 border-t border-border p-2.5"
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a reply…" className="h-9 flex-1 rounded-[10px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" />
          <Button size="icon" type="submit"><Send className="size-4" /></Button>
        </form>
      )}
    </div>
  );
}
