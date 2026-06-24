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

export interface ProjectGroup {
    path: string;
    name: string;
    sessions: ClaudeSession[];
}

export function useClaudeSessionStore() {
    const sessions = ref<ClaudeSession[]>([]);
    const customProjects = ref<Set<string>>(new Set());
    const currentSession = ref<ClaudeSession | null>(null);
    const currentMessages = ref<ClaudeMessage[]>([]);
    const loading = ref(false);

    const projects = computed<ProjectGroup[]>(() => {
        const map = new Map<string, ClaudeSession[]>();

        // Add sessions grouped by cwd
        for (const session of sessions.value) {
            const cwd = session.cwd || 'default';
            if (!map.has(cwd)) map.set(cwd, []);
            map.get(cwd)!.push(session);
        }

        // Add custom projects even if they have no sessions yet
        for (const path of customProjects.value) {
            if (!map.has(path)) map.set(path, []);
        }

        return Array.from(map.entries())
            .map(([path, s]) => ({
                path,
                name: path.split('/').pop() || path.split('\\').pop() || path,
                sessions: s.sort((a, b) => b.lastModified - a.lastModified),
            }))
            .sort((a, b) => {
                // Sort by most recently modified session, or keep custom projects at top if empty
                const aTime = a.sessions[0]?.lastModified || Date.now();
                const bTime = b.sessions[0]?.lastModified || Date.now();
                return bTime - aTime;
            });
    });

    function addProject(path: string) {
        const normalized = path.trim();
        if (!normalized) return;
        customProjects.value.add(normalized);
        // Persist to localStorage for this browser
        if (import.meta.client) {
            const existing = JSON.parse(localStorage.getItem('claude_projects') || '[]');
            if (!existing.includes(normalized)) {
                existing.push(normalized);
                localStorage.setItem('claude_projects', JSON.stringify(existing));
            }
        }
    }

    function loadProjectsFromStorage() {
        if (import.meta.client) {
            const stored = JSON.parse(localStorage.getItem('claude_projects') || '[]');
            for (const p of stored) customProjects.value.add(p);
        }
    }

    function removeProject(path: string) {
        customProjects.value.delete(path);
        if (import.meta.client) {
            const existing = JSON.parse(localStorage.getItem('claude_projects') || '[]');
            localStorage.setItem('claude_projects', JSON.stringify(existing.filter((p: string) => p !== path)));
        }
    }

    async function fetchSessionsForProject(path: string) {
        const result = await useAPI((api: any) => api.getClaudeSessions({ query: { limit: 50, offset: 0 } }));
        // Sessions already include cwd, so fetchSessions covers it. This is a placeholder
        // if we later want per-project listing on the server.
        return result;
    }

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
        projects: readonly(projects),
        currentSession: readonly(currentSession),
        currentMessages: readonly(currentMessages),
        loading: readonly(loading),
        addProject,
        removeProject,
        loadProjectsFromStorage,
        fetchSessionsForProject,
        fetchSessions,
        fetchSession,
        deleteSession,
    };
}
