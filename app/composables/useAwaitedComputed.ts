import type { ComputedGetter, ComputedRef, WritableComputedRef, DebuggerOptions, WritableComputedOptions } from "vue";

export function useAwaitedComputed<T>(
    getter: ComputedGetter<Promise<T>>,
    debugOptions?: DebuggerOptions
): Promise<ComputedRef<T>>;

export function useAwaitedComputed<T, S = T>(
    options: WritableComputedOptions<Promise<T>, S>,
    debugOptions?: DebuggerOptions
): Promise<WritableComputedRef<T, S>>;

export async function useAwaitedComputed<T, S = T>(
    source: ComputedGetter<Promise<T>> | WritableComputedOptions<Promise<T>, S>,
    debugOptions?: DebuggerOptions
): Promise<ComputedRef<T> | WritableComputedRef<T, S>> {
    const state = ref<T>() as { value: T };

    let resolveFirst!: () => void;
    let rejectFirst!: (reason: unknown) => void;
    const firstRun = new Promise<void>((resolve, reject) => {
        resolveFirst = resolve;
        rejectFirst = reject;
    });
    let initialized = false;

    const getter = typeof source === "function" ? source : source.get;

    watchEffect(async (onCleanup) => {
        let cancelled = false;
        onCleanup(() => (cancelled = true));

        try {
            const value = await getter();
            if (cancelled) return;

            state.value = value;

            if (!initialized) {
                initialized = true;
                resolveFirst();
            }
        } catch (error) {
            if (!initialized) {
                initialized = true;
                rejectFirst(error);
            }
        }
    }, debugOptions);

    await firstRun;

    if (typeof source === "function") {
        return computed(() => state.value);
    }

    return computed({
        get: () => state.value,
        set: source.set,
    });
}