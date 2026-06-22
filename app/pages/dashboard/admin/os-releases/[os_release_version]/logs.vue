<script lang="ts" setup>
import type { NavigationMenuItem } from '@nuxt/ui';
import type { GetAdminOsReleasesResponses, GetAdminOsReleasesByVersionPublishingLogsResponses } from '~/api-client';

const toast = useToast();
const route = useRoute();

type OSRelease = GetAdminOsReleasesResponses["200"]["data"][number];
type OSReleasePublishingLogs = GetAdminOsReleasesByVersionPublishingLogsResponses["200"]["data"];

const os_release = useSubrouterInjectedData<OSRelease>('os_release').inject();
const os_release_data = os_release.data;

let os_release_publishing_logs_error: {
    readonly success: false;
    readonly code: 500;
    readonly message: string;
    readonly data: null;
} | undefined;

const {
    data: os_release_publishing_logs,
    refresh: os_release_publishing_logs_refresh,
    loading: os_release_publishing_logs_loading,
} = await useAPIAsyncData<OSReleasePublishingLogs>(`admin-os-release:${os_release.data.value.version}:logs`, async () => {
    const res = await useAPI((api) => api.getAdminOsReleasesByVersionPublishingLogs({
        path: {
            version: os_release.data.value.version
        }
    }));
    if (!res.success || !res.data) {
        os_release_publishing_logs_error = res;
    }
    return res.data;
    // const return_data = {
    //     logs: ""
    // };
    // for (let i = 0; i < 500; i++) {
    //     const levels = ['info', 'success', 'warn', 'error', 'debug'];
    //     const level = levels[Math.floor(Math.random() * levels.length)] || 'info';
    //     const timestamp = new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString();
    //     let message = "";
    //     switch (level) {
    //         case 'info':
    //             message = `This is an informational message number ${i}.`;
    //             break;
    //         case 'success':
    //             message = `Operation completed successfully for item ${i}.`;
    //             break;
    //         case 'warn':
    //             message = `Potential issue detected in process ${i}.`;
    //             break;
    //         case 'error':
    //             message = `An error occurred while processing item ${i}.`;
    //             break;
    //         case 'debug':
    //             message = `Variable x has value ${Math.random()} at step ${i}.`;
    //             break;
    //     }
    //     return_data.logs += `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    // }
    // return return_data;

});

// Parse logs into structured format
interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug' | 'success';
    message: string;
    raw: string;
}

const parsedLogs = computed<LogEntry[]>(() => {
    const rawLogs = os_release_publishing_logs.value?.logs;
    if (!rawLogs) return [];
    
    const lines = rawLogs.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
        // Try to parse timestamp (common formats: ISO, brackets, etc.)
        const timestampMatch = line.match(/^(\[?\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?)\s*/);
        const timestamp = timestampMatch?.[1]?.replace(/[\[\]]/g, '') || '';
        const restOfLine = timestampMatch ? line.slice(timestampMatch[0].length) : line;
        
        // Detect log level
        let level: LogEntry['level'] = 'info';
        const lowerLine = restOfLine.toLowerCase();
        
        if (lowerLine.includes('[error]') || lowerLine.includes('error:') || lowerLine.startsWith('error')) {
            level = 'error';
        } else if (lowerLine.includes('[warn]') || lowerLine.includes('warning:') || lowerLine.includes('[warning]')) {
            level = 'warn';
        } else if (lowerLine.includes('[debug]') || lowerLine.includes('debug:')) {
            level = 'debug';
        } else if (lowerLine.includes('[success]') || lowerLine.includes('successfully') || lowerLine.includes('completed')) {
            level = 'success';
        }
        
        return {
            timestamp,
            level,
            message: restOfLine,
            raw: line
        };
    });
});

// Filter state
const searchQuery = ref('');
const selectedLevelObjects = ref<Array<{ label: string; value: string; icon: string; color: string }>>([]);
const showTimestamps = ref(true);
const autoScroll = ref(true);

const levelOptions = [
    { label: 'Info', value: 'info', icon: 'i-lucide-info', color: 'info' },
    { label: 'Success', value: 'success', icon: 'i-lucide-check-circle', color: 'success' },
    { label: 'Warning', value: 'warn', icon: 'i-lucide-alert-triangle', color: 'warning' },
    { label: 'Error', value: 'error', icon: 'i-lucide-x-circle', color: 'error' },
    { label: 'Debug', value: 'debug', icon: 'i-lucide-bug', color: 'neutral' }
];

const selectedLevels = computed(() => selectedLevelObjects.value.map(opt => opt.value));

const filteredLogs = computed(() => {
    let logs = parsedLogs.value;
    
    // Filter by level
    if (selectedLevels.value.length > 0) {
        logs = logs.filter(log => selectedLevels.value.includes(log.level));
    }
    
    // Filter by search query
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase();
        logs = logs.filter(log => log.message.toLowerCase().includes(query));
    }
    
    return logs;
});

// Stats
const logStats = computed(() => ({
    total: parsedLogs.value.length,
    info: parsedLogs.value.filter(l => l.level === 'info').length,
    success: parsedLogs.value.filter(l => l.level === 'success').length,
    warn: parsedLogs.value.filter(l => l.level === 'warn').length,
    error: parsedLogs.value.filter(l => l.level === 'error').length,
    debug: parsedLogs.value.filter(l => l.level === 'debug').length,
}));

function getLevelColor(level: LogEntry['level']) {
    switch (level) {
        case 'error': return 'text-red-400';
        case 'warn': return 'text-amber-400';
        case 'success': return 'text-emerald-400';
        case 'debug': return 'text-slate-400';
        default: return 'text-sky-400';
    }
}

function getLevelIcon(level: LogEntry['level']) {
    switch (level) {
        case 'error': return 'i-lucide-x-circle';
        case 'warn': return 'i-lucide-alert-triangle';
        case 'success': return 'i-lucide-check-circle';
        case 'debug': return 'i-lucide-bug';
        default: return 'i-lucide-info';
    }
}

function getLevelBgColor(level: LogEntry['level']) {
    switch (level) {
        case 'error': return 'bg-red-500/10 hover:bg-red-500/15';
        case 'warn': return 'bg-amber-500/10 hover:bg-amber-500/15';
        case 'success': return 'bg-emerald-500/10 hover:bg-emerald-500/15';
        case 'debug': return 'bg-slate-500/10 hover:bg-slate-500/15';
        default: return 'bg-sky-500/10 hover:bg-sky-500/15';
    }
}

// Auto-scroll to bottom
const logContainer = ref<HTMLElement | null>(null);

function scrollToBottom() {
    if (logContainer.value && autoScroll.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
}

// Copy logs to clipboard
async function copyLogs() {
    const logText = filteredLogs.value.map(l => l.raw).join('\n');
    await navigator.clipboard.writeText(logText);
    toast.add({
        title: 'Logs copied',
        description: 'Log content has been copied to clipboard.',
        icon: 'i-lucide-check',
        color: 'success'
    });
}

// Download logs
function downloadLogs() {
    const logText = os_release_publishing_logs.value?.logs || '';
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `os-release-${os_release.data.value.version}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Watch for new logs and auto-scroll
watch(filteredLogs, () => {
    nextTick(scrollToBottom);
}, { deep: true });

onMounted(() => {
    nextTick(scrollToBottom);
});

</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div>
            <h2 class="text-xl font-semibold text-white">Publishing Logs</h2>
            <p class="text-sm text-slate-400 mt-1">View the publishing logs for OS Release {{ os_release_data.version }}.</p>
        </div>

        <!-- Loading State -->
        <div v-if="os_release_publishing_logs_loading" class="flex items-center justify-center py-12">
            <div class="flex flex-col items-center gap-3">
                <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-slate-400" />
                <span class="text-sm text-slate-400">Loading logs...</span>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="os_release_publishing_logs_error" class="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <UIcon name="i-lucide-alert-circle" class="w-5 h-5 text-red-400" />
                </div>
                <div>
                    <h3 class="font-medium text-red-400">Failed to load logs</h3>
                    <p class="text-sm text-slate-400 mt-1">{{ os_release_publishing_logs_error?.message || 'An error occurred while fetching the logs.' }}</p>
                </div>
            </div>
            <UButton 
                label="Retry" 
                color="error" 
                variant="soft" 
                icon="i-lucide-refresh-cw"
                class="mt-4"
                @click="os_release_publishing_logs_refresh()"
            />
        </div>

        <!-- Empty State -->
        <div v-else-if="!os_release_publishing_logs?.logs" class="rounded-xl border border-slate-800 bg-slate-900/60 p-8">
            <div class="flex flex-col items-center text-center">
                <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4">
                    <UIcon name="i-lucide-file-text" class="w-6 h-6 text-slate-400" />
                </div>
                <h3 class="font-medium text-white">No logs available</h3>
                <p class="text-sm text-slate-400 mt-1 max-w-sm">
                    Publishing logs will appear here once the release publishing process starts.
                </p>
            </div>
        </div>

        <!-- Log Viewer -->
        <template v-else>
            <!-- Stats Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-file-text" class="w-4 h-4 text-slate-400" />
                        <span class="text-xs text-slate-400">Total</span>
                    </div>
                    <p class="text-lg font-semibold text-white mt-1">{{ logStats.total }}</p>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-info" class="w-4 h-4 text-sky-400" />
                        <span class="text-xs text-slate-400">Info</span>
                    </div>
                    <p class="text-lg font-semibold text-sky-400 mt-1">{{ logStats.info }}</p>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-check-circle" class="w-4 h-4 text-emerald-400" />
                        <span class="text-xs text-slate-400">Success</span>
                    </div>
                    <p class="text-lg font-semibold text-emerald-400 mt-1">{{ logStats.success }}</p>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-alert-triangle" class="w-4 h-4 text-amber-400" />
                        <span class="text-xs text-slate-400">Warnings</span>
                    </div>
                    <p class="text-lg font-semibold text-amber-400 mt-1">{{ logStats.warn }}</p>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-x-circle" class="w-4 h-4 text-red-400" />
                        <span class="text-xs text-slate-400">Errors</span>
                    </div>
                    <p class="text-lg font-semibold text-red-400 mt-1">{{ logStats.error }}</p>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-bug" class="w-4 h-4 text-slate-400" />
                        <span class="text-xs text-slate-400">Debug</span>
                    </div>
                    <p class="text-lg font-semibold text-slate-300 mt-1">{{ logStats.debug }}</p>
                </div>
            </div>

            <!-- Log Container Card -->
            <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                <!-- Toolbar -->
                <div class="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div class="flex flex-1 flex-col sm:flex-row gap-3">
                        <!-- Search -->
                        <UInput
                            v-model="searchQuery"
                            placeholder="Search logs..."
                            icon="i-lucide-search"
                            class="flex-1 max-w-xs"
                        />
                        
                        <!-- Level Filter -->
                        <USelectMenu
                            v-model="selectedLevelObjects"
                            :items="levelOptions"
                            multiple
                            placeholder="Filter by level"
                            class="w-full sm:w-48"
                        >
                            <template #leading>
                                <UIcon name="i-lucide-filter" class="w-4 h-4 text-slate-400" />
                            </template>
                        </USelectMenu>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2">
                        <UTooltip text="Show timestamps">
                            <UButton
                                :icon="'i-lucide-clock'"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                :class="showTimestamps ? 'text-sky-400' : ''"
                                @click="showTimestamps = !showTimestamps"
                            />
                        </UTooltip>
                        <UTooltip text="Auto-scroll">
                            <UButton
                                :icon="autoScroll ? 'i-lucide-arrow-down-to-line' : 'i-lucide-arrow-down'"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                :class="autoScroll ? 'text-sky-400' : ''"
                                @click="autoScroll = !autoScroll"
                            />
                        </UTooltip>
                        <UDivider orientation="vertical" class="h-5" />
                        <UTooltip text="Copy logs">
                            <UButton
                                icon="i-lucide-copy"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="copyLogs"
                            />
                        </UTooltip>
                        <UTooltip text="Download logs">
                            <UButton
                                icon="i-lucide-download"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="downloadLogs"
                            />
                        </UTooltip>
                        <UTooltip text="Refresh">
                            <UButton
                                icon="i-lucide-refresh-cw"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                :loading="os_release_publishing_logs_loading"
                                @click="os_release_publishing_logs_refresh()"
                            />
                        </UTooltip>
                    </div>
                </div>

                <!-- Log Output -->
                <div 
                    ref="logContainer"
                    class="h-[calc(100vh-235px)] overflow-y-auto font-mono text-sm bg-slate-950/50"
                >
                    <!-- Empty filter result -->
                    <div v-if="filteredLogs.length === 0" class="flex flex-col items-center justify-center h-full text-slate-400">
                        <UIcon name="i-lucide-search-x" class="w-8 h-8 mb-2" />
                        <span>No logs match your filters</span>
                    </div>

                    <!-- Log entries -->
                    <div v-else class="divide-y divide-slate-800/50">
                        <div
                            v-for="(log, index) in filteredLogs"
                            :key="index"
                            class="px-4 py-2 flex items-start gap-3 transition-colors"
                            :class="getLevelBgColor(log.level)"
                        >
                            <!-- Line number -->
                            <span class="text-slate-600 select-none w-8 text-right flex-shrink-0">{{ index + 1 }}</span>
                            
                            <!-- Level icon -->
                            <UIcon 
                                :name="getLevelIcon(log.level)" 
                                :class="getLevelColor(log.level)"
                                class="w-4 h-4 mt-0.5 flex-shrink-0"
                            />
                            
                            <!-- Timestamp -->
                            <span 
                                v-if="showTimestamps && log.timestamp" 
                                class="text-slate-500 flex-shrink-0"
                            >
                                {{ log.timestamp }}
                            </span>
                            
                            <!-- Message -->
                            <span 
                                class="text-slate-300 break-all flex-1"
                                :class="getLevelColor(log.level)"
                            >
                                {{ log.message }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>Showing {{ filteredLogs.length }} of {{ parsedLogs.length }} log entries</span>
                    <span v-if="os_release_data?.publishing_status === 'running'" class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live
                    </span>
                </div>
            </div>
        </template>
    </div>
</template>
