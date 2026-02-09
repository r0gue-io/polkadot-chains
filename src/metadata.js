import { TypeRegistry, Metadata } from '@polkadot/types'
import { jsonRpcCall } from './ws.js'
import { progress, fail } from './log.js'

/**
 * Check whether any of the given URLs exposes a runtime with a "revive" pallet.
 *
 * Uses a raw `state_getMetadata` JSON-RPC call and SCALE-decodes the response
 * with `@polkadot/types` — no ApiPromise or WsProvider involved.
 *
 * @param {string[]} urls - WebSocket URLs to try (first success wins).
 * @returns {Promise<boolean>} `true` when a "revive" pallet is found.
 */
export async function checkSupportsContracts(urls) {
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        try {
            progress(url, i + 1, urls.length)
            const raw = await jsonRpcCall(url, 'state_getMetadata')

            const registry = new TypeRegistry()
            const metadata = new Metadata(registry, raw)
            registry.setMetadata(metadata)

            const pallets = metadata.asLatest.pallets.map(p => p.name.toString().toLowerCase())
            const hasRevive = pallets.includes('revive') || pallets.some(n => n.includes('revive'))
            return !!hasRevive
        } catch (e) {
            fail(`${url}: ${e.message}`)
        }
    }
    return false
}
