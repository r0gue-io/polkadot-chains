import WebSocket, { type RawData } from 'ws'
import { progress, fail } from './log.js'

const toErrorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Test basic WebSocket connectivity by opening and immediately closing.
 * @param url - WebSocket URL to test.
 * @param timeoutMs - Connection timeout in milliseconds.
 */
export async function testWebSocketConnection(url: string, timeoutMs = 60000): Promise<boolean> {
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

        socket.on('error', (err: Error) => {
            clearTimeout(timeout)
            reject(err)
        })
    })
}

/**
 * Send a `system_health` JSON-RPC call and resolve when any response arrives.
 * @param url - WebSocket URL.
 * @param timeoutMs - Timeout in milliseconds.
 */
export async function jsonRpcHealth(url: string, timeoutMs = 5000): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url)
        const msg = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'system_health', params: [] })
        let answered = false

        const timeout = setTimeout(() => {
            if (!answered) {
                try {
                    socket.terminate()
                } catch {
                    // ignore
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
                // ignore
            }
            resolve(true)
        })

        socket.on('error', (err: Error) => {
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
 * @param url - WebSocket URL.
 * @param method - JSON-RPC method name.
 * @param params - JSON-RPC params.
 * @param timeoutMs - Timeout in milliseconds.
 */
export async function jsonRpcCall(
    url: string,
    method: string,
    params: unknown[] = [],
    timeoutMs = 30000,
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url)
        const msg = JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })
        let answered = false

        const timeout = setTimeout(() => {
            if (!answered) {
                try {
                    socket.terminate()
                } catch {
                    // ignore
                }
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

        socket.on('message', (data: RawData) => {
            answered = true
            clearTimeout(timeout)
            try {
                socket.close()
            } catch {
                // ignore
            }
            try {
                const parsed = JSON.parse(data.toString())
                if (parsed?.error) {
                    reject(
                        new Error(
                            `JSON-RPC error: ${parsed.error.message || JSON.stringify(parsed.error)}`,
                        ),
                    )
                } else {
                    resolve(parsed?.result)
                }
            } catch (e) {
                reject(e)
            }
        })

        socket.on('error', (err: Error) => {
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
 * @param url - WebSocket URL to check.
 * @param maxAttempts - Total attempts before discarding.
 */
export async function checkEndpointAlive(url: string, maxAttempts = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            progress(url, attempt, maxAttempts)
            await testWebSocketConnection(url)
            const ok = await jsonRpcHealth(url)
            if (ok) return true
        } catch (e) {
            fail(`${url} (${attempt}/${maxAttempts}): ${toErrorMessage(e)}`)
        }
    }
    return false
}
