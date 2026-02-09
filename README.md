# Polkadot Chains

A tiny utility to build a comprehensive RPC endpoint list for Polkadot networks. It reads, processes, and filters
WebSocket endpoints from the `@polkadot/apps-config` package and generates a structured JSON output.

## Prerequisites

- Node.js (LTS recommended)
- Bun

## Installation

- Clone this repository
- Install dependencies:
    - bun install

## Usage

- Generate the endpoints file:
    - bun run build
    - bun run start
- Output file:
    - endpoints.json (created/overwritten in the project root)

## Architecture

| Module             | Responsibility                                                |
| ------------------ | ------------------------------------------------------------- |
| `src/index.ts`     | Entry point — orchestration only                              |
| `src/ws.ts`        | WebSocket utilities: connectivity tests, raw JSON-RPC calls   |
| `src/metadata.ts`  | Contract detection via raw `state_getMetadata` + SCALE decode |
| `src/sort.ts`      | Endpoint sorting comparator                                   |
| `src/endpoints.ts` | Endpoint loading and filtering from `@polkadot/apps-config`   |

## What the script does

- Loads the list of WS endpoints from `@polkadot/apps-config` (createWsEndpoints).
- Filters entries and keeps only valid WebSocket URLs.
- Excludes endpoints whose host is a raw numeric IP (e.g., wss://12.34.56.78), to prefer domain-based hosts.
- Groups endpoints by network/relay and de-duplicates provider URLs for each entry.
- Checks each provider for liveness (batched): performs a basic WS handshake and a lightweight JSON-RPC `system_health`
  call; only healthy providers are kept.
- For each remaining entry, issues a raw `state_getMetadata` JSON-RPC call and decodes the SCALE response with
  `@polkadot/types` to read runtime metadata; sets `supportsContracts` to true when a pallet named (or containing) "
  revive" is present.
- Sorts the final list smartly:
    - Grouped by relay, with preferred relay order: Polkadot, Kusama, Paseo, Westend.
    - Other relay groups follow, ordered alphabetically by relay name.
    - Solochains (no relay) come last, ordered alphabetically.
    - Within each relay group, the relay chain appears first, followed by its parachains sorted alphabetically by their
      local name.
- Writes the final structured list to endpoints.json.

## Output format

`endpoints.json` is a JSON array. Each item has the following shape:

- `name`: human-friendly name. For parachains, the format is typically "Relay | Parachain".
- `providers`: array of unique, healthy WebSocket endpoint URLs (string[]). Only endpoints that respond to a basic
  liveness check are included.
- `isRelay`: boolean indicating whether the entry is a relay network.
- `relay`: optional string name of the relay, when available.
- `supportsContracts`: boolean set true when the chain's runtime contains a pallet whose name is or contains "revive" (
  derived via on-chain metadata).

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
- Entries with no responding providers are omitted entirely.
- Liveness is checked per provider using a basic WebSocket handshake followed by a lightweight JSON-RPC call (
  system_health), in batches (default batch size = 10).
- The `supportsContracts` field is computed via a raw `state_getMetadata` JSON-RPC call, decoded with`@polkadot/types` (
  no ApiPromise/WsProvider needed).

## Updating data

This project sources endpoints from the `@polkadot/apps-config` NPM package. To refresh the list, update the dependency
and rebuild:

- bun update @polkadot/apps-config
- bun run build

You can also use the helper script if present:

- ./upgrade.sh

## Scripts

- bun run build — compiles TypeScript
- bun run start — runs the compiled script to write endpoints.json
- bun run format — formats the repository with Prettier
- bun run format:check — checks formatting without writing changes
- bun run typecheck — runs TypeScript type checks without emitting

## License

ISC
