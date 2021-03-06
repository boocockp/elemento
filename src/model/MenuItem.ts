import {ComponentType, ElementId, PropertyExpr, PropertyValueType} from './Types'
import Element from './Element'
import BaseElement from './BaseElement'

type Properties = {
    readonly label?: PropertyValueType<string>,
    readonly action?: PropertyExpr,
    readonly display?: PropertyValueType<boolean>,
}

export default class MenuItem extends BaseElement<Properties> implements Element {
    constructor(
        id:  ElementId,
        name: string,
        properties: Properties
    ) {
        super(id, name, 'MenuItem', properties)
    }

    static is(element: Element): element is MenuItem {
        return element.constructor.name === this.name
    }

    type(): ComponentType { return 'statelessUI' }

    get label() {return this.properties.label ?? this.name}
    get action() {return this.properties.action}
    get display() {return this.properties.display}
}