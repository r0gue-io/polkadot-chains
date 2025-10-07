import {createWsEndpoints} from "@polkadot/apps-config";
import * as fs from "node:fs";
import {URL} from "node:url";


const result = {}
const rawEndpoints = createWsEndpoints().filter(({value}) => !!value)
rawEndpoints.forEach(({value, isRelay, textRelay, text}) => {
    let name = text
    if (!!textRelay) {
        name = `${name} - ${textRelay}`
    }
    if (!result[name]) {
        result[name] = {
            providers: new Set(),
            isRelay: false,
        }
    }

    try {
        new URL(value);
        if (!value.match(/wss?:\/\/\d+/)) {
            result[name].providers.add(value)
        }
    } catch (e) {
        console.warn(`Invalid URL: ${value}`);
    }
    if (isRelay) {
        result[name].isRelay = true
    }
    if (textRelay) {
        result[name].relay = textRelay
    }
})

for (const [key, value] of Object.entries(result)) {
    if (value.providers.size === 0) {
        delete result[key]
    } else {
        value.providers = [...value.providers]
    }
}

fs.writeFileSync("endpoints.json", JSON.stringify(result, null, 2))
