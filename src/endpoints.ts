import { URL } from 'node:url'
import { warn } from './log.js'
import type { EndpointInput } from './types.js'

/**
 * Load and filter WebSocket endpoints from `@polkadot/apps-config`.
 *
 * Keeps only valid `wss://` URLs whose host is not a raw numeric IP.
 * Returns an annotated array with network name, URL, relay info, etc.
 */
export async function loadEndpoints(): Promise<{ endpoints: EndpointInput[]; skipped: number }> {
    // Dynamic import so we can suppress noisy @polkadot duplicate-version warnings
    const origWarn = console.warn
    console.warn = () => {}
    const { createWsEndpoints } = await import('@polkadot/apps-config')
    console.warn = origWarn

    const raw = createWsEndpoints().filter(({ value }) => !!value)

    // First pass: collect names that any provider marks as relay.
    // expandEndpoint() only sets isRelay on the last provider, which may be
    // filtered out later (e.g. light-client URL), so we capture the flag early.
    // Use stringified text since it may not be a plain string.
    const relayNames = new Set<string>()
    for (const { isRelay, text } of raw) {
        if (isRelay) relayNames.add(String(text))
    }

    const out: EndpointInput[] = []
    let skipped = 0

    for (const { value, textRelay, text } of raw) {
        let name = String(text)
        if (textRelay) {
            name = `${textRelay} | ${name}`
        }

        try {
            new URL(value)
        } catch {
            warn(`Invalid URL: ${value}`)
            skipped++
            continue
        }

        if (!value.startsWith('wss://') || value.match(/^wss?:\/\/\d+$/)) {
            continue
        }

        const entry: EndpointInput = { name, url: value, isRelay: relayNames.has(String(text)) }
        if (textRelay) entry.relay = String(textRelay)
        out.push(entry)
    }

    return { endpoints: out, skipped }
}
