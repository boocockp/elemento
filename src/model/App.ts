import Page from './Page';
import Element from './Element'
import BaseElement from './BaseElement'
import {ElementId, ElementType, PropertyValue} from './Types'
import { createElement } from './createElement';

type Properties = { author?: PropertyValue }

export default class App extends BaseElement<Properties> implements Element {
    constructor(
        id: ElementId,
        name: string,
        properties: Properties,
        elements: ReadonlyArray<Element>
    ) {
        super(id, name, properties, elements)
    }

    kind = 'App' as ElementType
    get pages() {return this.elements as Page[]}


    createElement(elementType: ElementType, newIdSeq: number): Element {
        return createElement(elementType, newIdSeq)
    }

    insert(selectedItemId: ElementId, elementType: ElementType): [App, Element] {
        return this.doInsert(selectedItemId, elementType) as [App, Element]
    }

    canContain(elementType: ElementType) {
        return elementType === 'Page'
    }
}
