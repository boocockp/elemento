import {createElement} from '../../src/model/createElement'
import Text from '../../src/model/Text'
import TextInput from '../../src/model/TextInput'

test('creates elements of correct type', () => {
    expect(createElement('Text', 2)).toBeInstanceOf(Text)
    expect(createElement('TextInput', 2)).toBeInstanceOf(TextInput)
})

test('creates elements with next sequence number in lowercase id', ()=> {
    const element = createElement('TextInput', 2)
    expect(element.id).toBe('textinput_2')
})

test('creates elements with next sequence number in start case name', ()=> {
    const element = createElement('TextInput', 2)
    expect(element.name).toBe('Text Input 2')
})