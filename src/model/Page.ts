import Element from './Element'
import BaseElement from './BaseElement'
import Text from './Text'
import {ElementId, ElementType} from './Types'

type Properties = { style?: string }

function createElement(elementType: ElementType, newIdSeq: number) {
    const id = `${elementType.toLowerCase()}_${newIdSeq}`
    const name = `${elementType} ${newIdSeq}`
    return new Text(id, name, {contentExpr: '"Your text here"'})
}

export default class Page extends BaseElement<Properties> implements Element {

    constructor(
        id: ElementId,
        name: string,
        properties: Properties,
        elements: ReadonlyArray<Element>
    ) {
        super(id, name, properties, elements)
    }

    kind: ElementType = 'Page'

    static is(element: Element): element is Page {
        return element.constructor.name === this.name
    }

    get style() { return this.properties.style }

    insert(selectedItemId: ElementId, elementType: ElementType, newIdSeq: number): [Page, Element | null] {
        let insertIndex = -1
        if (selectedItemId === this.id) {
            insertIndex = 0
        }

        const selectedItemIndex = this.elementArray().findIndex( it => it.id === selectedItemId)
        if (selectedItemIndex >= 0) {
            insertIndex = selectedItemIndex + 1
        }

        if (insertIndex !== -1) {
            const newElements = [...this.elementArray()]
            const newElement = createElement(elementType, newIdSeq)
            newElements.splice(insertIndex, 0, newElement)
            return [this.create(this.id, this.name, this.properties, newElements), newElement]
        }
        return [this, null]
    }
}