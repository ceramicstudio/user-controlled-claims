import axios from 'axios'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import invariant from 'tiny-invariant'
import type { Attestation, AttestationResult, EASChainConfig, EnsNamesResult, MyAttestationResult } from './types'


export const alchemyApiKey = process.env.REACT_APP_ALCHEMY_API_KEY


export const CUSTOM_SCHEMAS = {
  TRUST_SCHEMA: '0x212cc37b82e80169d444cecddec7d76774cc6dfa4423d33307eab01715dc5efe'
}

dayjs.extend(duration)
dayjs.extend(relativeTime)

function getChainId() {
  return Number('1')
}

export const CHAINID = getChainId()
invariant(CHAINID, 'No chain ID env found')

export const EAS_CHAIN_CONFIGS: EASChainConfig[] = [
  {
    chainId: 1,
    chainName: 'Ethereum',
    subdomain: 'mainnet',
    version: '0.26',
    contractAddress: '0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587',
    schemaRegistryAddress: '0xA7b39296258348C78294F95B872b282326A97BDF',
    etherscanURL: 'https://etherscan.io/',
    contractStartBlock: 2958570,
    rpcProvider: `https://eth.meowrpc.com`,
  },
]

export const activeChainConfig = EAS_CHAIN_CONFIGS.find((config) => config.chainId === CHAINID)

// export const baseURL = `https://${activeChainConfig.subdomain}easscan.org`

invariant(activeChainConfig, 'No chain config found for chain ID')
export const EASContractAddress = activeChainConfig.contractAddress

export const EASVersion = activeChainConfig.version

export const EAS_CONFIG = {
  address: EASContractAddress,
  version: EASVersion,
  chainId: CHAINID,
}

export const timeFormatString = 'MM/DD/YYYY h:mm:ss a'
export const baseURL = `https://${activeChainConfig!.subdomain}easscan.org`

export async function getAttestation(uid: string) {
  const response = await axios.post<AttestationResult>(
    `${baseURL}/graphql`,
    {
      query:
        'query Query($where: AttestationWhereUniqueInput!) {\n  attestation(where: $where) {\n    id\n    attester\n    recipient\n    revocationTime\n    expirationTime\n    time\n    txid\n    data\n  }\n}',
      variables: {
        where: {
          id: uid,
        },
      },
    },
    {
      headers: {
        'content-type': 'application/json',
      },
    }
  )
  return response.data.data.attestation
}
export async function getAttestationsForAddress(address: string) {
  const response = await axios.post<MyAttestationResult>(
    `${baseURL}/graphql`,
    {
      query:
        'query Attestations($where: AttestationWhereInput, $orderBy: [AttestationOrderByWithRelationInput!]) {\n  attestations(where: $where, orderBy: $orderBy) {\n    attester\n    revocationTime\n    expirationTime\n    time\n    recipient\n    id\n    data\n  }\n}',

      variables: {
        where: {
          schemaId: {
            equals: CUSTOM_SCHEMAS.TRUST_SCHEMA,
          },
          OR: [
            {
              attester: {
                equals: address,
              },
            },
            {
              recipient: {
                equals: address,
              },
            },
          ],
        },
        orderBy: [
          {
            time: 'desc',
          },
        ],
      },
    },
    {
      headers: {
        'content-type': 'application/json',
      },
    }
  )
  return response.data.data.attestations
}
export async function getConfirmationAttestationsForUIDs(refUids: string[]) {
  const response = await axios.post<MyAttestationResult>(
    `${baseURL}/graphql`,
    {
      query:
        'query Attestations($where: AttestationWhereInput, $orderBy: [AttestationOrderByWithRelationInput!]) {\n  attestations(where: $where, orderBy: $orderBy) {\n    attester\n    revocationTime\n    expirationTime\n    time\n    recipient\n    id\n    data\n  refUID\n  }\n}',

      variables: {
        where: {
          schemaId: {
            equals: CUSTOM_SCHEMAS.TRUST_SCHEMA,
          },
          refUID: {
            in: refUids,
          },
        },
        orderBy: [
          {
            time: 'desc',
          },
        ],
      },
    },
    {
      headers: {
        'content-type': 'application/json',
      },
    }
  )
  return response.data.data.attestations
}
export async function getENSNames(addresses: string[]) {
  const response = await axios.post<EnsNamesResult>(
    `${baseURL}/graphql`,
    {
      query: 'query Query($where: EnsNameWhereInput) {\n  ensNames(where: $where) {\n    id\n    name\n  }\n}',
      variables: {
        where: {
          id: {
            in: addresses,
            mode: 'insensitive',
          },
        },
      },
    },
    {
      headers: {
        'content-type': 'application/json',
      },
    }
  )
  return response.data.data.ensNames
}
