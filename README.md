# template ts
Components for node js

## install
```
npm install @ssc-hermes/node-components
```

## test this
Run them separately because there is a type error in `index.ts`.

```bash
npm run build
```
```bash
npm test
```

## example

```js
// this runs in node js
import { components } from '@ssc-hermes/node-components'
import * as odd from '@oddjs/odd'

const program = odd.assemble({
    namespace: { creator: 'test', name: 'testing' },
    debug: true
}, components)
```
