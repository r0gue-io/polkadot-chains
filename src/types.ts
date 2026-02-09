/**
 * Raw endpoint item loaded from @polkadot/apps-config after filtering.
 */
export type EndpointInput = {
    name: string
    url: string
    isRelay: boolean
    relay?: string
}

/**
 * In-memory build shape while de-duping providers and computing metadata.
 */
export type EndpointBuild = {
    providers: Set<string>
    isRelay: boolean
    relay?: string
    supportsContracts?: boolean
}

/**
 * Final serialized endpoint shape written to endpoints.json.
 */
export type EndpointOutput = {
    name: string
    providers: string[]
    isRelay: boolean
    relay?: string
    supportsContracts?: boolean
}
