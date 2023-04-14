import type LocalForage from 'localforage'

import NodeFs from 'fs'
import NodePath from 'path'

import { CID } from 'multiformats'
import { CryptoSystem, HashAlg, KeyUse } from 'keystore-idb/types.js'
import KeystoreConfig from 'keystore-idb/config.js'
import IDB from 'keystore-idb/idb.js'
import RSAKeys from 'keystore-idb/rsa/keys.js'
import RSAKeyStore from 'keystore-idb/rsa/keystore.js'

import * as DagPB from '@ipld/dag-pb'
import * as Raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'

import * as Auth from '@oddjs/odd/components/auth/implementation'
import * as Crypto from '@oddjs/odd/components/crypto/implementation'
import * as Capabilities from '@oddjs/odd/components/capabilities/implementation'
import * as Depot from '@oddjs/odd/components/depot/implementation'
import * as Reference from '@oddjs/odd/components/reference/implementation'
import * as Storage from '@oddjs/odd/components/storage/implementation'

import * as BaseReference from '@oddjs/odd/components/reference/implementation/base'
import * as BrowserCrypto from '@oddjs/odd/components/crypto/implementation/browser'
import * as MemoryStorage from '@oddjs/odd/components/storage/implementation/memory'
import * as ProperManners from '@oddjs/odd/components/manners/implementation/base'
import * as WnfsAuth from '@oddjs/odd/components/auth/implementation/wnfs'

import * as Codecs from '@oddjs/odd/dag/codecs'
import * as DID from '@oddjs/odd/did/index'

import { CodecIdentifier } from '@oddjs/odd/dag/codecs'
import { Components } from '@oddjs/odd/components'
import { Configuration } from '@oddjs/odd/configuration'
import { Ucan } from '@oddjs/odd/ucan/types'
import { decodeCID, EMPTY_CID } from '@oddjs/odd/common/cid'
import { Storage as LocalForageStore } from './localforage/in-memory-storage.js'

const configuration: Configuration = {
    namespace: { name: 'ODD SDK Tests', creator: 'Fission' },
    debug: false,
    fileSystem: {
        loadImmediately: false
    },
}

// CRYPTO

async function createCryptoComponent (): Promise<Crypto.Implementation> {
    const cfg = KeystoreConfig.normalize({
        type: CryptoSystem.RSA,

        charSize: 8,
        hashAlg: HashAlg.SHA_256,
        storeName: 'tests',
        exchangeKeyName: 'exchange-key',
        writeKeyName: 'write-key',
    })

    const { rsaSize, hashAlg, /* storeName, */ exchangeKeyName, writeKeyName } = cfg
    const store = new LocalForageStore() as unknown as LocalForage

    // NOTE: This would be a more type safe solution,
    //       but somehow localforage won't accept the driver.
    // await store.defineDriver(memoryDriver)
    // const store = localforage.createInstance({ name: storeName, driver: memoryDriver._driver })

    await IDB.createIfDoesNotExist(exchangeKeyName, () => (
        RSAKeys.makeKeypair(rsaSize, hashAlg, KeyUse.Exchange)
    ), store)
    await IDB.createIfDoesNotExist(writeKeyName, () => (
        RSAKeys.makeKeypair(rsaSize, hashAlg, KeyUse.Write)
    ), store)

    const ks = new RSAKeyStore(cfg, store)

    return {
        aes: BrowserCrypto.aes,
        did: BrowserCrypto.did,
        hash: BrowserCrypto.hash,
        misc: BrowserCrypto.misc,
        rsa: BrowserCrypto.rsa,

        keystore: {
            clearStore: () => BrowserCrypto.ksClearStore(ks),
            decrypt: (...args) => BrowserCrypto.ksDecrypt(ks, ...args),
            exportSymmKey: (...args) => BrowserCrypto.ksExportSymmKey(ks, ...args),
            getAlgorithm: (...args) => BrowserCrypto.ksGetAlgorithm(ks, ...args),
            getUcanAlgorithm: (...args) => BrowserCrypto.ksGetUcanAlgorithm(ks, ...args),
            importSymmKey: (...args) => BrowserCrypto.ksImportSymmKey(ks, ...args),
            keyExists: (...args) => BrowserCrypto.ksKeyExists(ks, ...args),
            publicExchangeKey: (...args) => BrowserCrypto.ksPublicExchangeKey(ks, ...args),
            publicWriteKey: (...args) => BrowserCrypto.ksPublicWriteKey(ks, ...args),
            sign: (...args) => BrowserCrypto.ksSign(ks, ...args),
        },
    }
}

const crypto = await createCryptoComponent()

// DEPOT

export const inMemoryDepot: Record<string, Uint8Array> = {}

const depot: Depot.Implementation = {
    // Get the data behind a CID
    getBlock: (cid: CID) => {
        const data = inMemoryDepot[cid.toString()]
        if (!data) throw new Error('CID not stored in depot')
        return Promise.resolve(data)
    },
    getUnixFile: (cid: CID) => depot.getBlock(cid),
    getUnixDirectory: async (cid: CID) => {
        const dag = DagPB.decode(await depot.getBlock(cid))

        // Not technically correct but might be good enough for testing?
        return dag.Links.map(link => ({
            cid: link.Hash,
            name: link.Name || '',
            size: link.Tsize || 0,
            isFile: link.Hash.code === Raw.code
        }))
    },

    // Keep data around
    putBlock: async (data: Uint8Array, codecId: CodecIdentifier) => {
        const codec = Codecs.getByIdentifier(codecId)
        const multihash = await sha256.digest(data)
        const cid = CID.createV1(codec.code, multihash)

        inMemoryDepot[cid.toString()] = data

        return cid
    },
    putChunked: async (data: Uint8Array) => {
    // Not sure what the max size is here, this might not work.
    // Might need to use https://github.com/ipfs/js-ipfs-unixfs/tree/master/packages/ipfs-unixfs-importer instead.
        const multihash = await sha256.digest(data)
        const cid = CID.createV1(Raw.code, multihash)

        inMemoryDepot[cid.toString()] = data

        return {
            cid,
            size: data.length,
            isFile: true
        }
    },

    // Stats
    size: async (cid: CID) => {
        const data = await depot.getBlock(cid)
        return data.length
    }
}

// // STORAGE

const storage: Storage.Implementation = MemoryStorage.implementation()

// MANNERS

const manners = {
    ...ProperManners.implementation({ configuration }),

    wnfsWasmLookup: async () => {
        const pathToThisModule = new URL(import.meta.url).pathname
        const dirOfThisModule = NodePath.parse(pathToThisModule).dir
        return NodeFs.readFileSync(NodePath.join(dirOfThisModule, '../../node_modules/wnfs/wasm_wnfs_bg.wasm'))
    }
}

// // REFERENCE

const baseReference = await BaseReference.implementation({
    crypto, manners, storage
})

const inMemoryReference = {
    dataRoot: decodeCID(EMPTY_CID)
}

const reference: Reference.Implementation = {
    ...baseReference,

    dataRoot: {
        domain: () => 'localhost',
        lookup: () => Promise.resolve(inMemoryReference.dataRoot),
        update: (cid: CID, proof: Ucan) => { inMemoryReference.dataRoot = cid; return Promise.resolve({ success: true }) }
    },
    didRoot: {
        lookup: () => DID.write(crypto)
    },
}

// CAPABILITIES

const capabilities: Capabilities.Implementation = {
    collect: () => { throw new Error('Not implemented') },
    request: (options: Capabilities.RequestOptions) => { throw new Error('Not implemented') },
}

// AUTH

const auth: Auth.Implementation<Components> = WnfsAuth.implementation({
    crypto, reference, storage
})

// export const username = 'test'
// export const account = {
//     rootDID: await reference.didRoot.lookup(username),
//     username
// }

// // 🛳

const components = {
    auth,
    capabilities,
    crypto,
    depot,
    manners,
    reference,
    storage
}

export {
    components
//     auth,
//     capabilities,
//     crypto,
//     depot,
//     manners,
//     reference,
//     storage
}
