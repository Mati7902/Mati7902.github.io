import "server-only";

import { AppError } from "@/lib/errors";
import { type AIProvider, type ClassifyInput, type IntentResult, buildUserPrompt, parseIntentJson, SYSTEM_PROMPT } from "@/server/services/ai/provider";

/** Adaptador para la API de OpenAI (chat completions con respuesta JSON), vía fetch. */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async classifyIntent(input: ClassifyInput): Promise<IntentResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new AppError("EXTERNAL", `OpenAI respondió ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseIntentJson(text);
    if (!parsed) throw new AppError("EXTERNAL", "Respuesta de IA sin JSON válido");
    return parsed;
  }
}
