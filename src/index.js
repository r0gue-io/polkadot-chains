import {createWsEndpoints} from '@polkadot/apps-config'
import {ApiPromise, WsProvider} from '@polkadot/api'
import * as fs from 'node:fs'
import {URL} from 'node:url'
import WebSocket from 'ws'


async function testWebSocketConnection(url, timeoutMs = 5000) {
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

        socket.on('error', (err) => {
            clearTimeout(timeout)
            reject(err)
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
            const pallets = api.runtimeMetadata.asLatest.pallets.map((p) => p.name.toString().toLowerCase())
            const hasRevive = pallets.includes('revive') || pallets.some((n) => n.includes('revive'))
            return !!hasRevive
        } catch (e) {
            console.error(`Failure checking ${url}: ${e.message}`)
        } finally {
            await Promise.all([
                api?.disconnect(),
                provider?.disconnect(),
            ])
            console.log(`Disconnected from ${url}...`)
        }
    }

    return false
}

async function main() {
    const result = {}
    const rawEndpoints = createWsEndpoints().filter(({value}) => !!value)

    rawEndpoints.forEach(({value, isRelay, textRelay, text}) => {
        let name = text
        if (!!textRelay) {
            name = `${name} - ${textRelay}`
        }
        if (!result[name]) {
            result[name] = {
                providers: new Set(),
                isRelay: false
            }
        }

        try {
            new URL(value)
            if (value.startsWith('wss://') && !value.match(/^wss?:\/\/\d+$/)) {
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
    })

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
            })
        )
    }

    fs.writeFileSync('endpoints.json', JSON.stringify(result, null, 2))
}

// Run
try {
    await main()
} catch (e) {
    console.error('Failed to build endpoints:', e)
    process.exitCode = 1
}
