#!/bin/bash

set -ex

yarn install
yarn upgrade @polkadot/apps-config

# Check if there are any changes
if ! git diff --quiet; then
  yarn run build
  echo "DONE"
else
  echo "NO CHANGES"
fi
