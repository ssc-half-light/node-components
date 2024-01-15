# node components
Components for node js, so you can run tests in node

## install
```
npm install -D @ssc-hermes/node-components
```

## test this
```bash
npm test
```

## example

### program

```js
// this runs in node js
import { components } from '@ssc-hermes/node-components'
import * as odd from '@oddjs/odd'

const program = await odd.assemble({
    namespace: { creator: 'test', name: 'testing' },
    debug: false  // must be false
}, components)
```

### createCryptoComponent

```js
import { createCryptoComponent } from '@ssc-hermes/node-components'
// use this anywhere that expects a crypto `Implementation`
const cryptoComponent = await createCryptoComponent()
```
