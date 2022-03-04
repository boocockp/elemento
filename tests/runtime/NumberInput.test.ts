/**
 * @jest-environment jsdom
 */

import {createElement} from 'react'
import NumberInput from '../../src/runtime/NumberInput'
import {snapshot, testContainer} from '../testutil/testHelpers'
import userEvent from '@testing-library/user-event'
import {stateProxy, useStore} from '../../src/runtime/appData'

test('NumberInput element produces output with properties supplied',
    snapshot(createElement(NumberInput, {state: stateProxy('app.page1.width', {value: 27}), label: 'Width'}))
)

test('NumberInput element produces output with default values where properties omitted',
    snapshot(createElement(NumberInput, {state: stateProxy('app.page1.height', {value: 0})}))
)

test('NumberInput shows value from the state supplied', () => {
    let container = testContainer(createElement(NumberInput, {state: stateProxy('app.page1.widget1', {value: 27})}))
    expect(container.querySelector('input[id="app.page1.widget1"]').value).toBe('27')
})

test('NumberInput element produces output with properties supplied as state objects', () => {
    let container = testContainer(createElement(NumberInput, {
        state: stateProxy('app.page1.widget1', {value: 27}),
        label: stateProxy('path.x', {value: 'Item Number'})
    }))
    expect(container.querySelector('label[for="app.page1.widget1"]').innerHTML).toBe('Item Number')
})

test('NumberInput shows empty value when state value is absent', () => {
    let container = testContainer(createElement(NumberInput, {state: stateProxy('app.page1.widget1', {}, {defaultValue: 0})}))
    expect(container.querySelector('input[id="app.page1.widget1"]').value).toBe('')
})

test('NumberInput shows empty value when state value is set to undefined', () => {
    let container = testContainer(createElement(NumberInput, {state: stateProxy('app.page1.widget1', {value: undefined}, {defaultValue: 0})}))
    expect(container.querySelector('input[id="app.page1.widget1"]').value).toBe('')
})

test('NumberInput shows initial value when state value is set to undefined and initial value exists', () => {
    let container = testContainer(createElement(NumberInput, {state: stateProxy('app.page1.widget1', {value: undefined}, {defaultValue: 0, value: 99})}))
    expect(container.querySelector('input[id="app.page1.widget1"]').value).toBe('99')
})

test('NumberInput shows empty value when state value is set to null and initial value exists', () => {
    let container = testContainer(createElement(NumberInput, {state: stateProxy('app.page1.widget1', {value: null}, {defaultValue: 0, value: 99})}))
    expect(container.querySelector('input[id="app.page1.widget1"]').value).toBe('')
})

test('NumberInput stores updated values in the app store section for its path', async () => {
    let container = testContainer(createElement(NumberInput, {state: stateProxy('app.page1.sprocket', {value: 27}, {defaultValue: 0})}))
    const inputEl = container.querySelector('input[id="app.page1.sprocket"]')
    const user = userEvent.setup()
    await user.type(inputEl, '6')
    expect((useStore.getState() as any).app.page1.sprocket).toStrictEqual({value: 276})
    //expect(inputEl.value).toBe('66')
} )

test('NumberInput stores null value in the app store when cleared', async () => {
    let container = testContainer(createElement(NumberInput, {state: stateProxy('app.page1.sprocket', {value: 27})}))
    const inputEl = container.querySelector('input[id="app.page1.sprocket"]')
    const user = userEvent.setup()
    await user.clear(inputEl)
    expect((useStore.getState() as any).app.page1.sprocket).toStrictEqual({value: null})
    //expect(inputEl.value).toBe('66')
} )
