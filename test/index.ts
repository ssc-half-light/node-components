import { components } from '../dist/index.js'
import * as odd from '@oddjs/odd'
import { test } from 'tapzero'

test('components', async t => {
    const program = await odd.assemble({
        namespace: { creator: 'test', name: 'testing' },
        debug: true
    }, components)

    t.ok(program, 'should create a program')
})
