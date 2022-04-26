import {ElementId, ElementType} from '../model/Types'

export type AppElementAction = 'delete'
export type OnOpenFn = () => void
export type OnSaveFn = () => void
export type OnPublishFn = (args: {name: string, code: string}) => void
export type OnChangeFn = (id: ElementId, propertyName: string, value: any) => void
export type OnInsertFn = (elementType: ElementType) => void
export type OnInsertWithSelectedFn = (selectedItemId: ElementId, elementType: ElementType) => ElementId
export type OnActionFn = (id: ElementId, action: AppElementAction) => void
export type MenuItemFn = () => void
