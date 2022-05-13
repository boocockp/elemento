import TextInput from '../../src/model/TextInput'
import Page from '../../src/model/Page'
import {asJSON, ex} from '../testutil/testHelpers'
import {loadJSON} from '../../src/model/loadJSON'

test('TextInput shows get values from properties', ()=> {
    const textInput = new TextInput('t1', 'Text Input 1', {initialValue: ex`"Some text"`, maxLength: ex`5`, multiline: true, width: 10, label: ex`Text One`})

    expect(textInput.id).toBe('t1')
    expect(textInput.name).toBe('Text Input 1')
    expect(textInput.codeName).toBe('TextInput1')
    expect(textInput.initialValue).toStrictEqual(ex`"Some text"`)
    expect(textInput.maxLength).toStrictEqual(ex`5`)
    expect(textInput.multiline).toBe(true)
    expect(textInput.width).toBe(10)
    expect(textInput.label).toStrictEqual(ex`Text One`)
})

test('TextInput does not allow codeName to be same as class name', ()=> {
    const textInput = new TextInput('t1', 'Text Input', {})

    expect(textInput.id).toBe('t1')
    expect(textInput.name).toBe('Text Input')
    expect(textInput.codeName).toBe('TextInput_t1')
})

test('TextInput has default values', ()=> {
    const textInput = new TextInput('t1', 'Text Input 1', {})

    expect(textInput.id).toBe('t1')
    expect(textInput.name).toBe('Text Input 1')
    expect(textInput.initialValue).toBeUndefined()
    expect(textInput.maxLength).toBeUndefined()
    expect(textInput.multiline).toBeUndefined()
    expect(textInput.width).toBeUndefined()
    expect(textInput.label).toBe(`Text Input 1`)
    expect(textInput.properties.label).toBeUndefined()
})

test('tests if an object is this type', ()=> {
    const textInput = new TextInput('t1', 'Text Input 1', {initialValue: ex`"Some text"`})
    const page = new Page('p1', 'Page 1', {}, [])

    expect(TextInput.is(textInput)).toBe(true)
    expect(TextInput.is(page)).toBe(false)
})

test('creates an updated object with a property set to a new value', ()=> {
    const textInput = new TextInput('t1', 'Text Input 1', {initialValue: ex`"Some text"`})
    const updated = textInput.set('t1', 'name', 'Text 1A')
    expect(updated.name).toBe('Text 1A')
    expect(updated.initialValue).toStrictEqual(ex`"Some text"`)
    expect(textInput.name).toBe('Text Input 1')
    expect(textInput.initialValue).toStrictEqual(ex`"Some text"`)

    const updated2 = updated.set('t1', 'initialValue', `shazam`)
    expect(updated2.name).toBe('Text 1A')
    expect(updated2.initialValue).toStrictEqual(`shazam`)
    expect(updated.name).toBe('Text 1A')
    expect(updated.initialValue).toStrictEqual(ex`"Some text"`)
})

test('ignores the set and returns itself if the id does not match', ()=> {
    const textInput = new TextInput('t1', 'Text Input 1', {initialValue: ex`"Some text"`})
    const updated = textInput.set('x1', 'name', 'Text 1A')
    expect(updated).toBe(textInput)
})

test('converts to JSON', ()=> {
    const text = new TextInput('t1', 'Text Input 1', {initialValue: ex`"Some text"`, maxLength: ex`10`, multiline: true, label: ex`"The Text"`})
    expect(asJSON(text)).toStrictEqual({
        kind: 'TextInput',
        componentType: 'statefulUI',
        id: 't1',
        name: 'Text Input 1',
        properties: text.properties
    })

    const text2 = new TextInput('t1', 'Text Input 2', {initialValue: `Some text`, maxLength: 10, multiline: true, label: 'The Text'})
    expect(asJSON(text2)).toStrictEqual({
        kind: 'TextInput',
        componentType: 'statefulUI',
        id: 't1',
        name: 'Text Input 2',
        properties: text2.properties
    })
})

test('converts from plain object', ()=> {
    const textInput = new TextInput('t1', 'Text Input 1', {initialValue: ex`"Some text"`, maxLength: ex`10`, multiline: true, })
    const plainObj = asJSON(textInput)
    const newObj = loadJSON(plainObj)
    expect(newObj).toStrictEqual<TextInput>(textInput)

    const textInput2 = new TextInput('t1', 'Text Input 1', {initialValue: `Some text`, maxLength: 10, multiline: true, label: 'The Text'})
    const plainObj2 = asJSON(textInput2)
    const newObj2 = loadJSON(plainObj2)
    expect(newObj2).toStrictEqual<TextInput>(textInput2)
})