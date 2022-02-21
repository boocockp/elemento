import BaseElement from './BaseElement'
import Element from './Element'
import {ElementId, PropertyValue} from './Types'

export type Properties = {
    readonly initialValue?: PropertyValue,
    readonly label?: PropertyValue
}
export default class TrueFalseInput extends BaseElement<Properties> implements Element {

    constructor(
        id: ElementId,
        name: string,
        properties: Properties) {
        super(id, name, properties)
    }

    static is(element: Element): element is TrueFalseInput {
        return element.constructor.name === this.name
    }

    get initialValue() { return this.properties.initialValue }
    get label() { return this.properties.label }
}