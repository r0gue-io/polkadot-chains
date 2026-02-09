#!/bin/bash

set -ex

bun add @polkadot/apps-config@latest
bun install

# Check if there are any changes
if ! git diff --quiet; then
  bun run build
  echo "DONE"
else
  echo "NO CHANGES"
fi
