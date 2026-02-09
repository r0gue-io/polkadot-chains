// ANSI escape helpers (zero dependencies)
const esc = (code, text) => `\x1b[${code}m${text}\x1b[0m`
const bold = text => esc('1', text)
const dim = text => esc('2', text)
const underline = text => esc('4', text)
const green = text => esc('32', text)
const red = text => esc('31', text)
const yellow = text => esc('33', text)
const cyan = text => esc('36', text)
const boldRed = text => bold(red(text))
const boldCyan = text => bold(cyan(text))

// Internal counters
const stats = { alive: 0, dead: 0, contracts: 0, skipped: 0 }

export function bumpStat(key, n = 1) {
    stats[key] = (stats[key] || 0) + n
}

export function header(text) {
    console.log(`\n${underline(boldCyan(text))}\n`)
}

export function progress(url, attempt, maxAttempts) {
    console.log(dim(`  \u2192 ${url} (${attempt}/${maxAttempts})`))
}

export function success(msg) {
    console.log(green(`  \u2714 ${msg}`))
}

export function fail(msg) {
    console.log(red(`  \u2718 ${msg}`))
}

export function warn(msg) {
    console.log(yellow(`  \u26A0 ${msg}`))
}

export function error(msg) {
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
