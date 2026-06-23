import { defineWebSocketHandler } from 'h3';
import { ClaudeSessionRunner } from '../../lib/claude/sessionRunner';
import type { Message } from 'crossws';

export default defineWebSocketHandler({
    async open(peer) {
        await ClaudeSessionRunner.handleOpen(peer);
    },

    async close(peer, details) {
        await ClaudeSessionRunner.handleClose(peer);
    },

    async message(peer, message: Message) {
        await ClaudeSessionRunner.handleMessage(peer, message);
    },

    error(peer, error) {
        console.error('Claude WebSocket error:', error);
    },
});
