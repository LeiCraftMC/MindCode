import { BasicAbstractStoreWithMetadata } from "~/utils/abstractStore";
import type { ProjectWithSessions } from "~/utils/types";
import { useAPI } from "~/composables/useAPI";

class SelectedProjectStore extends BasicAbstractStoreWithMetadata<ProjectWithSessions, { loading: boolean }> {

    protected readonly selectedProjectAbsolutePath: Ref<string | null>;

    constructor() {
        super('selectedProjectStore', {
            enableAutoFetchIfEmpty: false,
            defaultMetadata: {
                loading: false
            }
        });
        this.selectedProjectAbsolutePath = useState<string | null>('selectedProjectAbsolutePath', () => null);
    }

    protected async fetchData(): Promise<ProjectWithSessions | null> {

        const absolute_path = this.selectedProjectAbsolutePath.value;

        if (!absolute_path) {
            return null;
        }

        const response = await useAPI((api) => api.getClaudeProjectsByAbsolutePath({
            path: {
                absolute_path: encodeURIComponent(absolute_path)
            },
            query: {
                with_sessions: true
            }
        }));

        if (!response.success) {
            console.error("Failed to fetch project data");
            return null;
        }

        return response.data as ProjectWithSessions;
    }

    async set(absolute_path: string | null) {
        this.selectedProjectAbsolutePath.value = absolute_path;
        await this.refresh();
    }

    public get isLoading() {
        const metadata = this.useMetadataRaw();
        return computed(() => metadata.value.loading);
    }

}

export function useSelectedProjectStore() {
    return new SelectedProjectStore();
}