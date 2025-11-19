#!/bin/bash

set -ex

yarn add @polkadot/apps-config@latest
yarn install

# Check if there are any changes
if ! git diff --quiet; then
  yarn run build
  echo "DONE"
else
  echo "NO CHANGES"
fi
