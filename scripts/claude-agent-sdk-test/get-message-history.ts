import { getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const messages = await getSessionMessages("944e90fb-0cce-416a-a62f-cab769365218");
Bun.write("results.json", JSON.stringify(messages, null, 2));