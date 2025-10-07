# Polkadot Chains

A tiny utility to build a comprehensive RPC endpoint list for Polkadot networks. It reads, processes, and filters
WebSocket endpoints from the `@polkadot/apps-config` package and generates a structured JSON output.

## Prerequisites

- Node.js (LTS recommended)
- Yarn (v1)

## Installation

- Clone this repository
- Install dependencies:
    - yarn install

## Usage

- Generate the endpoints file:
    - yarn run build
- Output file:
    - endpoints.json (created/overwritten in the project root)

## What the script does

- Loads the list of WS endpoints from `@polkadot/apps-config` (createWsEndpoints).
- Filters entries and keeps only valid WebSocket URLs.
- Excludes endpoints whose host is a raw numeric IP (e.g., wss://12.34.56.78), to prefer domain-based hosts.
- Groups endpoints by network name, optionally adding the relay name when present (e.g., "Polkadot - Kusama")
- For each group, collects a unique set of provider URLs and records whether it is a relay.
- Writes a compact JSON map to endpoints.json.

## Output format

endpoints.json is a JSON object keyed by a human-friendly network name (and relay, if any). Each value has:

- providers: array of unique WebSocket endpoint URLs (string[])
- isRelay: boolean indicating whether the entry is a relay network
- relay: optional string name of the relay, when available

Example excerpt:

{
"Polkadot": {
"providers": [
"wss://rpc.polkadot.io",
"wss://polkadot.api.onfinality.io/public-ws"
],
"isRelay": false
},
"Kusama": {
"providers": [
"wss://kusama-rpc.polkadot.io"
],
"isRelay": false
},
"Asset Hub - Polkadot": {
"providers": [
"wss://polkadot-asset-hub-rpc.polkadot.io"
],
"isRelay": true,
"relay": "Polkadot"
}
}

Notes:

- Invalid URLs (cannot be parsed) are ignored.
- Providers hosted at a raw IP (matching `wss?:\/\/\d+`) are ignored.
- Empty provider sets are discarded entirely.

## Updating data

This project sources endpoints from the `@polkadot/apps-config` NPM package. To refresh the list, update the dependency
and rebuild:

- yarn upgrade @polkadot/apps-config
- yarn run build

## Scripts

- yarn build — runs node src/index.js and writes endpoints.json

## License

ISC
