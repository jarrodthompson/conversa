"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { validateFlow } from "@/lib/chatbots/validate";
import type { FlowDefinition } from "@/lib/chatbots/types";
import type { Json } from "@/lib/supabase/types";

/** JSONB payloads are stored as-is; the placeholder Json type needs a cast. */
const asJson = (v: FlowDefinition): Json => v as unknown as Json;

async function guard(flowId: string) {
  const { org, userId } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("chatbot_flows")
    .select("id, organisation_id, current_version")
    .eq("id", flowId)
    .eq("organisation_id", org.id)
    .maybeSingle();
  if (!data) throw new Error("Flow not found");
  return { supabase, org, userId, flow: data as { id: string; current_version: number } };
}

export async function createFlowAction() {
  const { org, userId } = await getAppContext();
  const supabase = await createClient();
  const def: FlowDefinition = {
    nodes: [{ id: "start", type: "start", position: { x: 80, y: 120 }, data: {} }],
    edges: [],
  };
  const { data, error } = await supabase
    .from("chatbot_flows")
    .insert({ organisation_id: org.id, name: "Untitled flow", status: "draft", channels: ["web_chat"], definition: asJson(def), created_by: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create flow");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(`/app/chatbots/${(data as any).id}`);
}

export async function saveFlowAction(flowId: string, name: string, definition: FlowDefinition) {
  const { supabase, org } = await guard(flowId);
  const { error } = await supabase
    .from("chatbot_flows")
    .update({ name, definition: asJson(definition) })
    .eq("id", flowId)
    .eq("organisation_id", org.id);
  if (error) return { error: error.message };
  revalidatePath(`/app/chatbots/${flowId}`);
  return { ok: true };
}

export async function publishFlowAction(flowId: string, name: string, definition: FlowDefinition) {
  const issues = validateFlow(definition);
  if (issues.some((i) => i.level === "error")) {
    return { error: "Fix validation errors before publishing." };
  }
  const { supabase, org, userId, flow } = await guard(flowId);
  const nextVersion = (flow.current_version ?? 1) + 1;

  const { error: verErr } = await supabase.from("chatbot_versions").insert({
    flow_id: flowId, version: nextVersion, definition: asJson(definition), published_by: userId,
  });
  if (verErr) return { error: verErr.message };

  const { error } = await supabase
    .from("chatbot_flows")
    .update({ name, definition: asJson(definition), status: "published", current_version: nextVersion })
    .eq("id", flowId)
    .eq("organisation_id", org.id);
  if (error) return { error: error.message };

  revalidatePath(`/app/chatbots/${flowId}`);
  revalidatePath("/app/chatbots");
  return { ok: true, version: nextVersion };
}

export async function duplicateFlowAction(flowId: string) {
  const { supabase, org, userId } = await guard(flowId);
  const { data: src } = await supabase
    .from("chatbot_flows")
    .select("name, channels, definition")
    .eq("id", flowId)
    .single();
  if (!src) return { error: "Flow not found" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = src as any;
  const { data, error } = await supabase
    .from("chatbot_flows")
    .insert({ organisation_id: org.id, name: `${s.name} (copy)`, status: "draft", channels: s.channels, definition: s.definition, created_by: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not duplicate");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(`/app/chatbots/${(data as any).id}`);
}
