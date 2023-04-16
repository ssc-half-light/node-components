import * as BrowserCrypto from '@oddjs/odd/components/crypto/implementation/browser'
// import { components } from '../dist/index.js'
import * as odd from '@oddjs/odd'
import { test } from 'tapzero'
// const storage = wn.storage.memory()
const storage = odd.storage.memory()
const config = {
    namespace: { creator: 'test', name: 'testing' },
    debug: true
}
const components = await odd.compositions.fission({
    ...config,
    // @ts-ignore
    crypto: createCryptoComponent(),
    storage
})

test('components', async t => {
    const program = await odd.assemble({
        namespace: { creator: 'test', name: 'testing' },
        debug: true
    }, components)

    t.ok(program, 'should create a program')
})

function createCryptoComponent () {
    const {
        aes,
        did,
        hash,
        misc,
        rsa,
    } = BrowserCrypto

    return {
        aes,
        did,
        hash,
        misc,
        rsa,

        // We're avoiding having to implement all of this,
        // because we're not using it anyway.
        // ---
        // One way to actually implement this would be to
        // set up the keystore-idb library to use an in-memory
        // store instead of indexedDB. There's an example in
        // the Webnative tests.
        keystore: {
            clearStore: boom,
            decrypt: boom,
            exportSymmKey: boom,
            getAlgorithm: boom,
            getUcanAlgorithm: boom,
            importSymmKey: boom,
            keyExists: boom,
            publicExchangeKey: boom,
            publicWriteKey: boom,
            sign: boom,
        }
    }
}

function boom () {
    throw new Error('Method not implemented')
}
