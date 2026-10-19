// Reads POST /api/chat's answer: one JSON event per line (ChatEvent in src/server/ai/chat.ts).
import type { ChatEvent } from "@/server/ai/chat";

export async function* chatEvents(response: Response): AsyncGenerator<ChatEvent> {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as ChatEvent;
    if (done) break;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as ChatEvent;
}
