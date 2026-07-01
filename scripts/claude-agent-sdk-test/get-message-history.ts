import { getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const messages = await getSessionMessages("52e18246-3e2b-4ac2-869c-df6054858916");
Bun.write("results.json", JSON.stringify(messages, null, 2));