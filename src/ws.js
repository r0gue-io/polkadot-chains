import WebSocket from 'ws'
import { progress, fail } from './log.js'

/**
 * Test basic WebSocket connectivity by opening and immediately closing.
 * @param {string} url - WebSocket URL to test.
 * @param {number} [timeoutMs=60000] - Connection timeout in milliseconds.
 * @returns {Promise<boolean>} Resolves `true` when the handshake succeeds.
 */
export async function testWebSocketConnection(url, timeoutMs = 60000) {
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

/**
 * Send a `system_health` JSON-RPC call and resolve when any response arrives.
 * @param {string} url - WebSocket URL.
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds.
 * @returns {Promise<boolean>} Resolves `true` when the node responds.
 */
export async function jsonRpcHealth(url, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url)
        const msg = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'system_health', params: [] })
        let answered = false

        const timeout = setTimeout(() => {
            if (!answered) {
                try {
                    socket.terminate()
                } catch {}
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
            } catch {}
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

/**
 * Execute a generic JSON-RPC call over a short-lived WebSocket connection.
 * @param {string} url - WebSocket URL.
 * @param {string} method - JSON-RPC method name.
 * @param {Array} [params=[]] - JSON-RPC params.
 * @param {number} [timeoutMs=30000] - Timeout in milliseconds.
 * @returns {Promise<any>} The `result` field from the JSON-RPC response.
 */
export async function jsonRpcCall(url, method, params = [], timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url)
        const msg = JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })
        let answered = false

        const timeout = setTimeout(() => {
            if (!answered) {
                try {
                    socket.terminate()
                } catch {}
            }
            reject(new Error(`JSON-RPC ${method} timeout`))
        }, timeoutMs)

        socket.on('open', () => {
            try {
                socket.send(msg)
            } catch (e) {
                clearTimeout(timeout)
                reject(e)
            }
        })

        socket.on('message', data => {
            answered = true
            clearTimeout(timeout)
            try {
                socket.close()
            } catch {}
            try {
                const parsed = JSON.parse(data.toString())
                if (parsed.error) {
                    reject(
                        new Error(
                            `JSON-RPC error: ${parsed.error.message || JSON.stringify(parsed.error)}`,
                        ),
                    )
                } else {
                    resolve(parsed.result)
                }
            } catch (e) {
                reject(e)
            }
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

/**
 * Compound liveness check: WS handshake + JSON-RPC system_health.
 * Retries up to {@link maxAttempts} times before giving up.
 * @param {string} url - WebSocket URL to check.
 * @param {number} [maxAttempts=3] - Total attempts before discarding.
 * @returns {Promise<boolean>} `true` when the endpoint is alive.
 */
export async function checkEndpointAlive(url, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            progress(url, attempt, maxAttempts)
            await testWebSocketConnection(url)
            const ok = await jsonRpcHealth(url)
            if (ok) return true
        } catch (e) {
            fail(`${url} (${attempt}/${maxAttempts}): ${e.message}`)
        }
    }
    return false
}
