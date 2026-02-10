// ANSI escape helpers (zero dependencies)
const esc = (code: string, text: string) => `\x1b[${code}m${text}\x1b[0m`
const bold = (text: string) => esc('1', text)
const dim = (text: string) => esc('2', text)
const green = (text: string) => esc('32', text)
const red = (text: string) => esc('31', text)
const yellow = (text: string) => esc('33', text)
const cyan = (text: string) => esc('36', text)
const boldCyan = (text: string) => bold(cyan(text))

export function warn(msg: string) {
    console.log(yellow(`  \u26A0 ${msg}`))
}

export function error(msg: string) {
    console.error(bold(red(msg)))
}

// ---------------------------------------------------------------------------
// In-place progress counter
// ---------------------------------------------------------------------------

export function createProgress(label: string, total: number) {
    let current = 0
    const width = String(total).length
    const write = (n: number) =>
        process.stdout.write(
            `\r  ${dim(`${label} ${'·'.repeat(3)} ${String(n).padStart(width)}/${total}`)}`,
        )

    write(0)
    return {
        tick() {
            current++
            write(current)
        },
        done() {
            write(total)
            process.stdout.write('\n')
        },
    }
}

// ---------------------------------------------------------------------------
// Report types & grouped display
// ---------------------------------------------------------------------------

export type ChainReport = {
    name: string
    isRelay: boolean
    relay?: string
    alive: number
    total: number
}

/**
 * Print liveness results grouped by relay ecosystem.
 *
 * Order: Polkadot > Kusama > Paseo > Westend > other relays > Solochains
 * Within each group: relay chain first, then parachains alphabetically.
 * Fully-dead chains (0 alive) are shown with a red cross.
 */
export function printLivenessReport(chains: ChainReport[]) {
    const groups = groupByRelay(chains)
    const preferred = ['polkadot', 'kusama', 'paseo', 'westend']

    const sortedKeys = [...groups.keys()].sort((a, b) => {
        if (a === 'solochains') return 1
        if (b === 'solochains') return -1
        const ai = preferred.indexOf(a)
        const bi = preferred.indexOf(b)
        if (ai >= 0 && bi >= 0) return ai - bi
        if (ai >= 0) return -1
        if (bi >= 0) return 1
        return a.localeCompare(b)
    })

    for (const key of sortedKeys) {
        const group = groups.get(key)!

        // Sort: relay first, then by alive/dead, then alphabetically
        group.sort((a, b) => {
            if (a.isRelay !== b.isRelay) return a.isRelay ? -1 : 1
            const aUp = a.alive > 0
            const bUp = b.alive > 0
            if (aUp !== bUp) return aUp ? -1 : 1
            return localName(a.name, a.relay).localeCompare(localName(b.name, b.relay))
        })

        const title = key === 'solochains' ? 'Solochains' : titleCase(key)
        const aliveInGroup = group.filter(c => c.alive > 0).length
        console.log(
            `\n  ${boldCyan(title)} ${dim(`(${aliveInGroup}/${group.length} chains up)`)}\n`,
        )

        const maxLen = Math.max(...group.map(c => localName(c.name, c.relay).length))

        for (const chain of group) {
            const display = localName(chain.name, chain.relay).padEnd(maxLen + 2)
            const count = `${chain.alive}/${chain.total}`
            if (chain.alive > 0) {
                console.log(`    ${green('\u2714')} ${display} ${dim(count)}`)
            } else {
                console.log(`    ${red('\u2718')} ${dim(display)} ${dim(count)}`)
            }
        }
    }
}

/**
 * Print chains that support contracts (revive pallet).
 */
export function printContractsReport(names: string[]) {
    if (names.length === 0) return
    console.log(`\n  ${boldCyan('Contracts')}\n`)
    for (const name of names.sort()) {
        console.log(`    ${green('\u2714')} ${name}`)
    }
}

/**
 * Print final summary block.
 */
export function printSummary(stats: {
    chains: number
    alive: number
    dead: number
    contracts: number
    skipped: number
}) {
    const line = '\u2500'.repeat(48)
    console.log(`\n  ${dim(line)}`)
    console.log(`  ${bold('Summary')}`)
    console.log(`  ${dim(line)}`)
    console.log(`    Chains       ${bold(String(stats.chains))}`)
    console.log(
        `    Endpoints    ${green(String(stats.alive))} alive ${dim('\u00b7')} ${red(String(stats.dead))} dead`,
    )
    console.log(`    Contracts    ${green(String(stats.contracts))}`)
    if (stats.skipped > 0) {
        console.log(`    Skipped      ${yellow(String(stats.skipped))}`)
    }
    console.log(`  ${dim(line)}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByRelay(chains: ChainReport[]): Map<string, ChainReport[]> {
    const map = new Map<string, ChainReport[]>()
    for (const chain of chains) {
        const key = chain.relay
            ? normalize(chain.relay)
            : chain.isRelay
              ? normalize(chain.name)
              : 'solochains'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(chain)
    }
    return map
}

function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(/\s*relay\s*$/i, '')
        .trim()
}

function localName(fullName: string, relay?: string): string {
    if (relay && fullName.startsWith(`${relay} | `)) {
        return fullName.slice(relay.length + 3)
    }
    return fullName
}

function titleCase(s: string): string {
    return s.replace(/\b\w/g, c => c.toUpperCase())
}
