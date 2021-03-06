import Element from './Element'
import BaseElement from './BaseElement'
import {ComponentType, ElementId, ElementType, PropertyValueType} from './Types'
import {createElement} from './createElement'

type Properties = { horizontal?: PropertyValueType<boolean>, width?: PropertyValueType<number | string>, wrap?: PropertyValueType<boolean> }

export default class Layout extends BaseElement<Properties> implements Element {

    constructor(
        id: ElementId,
        name: string,
        properties: Properties,
        elements: ReadonlyArray<Element>
    ) {
        super(id, name, 'Layout', properties, elements)
    }

    static is(element: Element): element is Layout {
        return element.constructor.name === this.name
    }

    type(): ComponentType { return 'statelessUI' }

    isLayoutOnly() { return true }

    get horizontal() { return this.properties.horizontal ?? false }
    get width() { return this.properties.width }
    get wrap() { return this.properties.wrap ?? false }

    canContain(elementType: ElementType) {
        return !['Project', 'App', 'AppBar', 'Page', 'MemoryDataStore', 'FileDataStore'].includes(elementType)
    }

}