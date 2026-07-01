import { getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const messages = await getSessionMessages("aaa2608d-6e80-4904-ad4f-ed36f12db5ba");
Bun.write("results.json", JSON.stringify(messages, null, 2));