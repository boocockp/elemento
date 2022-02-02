import BaseElement from './BaseElement'
import Element from './Element'
import {ElementId, ElementType} from './Types'

export type Properties = {
    readonly initialValue?: string,
    readonly maxLength?: string,  //expression
    readonly label?: string
}
export default class TextInput extends BaseElement<Properties> implements Element {

    constructor(
        id: ElementId,
        name: string,
        properties: Properties) {
        super(id, name, properties)
    }

    static is(element: Element): element is TextInput {
        return element.constructor.name === this.name
    }

    kind: ElementType = 'TextInput'


    get initialValue() { return this.properties.initialValue }
    get maxLength() { return this.properties.maxLength }
    get label() { return this.properties.label }
}