import "server-only";

import { AppError } from "@/lib/errors";
import { type AIProvider, type ClassifyInput, type IntentResult, buildUserPrompt, parseIntentJson, SYSTEM_PROMPT } from "@/server/services/ai/provider";

/**
 * Adaptador para la Claude API (Messages API) usando fetch, sin SDK.
 * Modelo recomendado para clasificación: claude-haiku-4-5-20251001 (rápido y económico).
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async classifyIntent(input: ClassifyInput): Promise<IntentResult> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(input) }],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new AppError("EXTERNAL", `Anthropic respondió ${res.status}`);
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? []).map((c) => c.text ?? "").join("");
    const parsed = parseIntentJson(text);
    if (!parsed) throw new AppError("EXTERNAL", "Respuesta de IA sin JSON válido");
    return parsed;
  }
}
