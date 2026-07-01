import { getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const messages = await getSessionMessages("ee6d9812-a8d3-48cc-94ea-213b6c189dee");
Bun.write("results.json", JSON.stringify(messages, null, 2));