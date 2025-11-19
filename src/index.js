import {createWsEndpoints} from '@polkadot/apps-config'
import * as fs from 'node:fs'
import {URL} from 'node:url'
import WebSocket from 'ws'
import {ApiPromise, WsProvider} from "@polkadot/api";

async function testWebSocketConnection(url, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url)
        const timeout = setTimeout(() => {
            socket.terminate()
            reject(new Error('WebSocket connection timeout'))
        }, timeoutMs)

        socket.on('open', () => {
            clearTimeout(timeout)
            socket.close()
            resolve(true)
        })

        socket.on('error', err => {
            clearTimeout(timeout)
            reject(err)
        })
    })
}

async function jsonRpcHealth(url, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url)
        const msg = JSON.stringify({id: 1, jsonrpc: '2.0', method: 'system_health', params: []})
        let answered = false

        const timeout = setTimeout(() => {
            if (!answered) {
                try {
                    socket.terminate()
                } catch {
                }
            }
            reject(new Error('JSON-RPC health timeout'))
        }, timeoutMs)

        socket.on('open', () => {
            try {
                socket.send(msg)
            } catch (e) {
                clearTimeout(timeout)
                reject(e)
            }
        })

        socket.on('message', () => {
            // Any JSON-RPC response counts as alive
            answered = true
            clearTimeout(timeout)
            try {
                socket.close()
            } catch {
            }
            resolve(true)
        })

        socket.on('error', err => {
            clearTimeout(timeout)
            reject(err)
        })

        socket.on('close', () => {
            if (!answered) {
                clearTimeout(timeout)
                reject(new Error('Connection closed before response'))
            }
        })
    })
}

async function checkSupportsContracts(urls) {
    let provider = null
    let api = null
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`)

            // Test WebSocket connection first
            await testWebSocketConnection(url)

            provider = new WsProvider(url, false)
            await provider.connect()
            await provider.isReady
            api = await ApiPromise.create({provider})
            await api.isReady
            const pallets = api.runtimeMetadata.asLatest.pallets.map(p =>
                p.name.toString().toLowerCase(),
            )
            const hasRevive = pallets.includes('revive') || pallets.some(n => n.includes('revive'))
            return !!hasRevive
        } catch (e) {
            console.error(`Failure checking ${url}: ${e.message}`)
        } finally {
            await Promise.all([api?.disconnect(), provider?.disconnect()])
            console.log(`Disconnected from ${url}...`)
        }
    }
    return false
}

async function checkEndpointAlive(url) {
    try {
        console.log(`Checking ${url}...`)
        // Basic WS connectivity
        await testWebSocketConnection(url)
        // JSON-RPC ping for liveness
        const ok = await jsonRpcHealth(url)
        if (ok) return true
    } catch (e) {
        console.error(`Failure checking ${url}: ${e.message}`)
    }
    return false
}

function sortEndpoints(a, b) {
    // Helper: lowercase safely
    const lc = s => (s || '').toLowerCase()

    // Normalize relay group names, e.g. "Polkadot Relay" -> "polkadot"
    const normalizeRelayName = s => {
        const x = lc(s).trim()
        // strip a trailing "relay" token
        return x.replace(/\s*relay\s*$/i, '').trim()
    }

    // Determine relay group for an item
    // - For parachains: use the 'relay' field (normalized)
    // - For relay chains: use their own name (normalized)
    // - For solochains: null (no group)
    const groupOf = item => {
        if (item.isRelay) return normalizeRelayName(item.name)
        if (item.relay) return normalizeRelayName(item.relay)
        return null
    }

    const aGroup = groupOf(a)
    const bGroup = groupOf(b)

    // Preferred relay groups order (normalized values)
    const preferred = ['polkadot', 'kusama', 'paseo', 'westend']
    const rankOf = g => {
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
        const byGroupName = aGroup.localeCompare(bGroup)
        if (byGroupName !== 0) return byGroupName
    }

    // 3) Within the same relay group, relay chain first, then parachains alphabetically by local name
    if (a.isRelay !== b.isRelay) return a.isRelay ? -1 : 1
    return a.name.localeCompare(b.name)
}

async function main() {
    const result = {}
    const rawEndpoints = createWsEndpoints().filter(({value}) => !!value)

    await Promise.all(rawEndpoints.map(async ({value, isRelay, textRelay, text}) => {
        let name = text
        if (!!textRelay) {
            name = `${textRelay} | ${name}`
        }
        if (!result[name]) {
            result[name] = {
                providers: new Set(),
                isRelay: false,
            }
        }

        try {
            new URL(value)
            if (value.startsWith('wss://') && !value.match(/^wss?:\/\/\d+$/) && await checkEndpointAlive(value)) {
                result[name].providers.add(value)
            }
        } catch (e) {
            console.warn(`Invalid URL: ${value}`)
        }
        if (isRelay) {
            result[name].isRelay = true
        }
        if (textRelay) {
            result[name].relay = textRelay
        }
    }))

    // Finalize providers arrays, filter by health and check metadata for each entry
    const entries = Object.entries(result)
    const batchSize = 10
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize)
        await Promise.all(
            batch.map(async ([key, value]) => {
                value.providers = [...value.providers]
                if (value.providers.length === 0) {
                    delete result[key]
                } else {
                    try {
                        value.supportsContracts = await checkSupportsContracts(value.providers)
                    } catch (e) {
                        console.error('Error checking supportsContracts:', e)
                        value.supportsContracts = false
                    }
                }
            }),
        )
    }

    const finalList = Object.entries(result)
        .map(([key, value]) => ({
            name: key,
            ...value,
        }))
        .sort(sortEndpoints)
        .map(obj => {
            obj.providers.sort()
            return obj
        })

    // Finally, write the final list into a file
    fs.writeFileSync('endpoints.json', JSON.stringify(finalList, null, 2))
}

try {
    await main()
} catch (e) {
    console.error('Failed to build endpoints:', e)
    process.exitCode = 1
}
