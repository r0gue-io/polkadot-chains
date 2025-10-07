#!/bin/bash

set -ex

TODAY=$(date +%d-%m-%Y)
yarn install
yarn upgrade @polkadot/apps-config

# Check if there are any changes
if ! git diff --quiet; then
    yarn run build
    git add -A
    git commit -m "Updated ${TODAY}"
    git push
fi
