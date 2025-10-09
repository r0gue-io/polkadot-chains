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
- Groups endpoints by network/relay and de-duplicates provider URLs for each entry.
- Probes a subset of providers (batched) to check WebSocket health and inspects runtime metadata to flag feature support.
- Sorts the final list smartly:
  - Grouped by relay, with preferred relay order: Polkadot, Kusama, Paseo, Westend.
  - Other relay groups follow, ordered alphabetically by relay name.
  - Solochains (no relay) come last, ordered alphabetically.
  - Within each relay group, the relay chain appears first, followed by its parachains sorted alphabetically by their local name.
- Writes the final structured list to endpoints.json.

## Output format

`endpoints.json` is a JSON array. Each item has the following shape:

- `name`: human-friendly name. For parachains, the format is typically "Relay | Parachain".
- `providers`: array of unique WebSocket endpoint URLs (string[]).
- `isRelay`: boolean indicating whether the entry is a relay network.
- `relay`: optional string name of the relay, when available.
- `supportsContracts`: boolean set based on runtime metadata probing. Currently true when a pallet whose name includes "revive" is found; otherwise false.

Example excerpt:

```json
[
  {
    "name": "Polkadot",
    "providers": ["wss://rpc.polkadot.io", "wss://polkadot.api.onfinality.io/public-ws"],
    "isRelay": true,
    "supportsContracts": false
  },
  {
    "name": "Polkadot | Asset Hub",
    "providers": ["wss://polkadot-asset-hub-rpc.polkadot.io"],
    "isRelay": false,
    "relay": "Polkadot",
    "supportsContracts": true
  },
  {
    "name": "Kusama",
    "providers": ["wss://kusama-rpc.polkadot.io"],
    "isRelay": true,
    "supportsContracts": false
  }
]
```

Notes:

- Invalid URLs (cannot be parsed) are ignored.
- Providers hosted at a raw IP (matching `wss?:\/\/\d+`) are ignored.
- Empty provider sets are discarded entirely.
- Network probing is done in batches to avoid overwhelming endpoints (default batch size = 10). Each provider is first
  tested for WebSocket connectivity before attempting to create an API instance.
- The supportsContracts flag is experimental and derived from runtime metadata; adapt or rename as your needs evolve.

## Updating data

This project sources endpoints from the `@polkadot/apps-config` NPM package. To refresh the list, update the dependency
and rebuild:

- yarn upgrade @polkadot/apps-config
- yarn run build

You can also use the helper script if present:

- ./upgrade.sh

## Scripts

- yarn build — runs node src/index.js and writes endpoints.json
- yarn format — formats the repository with Prettier
- yarn format:check — checks formatting without writing changes

## License

ISC
