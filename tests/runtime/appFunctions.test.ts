import appFunctions, {appFunctionsNames} from '../../src/runtime/appFunctions'
import {valObj} from '../testutil/testHelpers'

jest.mock('../../src/runtime/appData')

const mockFn = jest.fn()
const {Reset, Set, Update, Add, Remove, Get, GetAll} = appFunctions


beforeEach( ()=> jest.resetAllMocks() )

test('can get app functions names', () => {
    expect(appFunctionsNames()).toStrictEqual(['Reset', 'Set', 'Update', 'Add', 'Remove', 'Get', 'GetAll', 'NotifyError'])
})

test('Reset calls Reset on the target state of all arguments', () => {
    const elementState1 = {value: 42, Reset: jest.fn()}
    const elementState2 = {value: 43, Reset: jest.fn()}
    const elementState3 = {value: 44, Reset: jest.fn()}
    Reset(elementState1, elementState2, elementState3)
    expect(elementState1.Reset).toBeCalledWith()
    expect(elementState2.Reset).toBeCalledWith()
    expect(elementState3.Reset).toBeCalledWith()
})

describe('Set', () => {
    test('sets state at path to simple value', () => {
        const elementState = {value: 42, Set: mockFn}
        Set(elementState, 42)
        expect(elementState.Set).toBeCalledWith(42)
    })

    test('sets state at path to undefined', () => {
        const elementState = {value: 42, Set: mockFn}
        Set(elementState, undefined)
        expect(elementState.Set).toBeCalledWith(undefined)
    })

    test('sets state at path to object value', () => {
        const elementState = {value: {foo: 42}, Set: mockFn}
        const setValue = {a: 10, b: 'Bee'}
        Set(elementState, setValue)
        expect(elementState.Set).toBeCalledWith(setValue)
    })

    test('uses object value', () => {
        const elementState = {value: 42, Set: mockFn}
        Set(elementState, valObj(42))
        expect(elementState.Set).toBeCalledWith(42)
    })
})

describe('Update single item', () => {
    test('updates object state value', () => {
        const elementState = {value: {foo: 42}, Update: mockFn}
        const changes = {a: 10, b: 'Bee'}
        Update(elementState, changes)
        expect(elementState.Update).toBeCalledWith(changes)
    })
})

describe('Add', () => {

    test('adds an object with id', () => {
        const elementState = {value: {}, Add: mockFn}
        Add(elementState, {id: 'x3', a: 50, b: 'Bee'})
        expect(elementState.Add).toBeCalledWith({id: 'x3', a: 50, b: 'Bee'})
    })

    test('uses object value for id', () => {
        const elementState = {value: {}, Add: mockFn}
        Add(elementState, valObj('green'))
        expect(elementState.Add).toBeCalledWith('green')
    })
})

describe('Remove', () => {
    test('removes an object with id', () => {
        const elementState = {value: {}, Remove: mockFn}
        Remove(elementState, 'x3')
        expect(elementState.Remove).toBeCalledWith('x3')
    })

    test('uses object value for id', () => {
        const elementState = {value: {}, Remove: mockFn}
        Remove(elementState, valObj('x3'))
        expect(elementState.Remove).toBeCalledWith('x3')
    })

})

describe('Update item in collection', () => {
    const existingCollection = {}

    test('updates an object by id', () => {
        const elementState = {value: existingCollection, Update: mockFn}
        Update(elementState, 'x1', {a: 50, b: 'Bee'})
        expect(elementState.Update).toBeCalledWith('x1', {a: 50, b: 'Bee'})
    })

    test('uses object value for id', () => {
        const elementState = {value: existingCollection, Update: mockFn}
        Update(elementState, valObj('x1'), {a: 50, b: 'Bee'})
        expect(elementState.Update).toBeCalledWith('x1', {a: 50, b: 'Bee'})
    })
})

describe('Get', () => {
    const existingCollection = {}

    test('gets an object by id', () => {
        const elementState = {value: existingCollection, Get: mockFn.mockReturnValue({a: 50, b: 'Bee'})}
        const result = Get(elementState, 'x1')
        expect(result).toStrictEqual({a: 50, b: 'Bee'})
        expect(elementState.Get).toBeCalledWith('x1')
    })

    test('uses object value for id', () => {
        const elementState = {value: existingCollection, Get: mockFn.mockReturnValue({a: 50, b: 'Bee'})}
        const result = Get(elementState, valObj('x1'))
        expect(result).toStrictEqual({a: 50, b: 'Bee'})
        expect(elementState.Get).toBeCalledWith('x1')
    })
})

describe('GetAll', () => {
    test('gets all objects', () => {
        const elementState = {value: {}, GetAll: mockFn.mockReturnValue([{a: 50, b: 'Bee'}, {c: 30}])}
        const result = GetAll(elementState)
        expect(result).toStrictEqual([{a: 50, b: 'Bee'}, {c: 30}])
        expect(elementState.GetAll).toBeCalledWith()
    })
})