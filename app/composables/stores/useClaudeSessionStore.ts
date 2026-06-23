import { useAPI } from '../useAPI';

export interface ClaudeSession {
    sessionId: string;
    summary: string;
    lastModified: number;
    customTitle?: string;
    firstPrompt?: string;
    gitBranch?: string;
    cwd?: string;
    createdAt?: number;
}

export interface ClaudeMessage {
    type: 'user' | 'assistant' | 'system';
    uuid: string;
    session_id: string;
    message: any;
    parent_tool_use_id?: string | null;
}

export function useClaudeSessionStore() {
    const sessions = ref<ClaudeSession[]>([]);
    const currentSession = ref<ClaudeSession | null>(null);
    const currentMessages = ref<ClaudeMessage[]>([]);
    const loading = ref(false);

    async function fetchSessions() {
        loading.value = true;
        try {
            const result = await useAPI((api: any) => api.getClaudeSessions({ query: { limit: 50, offset: 0 } }));
            if (result.success) {
                sessions.value = result.data.sessions;
            }
        } finally {
            loading.value = false;
        }
    }

    async function fetchSession(id: string) {
        loading.value = true;
        try {
            const result = await useAPI((api: any) => api.getClaudeSessionsById({ path: { id } }));
            if (result.success) {
                currentSession.value = result.data.session;
                currentMessages.value = result.data.messages || [];
            }
        } finally {
            loading.value = false;
        }
    }

    async function deleteSession(id: string) {
        const result = await useAPI((api: any) => api.deleteClaudeSessionsById({ path: { id } }));
        if (result.success) {
            sessions.value = sessions.value.filter(s => s.sessionId !== id);
        }
        return result;
    }

    return {
        sessions: readonly(sessions),
        currentSession: readonly(currentSession),
        currentMessages: readonly(currentMessages),
        loading: readonly(loading),
        fetchSessions,
        fetchSession,
        deleteSession,
    };
}
