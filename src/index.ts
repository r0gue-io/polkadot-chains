import * as fs from 'node:fs'
import { checkEndpointAlive } from './ws.js'
import { checkSupportsContracts } from './metadata.js'
import { sortEndpoints } from './sort.js'
import { loadEndpoints } from './endpoints.js'
import {
    createProgress,
    printLivenessReport,
    printContractsReport,
    printSummary,
    error,
} from './log.js'
import type { ChainReport } from './log.js'
import type { EndpointOutput } from './types.js'

type ChainData = {
    isRelay: boolean
    relay?: string
    total: number
    alive: string[]
    supportsContracts: boolean
}

async function main() {
    const { endpoints, skipped } = await loadEndpoints()

    // Build per-chain map
    const chains: Record<string, ChainData> = {}
    for (const ep of endpoints) {
        if (!chains[ep.name]) {
            chains[ep.name] = {
                isRelay: ep.isRelay,
                relay: ep.relay,
                total: 0,
                alive: [],
                supportsContracts: false,
            }
        }
        chains[ep.name].total++
        if (ep.isRelay) chains[ep.name].isRelay = true
        if (ep.relay) chains[ep.name].relay = ep.relay
    }

    // ── Liveness checks ────────────────────────────────────────────────
    const liveProgress = createProgress('Checking liveness', endpoints.length)
    await Promise.all(
        endpoints.map(async ({ name, url }) => {
            const alive = await checkEndpointAlive(url)
            if (alive) chains[name].alive.push(url)
            liveProgress.tick()
        }),
    )
    liveProgress.done()

    // Display grouped liveness report
    const reports: ChainReport[] = Object.entries(chains).map(([name, data]) => ({
        name,
        isRelay: data.isRelay,
        relay: data.relay,
        alive: data.alive.length,
        total: data.total,
    }))
    printLivenessReport(reports)

    // ── Metadata checks (alive chains only) ────────────────────────────
    const aliveChains = Object.entries(chains).filter(([, data]) => data.alive.length > 0)
    const metaProgress = createProgress('Checking metadata', aliveChains.length)
    const contractNames: string[] = []

    const batchSize = 10
    for (let i = 0; i < aliveChains.length; i += batchSize) {
        const batch = aliveChains.slice(i, i + batchSize)
        await Promise.all(
            batch.map(async ([name, data]) => {
                try {
                    data.supportsContracts = await checkSupportsContracts(data.alive)
                    if (data.supportsContracts) contractNames.push(name)
                } catch {
                    data.supportsContracts = false
                }
                metaProgress.tick()
            }),
        )
    }
    metaProgress.done()

    printContractsReport(contractNames)

    // ── Summary ────────────────────────────────────────────────────────
    let totalAlive = 0
    let totalDead = 0
    for (const data of Object.values(chains)) {
        totalAlive += data.alive.length
        totalDead += data.total - data.alive.length
    }

    printSummary({
        chains: aliveChains.length,
        alive: totalAlive,
        dead: totalDead,
        contracts: contractNames.length,
        skipped,
    })

    // ── Write output ───────────────────────────────────────────────────
    const finalList: EndpointOutput[] = aliveChains
        .map(([name, data]) => ({
            name,
            providers: data.alive.sort(),
            isRelay: data.isRelay,
            relay: data.relay,
            supportsContracts: data.supportsContracts,
        }))
        .sort(sortEndpoints)

    fs.writeFileSync('endpoints.json', JSON.stringify(finalList, null, 2))
}

try {
    await main()
} catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    error(`Failed to build endpoints: ${message}`)
    process.exitCode = 1
}
