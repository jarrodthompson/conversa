"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Minus, Maximize, Play, Save, Rocket, History,
  AlertTriangle, CheckCircle2, Copy,
} from "lucide-react";
import {
  NODE_DEFS, PALETTE_ORDER, newNodeId, newEdgeId,
  type FlowDefinition, type FlowNode, type FlowEdge, type NodeType,
} from "@/lib/chatbots/types";
import { inputPoint, outputPoint, edgePath } from "@/lib/chatbots/geometry";
import { validateFlow } from "@/lib/chatbots/validate";
import { saveFlowAction, publishFlowAction, duplicateFlowAction } from "@/lib/chatbots/actions";
import { NodeCard } from "@/components/chatbots/node-card";
import { SettingsPanel } from "@/components/chatbots/settings-panel";
import { Simulator } from "@/components/chatbots/simulator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Version { version: number; created_at: string }

export function FlowBuilder({
  flowId, initialName, initialStatus, initialDefinition, versions,
}: {
  flowId: string;
  initialName: string;
  initialStatus: string;
  initialDefinition: FlowDefinition;
  versions: Version[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [nodes, setNodes] = useState<FlowNode[]>(initialDefinition.nodes ?? []);
  const [edges, setEdges] = useState<FlowEdge[]>(initialDefinition.edges ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ source: string; handle: string } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [dirty, setDirty] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const definition: FlowDefinition = useMemo(() => ({ nodes, edges }), [nodes, edges]);
  const issues = useMemo(() => validateFlow(definition), [definition]);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const issueNodeIds = useMemo(() => new Set(issues.filter((i) => i.nodeId).map((i) => i.nodeId!)), [issues]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const markDirty = () => setDirty(true);

  const onDragEnd = useCallback((e: DragEndEvent) => {
    const { active, delta } = e;
    setNodes((ns) => ns.map((n) => n.id === active.id
      ? { ...n, position: { x: n.position.x + delta.x / scale, y: n.position.y + delta.y / scale } }
      : n));
    markDirty();
  }, [scale]);

  function addNode(type: NodeType) {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (rect.width / 2 - pan.x) / scale : 200;
    const cy = rect ? (rect.height / 3 - pan.y) / scale : 160;
    // Deterministic cascade offset so stacked adds don't overlap.
    const off = (nodes.length % 6) * 16;
    const node: FlowNode = {
      id: newNodeId(), type,
      position: { x: cx + off, y: cy + off },
      data: { ...NODE_DEFS[type].defaultData },
    };
    setNodes((ns) => [...ns, node]);
    setSelectedId(node.id);
    markDirty();
  }

  function startConnect(source: string, handle: string) {
    setConnecting({ source, handle });
    toast.info("Click a target node to connect");
  }

  function completeConnect(target: string) {
    if (!connecting) return;
    if (connecting.source === target) { setConnecting(null); return; }
    setEdges((es) => {
      // one edge per source-handle
      const filtered = es.filter((e) => !(e.source === connecting.source && (e.sourceHandle ?? "out") === connecting.handle));
      return [...filtered, { id: newEdgeId(), source: connecting.source, target, sourceHandle: connecting.handle }];
    });
    setConnecting(null);
    markDirty();
  }

  function updateNodeData(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setNodes((ns) => ns.map((n) => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n));
    markDirty();
  }

  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
    markDirty();
  }

  // Background panning
  const panState = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  function onBgPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return; // only when clicking empty canvas
    setSelectedId(null);
    setConnecting(null);
    panState.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onBgPointerMove(e: React.PointerEvent) {
    if (!panState.current) return;
    setPan({ x: panState.current.x + (e.clientX - panState.current.px), y: panState.current.y + (e.clientY - panState.current.py) });
  }
  function onBgPointerUp() { panState.current = null; }

  function zoomBy(delta: number) { setScale((s) => Math.min(1.6, Math.max(0.4, +(s + delta).toFixed(2)))); }
  function fitView() { setScale(1); setPan({ x: 40, y: 20 }); }

  // Keyboard delete
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((ev.key === "Delete" || ev.key === "Backspace") && selectedId) {
        const n = nodes.find((x) => x.id === selectedId);
        if (n && n.type !== "start") deleteNode(selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nodes]);

  async function save() {
    setBusy(true);
    const res = await saveFlowAction(flowId, name, definition);
    setBusy(false);
    if (res?.error) toast.error(res.error);
    else { toast.success("Draft saved"); setDirty(false); }
  }

  async function publish() {
    if (errorCount > 0) { setShowIssues(true); toast.error("Fix errors before publishing"); return; }
    setBusy(true);
    const res = await publishFlowAction(flowId, name, definition);
    setBusy(false);
    if (res?.error) toast.error(res.error);
    else { toast.success(`Published v${res.version}`); setDirty(false); router.refresh(); }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link href="/app/chatbots" className="flex size-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"><ArrowLeft className="size-4" /></Link>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
          className="w-56 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-border focus:border-ring"
        />
        <Badge variant={initialStatus === "published" ? "success" : "muted"}>{initialStatus}</Badge>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setShowIssues((s) => !s)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-xs font-medium", errorCount ? "border-error/40 text-error" : issues.length ? "border-warning/40 text-warning" : "border-border text-muted-foreground")}>
            {errorCount ? <AlertTriangle className="size-3.5" /> : issues.length ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {issues.length ? `${issues.length} issue${issues.length > 1 ? "s" : ""}` : "Valid"}
          </button>
          <Button variant="outline" size="sm" onClick={() => setShowVersions((s) => !s)}><History className="size-4" /> v{versions[0]?.version ?? 1}</Button>
          <form action={async () => { await duplicateFlowAction(flowId); }}>
            <Button variant="ghost" size="sm" type="submit"><Copy className="size-4" /> Duplicate</Button>
          </form>
          <Button variant="outline" size="sm" onClick={() => setShowSim((s) => !s)}><Play className="size-4" /> Test</Button>
          <Button variant="outline" size="sm" onClick={save} disabled={busy}><Save className="size-4" /> Save</Button>
          <Button size="sm" onClick={publish} disabled={busy}><Rocket className="size-4" /> Publish</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <aside className="w-52 shrink-0 overflow-y-auto border-r border-border bg-card p-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nodes</p>
          <div className="mt-2 space-y-1">
            {PALETTE_ORDER.map((type) => {
              const def = NODE_DEFS[type];
              return (
                <button key={type} onClick={() => addNode(type)} className="flex w-full items-center gap-2 rounded-[8px] border border-transparent px-2 py-1.5 text-left text-sm hover:border-border hover:bg-muted">
                  <span className="flex size-6 items-center justify-center rounded-[6px]" style={{ background: `${def.color}1a`, color: def.color }}><def.icon className="size-3.5" /></span>
                  <span className="truncate">{def.label}</span>
                  <Plus className="ml-auto size-3.5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Canvas */}
        <div className="relative min-w-0 flex-1 overflow-hidden bg-[#eef5f8]">
          <div
            ref={canvasRef}
            onPointerDown={onBgPointerDown}
            onPointerMove={onBgPointerMove}
            onPointerUp={onBgPointerUp}
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(#cddbe2 1px, transparent 1px)",
              backgroundSize: `${20 * scale}px ${20 * scale}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              cursor: connecting ? "crosshair" : "grab",
            }}
          >
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                {/* edges */}
                <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" style={{ width: 1, height: 1 }}>
                  {edges.map((e) => {
                    const s = nodes.find((n) => n.id === e.source);
                    const t = nodes.find((n) => n.id === e.target);
                    if (!s || !t) return null;
                    const p = edgePath(outputPoint(s, e.sourceHandle ?? "out"), inputPoint(t));
                    return (
                      <g key={e.id}>
                        <path d={p} fill="none" stroke="#06B6D4" strokeWidth={2} markerEnd="url(#arrow)" />
                        <path d={p} fill="none" stroke="transparent" strokeWidth={14} className="pointer-events-auto cursor-pointer" onClick={() => { setEdges((es) => es.filter((x) => x.id !== e.id)); markDirty(); }} />
                      </g>
                    );
                  })}
                  <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L8,3 L0,6 Z" fill="#06B6D4" />
                    </marker>
                  </defs>
                </svg>

                {/* nodes */}
                {nodes.map((n) => (
                  <NodeCard
                    key={n.id}
                    node={n}
                    scale={scale}
                    selected={selectedId === n.id}
                    connecting={!!connecting && connecting.source !== n.id}
                    hasIssue={issueNodeIds.has(n.id)}
                    onSelect={() => setSelectedId(n.id)}
                    onStartConnect={(h) => startConnect(n.id, h)}
                    onCompleteConnect={() => completeConnect(n.id)}
                  />
                ))}
              </div>
            </DndContext>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-[10px] border border-border bg-card p-1 shadow-sm">
            <button onClick={() => zoomBy(-0.1)} className="rounded-md p-1.5 hover:bg-muted"><Minus className="size-4" /></button>
            <span className="w-12 text-center text-xs font-medium">{Math.round(scale * 100)}%</span>
            <button onClick={() => zoomBy(0.1)} className="rounded-md p-1.5 hover:bg-muted"><Plus className="size-4" /></button>
            <button onClick={fitView} className="rounded-md p-1.5 hover:bg-muted" title="Reset view"><Maximize className="size-4" /></button>
          </div>

          {/* Minimap */}
          <div className="absolute bottom-4 right-4 hidden h-28 w-40 overflow-hidden rounded-[10px] border border-border bg-card/90 shadow-sm sm:block">
            <MiniMap nodes={nodes} />
          </div>

          {connecting && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-sidebar px-3 py-1.5 text-xs text-white shadow-lg">
              Connecting — click a target node, or click empty canvas to cancel
            </div>
          )}

          {/* Issues drawer */}
          {showIssues && (
            <div className="absolute right-4 top-4 w-72 rounded-[12px] border border-border bg-card p-3 shadow-lg">
              <p className="mb-2 text-sm font-semibold">Validation</p>
              {issues.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" /> No problems found.</p>
              ) : (
                <ul className="space-y-1.5">
                  {issues.map((i, idx) => (
                    <li key={idx} className={cn("flex items-start gap-2 text-xs", i.level === "error" ? "text-error" : "text-warning")}>
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <button className="text-left hover:underline" onClick={() => i.nodeId && setSelectedId(i.nodeId)}>{i.message}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Versions drawer */}
          {showVersions && (
            <div className="absolute right-4 top-4 w-64 rounded-[12px] border border-border bg-card p-3 shadow-lg">
              <p className="mb-2 text-sm font-semibold">Version history</p>
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No published versions yet.</p>
              ) : (
                <ul className="space-y-1">
                  {versions.map((v) => (
                    <li key={v.version} className="flex items-center justify-between rounded-[8px] px-2 py-1.5 text-sm hover:bg-muted">
                      <span>Version {v.version}</span>
                      <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Settings / Simulator */}
        {showSim ? (
          <Simulator definition={definition} onClose={() => setShowSim(false)} />
        ) : (
          <aside className="w-72 shrink-0 border-l border-border bg-card">
            <SettingsPanel node={selected} onChange={updateNodeData} onDelete={() => selected && deleteNode(selected.id)} />
          </aside>
        )}
      </div>
    </div>
  );
}

function MiniMap({ nodes }: { nodes: FlowNode[] }) {
  if (nodes.length === 0) return null;
  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const minX = Math.min(...xs) - 40, minY = Math.min(...ys) - 40;
  const w = Math.max(...xs) - minX + 240, h = Math.max(...ys) - minY + 120;
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-full w-full">
      {nodes.map((n) => (
        <rect key={n.id} x={n.position.x} y={n.position.y} width={200} height={68} rx={10} fill={`${NODE_DEFS[n.type as NodeType].color}55`} stroke={NODE_DEFS[n.type as NodeType].color} strokeWidth={3} />
      ))}
    </svg>
  );
}
