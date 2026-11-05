/**
 * Share in-flight promises so StrictMode remounts / parallel callers
 * don't duplicate the same network work.
 */

const inflight = new Map<string, Promise<unknown>>()

export function dedupeRequest<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key)
    if (existing) return existing as Promise<T>

    const promise = factory().finally(() => {
        if (inflight.get(key) === promise) {
            inflight.delete(key)
        }
    })

    inflight.set(key, promise)
    return promise
}
