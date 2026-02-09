import { createWsEndpoints } from '@polkadot/apps-config'
import { URL } from 'node:url'
import { warn, bumpStat } from './log.js'

/**
 * Load and filter WebSocket endpoints from `@polkadot/apps-config`.
 *
 * Keeps only valid `wss://` URLs whose host is not a raw numeric IP.
 * Returns an annotated array with network name, URL, relay info, etc.
 *
 * @returns {{ name: string, url: string, isRelay: boolean, relay?: string }[]}
 */
export function loadEndpoints() {
    const raw = createWsEndpoints().filter(({ value }) => !!value)
    const out = []

    for (const { value, isRelay, textRelay, text } of raw) {
        let name = text
        if (!!textRelay) {
            name = `${textRelay} | ${name}`
        }

        try {
            new URL(value)
        } catch {
            warn(`Invalid URL: ${value}`)
            bumpStat('skipped')
            continue
        }

        if (!value.startsWith('wss://') || value.match(/^wss?:\/\/\d+$/)) {
            continue
        }

        const entry = { name, url: value, isRelay: !!isRelay }
        if (textRelay) entry.relay = textRelay
        out.push(entry)
    }

    return out
}
