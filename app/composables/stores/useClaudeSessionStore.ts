const STORAGE_KEY = 'claude_projects';

/** Read the persisted custom-project paths, tolerating missing/corrupt localStorage data. */
function readStoredProjects(): string[] {
    if (!import.meta.client) return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
    } catch {
        return [];
    }
}

function writeStoredProjects(paths: string[]) {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

/**
 * Tracks user-added project paths, persisted per-browser in localStorage. The actual
 * project/session listing comes from the server API (see useSelectedProjectStore); this
 * store only remembers paths the user has explicitly added.
 */
export function useClaudeSessionStore() {
    const customProjects = ref<Set<string>>(new Set());

    function addProject(path: string) {
        const normalized = path.trim();
        if (!normalized) return;
        customProjects.value.add(normalized);
        const existing = readStoredProjects();
        if (!existing.includes(normalized)) {
            writeStoredProjects([...existing, normalized]);
        }
    }

    function loadProjectsFromStorage() {
        for (const p of readStoredProjects()) customProjects.value.add(p);
    }

    function removeProject(path: string) {
        customProjects.value.delete(path);
        writeStoredProjects(readStoredProjects().filter(p => p !== path));
    }

    return {
        customProjects: readonly(customProjects),
        addProject,
        removeProject,
        loadProjectsFromStorage,
    };
}
