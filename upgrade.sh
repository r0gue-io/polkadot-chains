#!/bin/bash

set -e

bun add @polkadot/apps-config@latest
bun install

# Check if there are any changes
if ! git diff --quiet; then
  bun run build
  bun run start
  echo "DONE"
else
  echo "NO CHANGES"
fi

bun run build
bun run start
