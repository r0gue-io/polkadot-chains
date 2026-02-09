// ANSI escape helpers (zero dependencies)
const esc = (code: string, text: string) => `\x1b[${code}m${text}\x1b[0m`
const bold = (text: string) => esc('1', text)
const dim = (text: string) => esc('2', text)
const underline = (text: string) => esc('4', text)
const green = (text: string) => esc('32', text)
const red = (text: string) => esc('31', text)
const yellow = (text: string) => esc('33', text)
const cyan = (text: string) => esc('36', text)
const boldRed = (text: string) => bold(red(text))
const boldCyan = (text: string) => bold(cyan(text))

type StatKey = 'alive' | 'dead' | 'contracts' | 'skipped'

// Internal counters
const stats: Record<StatKey, number> = { alive: 0, dead: 0, contracts: 0, skipped: 0 }

export function bumpStat(key: StatKey, n = 1) {
    stats[key] = (stats[key] || 0) + n
}

export function header(text: string) {
    console.log(`\n${underline(boldCyan(text))}\n`)
}

export function progress(url: string, attempt: number, maxAttempts: number) {
    console.log(dim(`  \u2192 ${url} (${attempt}/${maxAttempts})`))
}

export function success(msg: string) {
    console.log(green(`  \u2714 ${msg}`))
}

export function fail(msg: string) {
    console.log(red(`  \u2718 ${msg}`))
}

export function warn(msg: string) {
    console.log(yellow(`  \u26A0 ${msg}`))
}

export function error(msg: string) {
    console.error(boldRed(msg))
}

export function summary() {
    const line = '-'.repeat(36)
    console.log(`\n${line}`)
    console.log(bold('  Summary'))
    console.log(line)
    console.log(`  Alive:     ${green(String(stats.alive))}`)
    console.log(`  Dead:      ${red(String(stats.dead))}`)
    console.log(`  Contracts: ${green(String(stats.contracts))}`)
    console.log(`  Skipped:   ${yellow(String(stats.skipped))}`)
    console.log(line)
}
