import type { EndpointOutput } from './types.js'

/**
 * Sort comparator for endpoint entries.
 *
 * Ordering:
 * 1. Relay-grouped chains before solochains.
 * 2. Preferred relay groups first (Polkadot > Kusama > Paseo > Westend),
 *    then remaining relay groups alphabetically.
 * 3. Within a relay group, the relay chain comes first, then parachains
 *    sorted alphabetically by name.
 * 4. Solochains sorted alphabetically.
 */
export function sortEndpoints(
    a: Pick<EndpointOutput, 'name' | 'isRelay' | 'relay'>,
    b: Pick<EndpointOutput, 'name' | 'isRelay' | 'relay'>,
): number {
    // Helper: lowercase safely
    const lc = (s: string | undefined) => (s || '').toLowerCase()

    // Normalize relay group names, e.g. "Polkadot Relay" -> "polkadot"
    const normalizeRelayName = (s: string | undefined) => {
        const x = lc(s).trim()
        // strip a trailing "relay" token
        return x.replace(/\s*relay\s*$/i, '').trim()
    }

    // Determine relay group for an item
    // - For parachains: use the 'relay' field (normalized)
    // - For relay chains: use their own name (normalized)
    // - For solochains: null (no group)
    const groupOf = (item: Pick<EndpointOutput, 'name' | 'isRelay' | 'relay'>) => {
        if (item.isRelay) return normalizeRelayName(item.name)
        if (item.relay) return normalizeRelayName(item.relay)
        return null
    }

    const aGroup = groupOf(a)
    const bGroup = groupOf(b)

    // Preferred relay groups order (normalized values)
    const preferred = ['polkadot', 'kusama', 'paseo', 'westend']
    const rankOf = (g: string | null) => {
        const idx = preferred.indexOf(g || '')
        return idx >= 0 ? idx : preferred.length // non-preferred relay groups after preferred
    }

    // 1) Relay-grouped items before solochains
    const aHasGroup = !!aGroup
    const bHasGroup = !!bGroup
    if (aHasGroup !== bHasGroup) return aHasGroup ? -1 : 1

    // If both are solochains, sort alphabetically by name and finish
    if (!aHasGroup && !bHasGroup) {
        return lc(a.name).localeCompare(lc(b.name))
    }

    // 2) Among grouped items, order by preferred relay group, then by relay name alphabetically for others
    const aRank = rankOf(aGroup)
    const bRank = rankOf(bGroup)
    if (aRank !== bRank) return aRank - bRank
    if (aRank === preferred.length) {
        // both non-preferred: order by relay group name
        const byGroupName = (aGroup || '').localeCompare(bGroup || '')
        if (byGroupName !== 0) return byGroupName
    }

    // 3) Within the same relay group, relay chain first, then parachains alphabetically by local name
    if (a.isRelay !== b.isRelay) return a.isRelay ? -1 : 1
    return a.name.localeCompare(b.name)
}
