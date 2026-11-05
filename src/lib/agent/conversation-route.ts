import { agentEngine, type AgentEngine } from "../cinema/workflow-policy.ts";

/**
 * Which engine the conversation panel is allowed to call.
 * The decision is `agentEngine`: open-weights mode forces native Qwen3-VL, and a saved
 * GPT-5 Nano preference cannot override it. With the mode off, this panel's Comfy
 * conversation is the router. The candidate Qwen graph is not submitted from here:
 * it is unqualified, and a chat line must not become a paid Cloud job.
 */
export function conversationEngine(openWeightsMode: boolean): AgentEngine {
  return agentEngine(openWeightsMode ? undefined : "router-gpt5-nano", openWeightsMode);
}

/** Hosted GPT-5 Nano. False in open-weights mode, before any POST to `/studio-agent/chat`. */
export function routerChatAllowed(openWeightsMode: boolean): boolean {
  return conversationEngine(openWeightsMode) === "router-gpt5-nano";
}
