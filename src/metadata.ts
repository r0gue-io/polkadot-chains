import type { Registry } from '@polkadot/types/types'
import { jsonRpcCall } from './ws.js'

/**
 * Check whether any of the given URLs exposes a runtime with a "revive" pallet.
 *
 * Uses a raw `state_getMetadata` JSON-RPC call and SCALE-decodes the response
 * with `@polkadot/types` — no ApiPromise or WsProvider involved.
 */
export async function checkSupportsContracts(urls: string[]): Promise<boolean> {
    // Dynamic import — module is cached after the first call
    const origWarn = console.warn
    console.warn = () => {}
    const { TypeRegistry, Metadata } = await import('@polkadot/types')
    console.warn = origWarn

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        try {
            const raw = await jsonRpcCall(url, 'state_getMetadata')

            if (typeof raw !== 'string' || !raw.startsWith('0x')) {
                throw new Error('Metadata response is not a hex string')
            }

            const registry = new TypeRegistry() as unknown as Registry
            const metadata = new Metadata(registry, raw as `0x${string}`)
            registry.setMetadata(metadata)

            const pallets = metadata.asLatest.pallets.map(p => p.name.toString().toLowerCase())
            const hasRevive = pallets.includes('revive') || pallets.some(n => n.includes('revive'))
            return hasRevive
        } catch {
            // Silently try next provider
        }
    }
    return false
}
