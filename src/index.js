import * as fs from 'node:fs'
import { checkEndpointAlive } from './ws.js'
import { checkSupportsContracts } from './metadata.js'
import { sortEndpoints } from './sort.js'
import { loadEndpoints } from './endpoints.js'
import { header, success, fail, error, summary, bumpStat } from './log.js'

async function main() {
    const result = {}
    const endpoints = loadEndpoints()

    header('Liveness checks')

    // Check liveness for every endpoint URL in parallel
    await Promise.all(
        endpoints.map(async ({ name, url, isRelay, relay }) => {
            if (!result[name]) {
                result[name] = {
                    providers: new Set(),
                    isRelay: false,
                }
            }

            const alive = await checkEndpointAlive(url)
            if (alive) {
                success(`${name} \u2014 ${url}`)
                bumpStat('alive')
                result[name].providers.add(url)
            } else {
                fail(`${name} \u2014 ${url}`)
                bumpStat('dead')
            }

            if (isRelay) {
                result[name].isRelay = true
            }
            if (relay) {
                result[name].relay = relay
            }
        }),
    )

    header('Metadata checks')

    // Finalize providers arrays and check metadata for each entry (batched)
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
                        if (value.supportsContracts) {
                            success(`${key}: contracts supported`)
                            bumpStat('contracts')
                        }
                    } catch (e) {
                        error(`Error checking supportsContracts for ${key}: ${e.message}`)
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

    summary()

    // Finally, write the final list into a file
    fs.writeFileSync('endpoints.json', JSON.stringify(finalList, null, 2))
}

try {
    await main()
} catch (e) {
    error(`Failed to build endpoints: ${e.message}`)
    process.exitCode = 1
}
