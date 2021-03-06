import {parse, print, types} from 'recast'
import {visit,} from 'ast-types'
import Topo from '@hapi/topo'

import App from '../model/App'
import Page from '../model/Page'
import Text from '../model/Text'
import Element from '../model/Element'
import TextInput from '../model/TextInput'
import {functionArgIndexes, globalFunctions} from '../runtime/globalFunctions'
import * as components from '../runtime/components'
import {appFunctionsNames} from '../runtime/appFunctions'
import UnsupportedValueError from '../util/UnsupportedValueError'
import {definedPropertiesOf, isExpr} from '../util/helpers'
import {ElementId, PropertyValue} from '../model/Types'
import Button from '../model/Button'
import NumberInput from '../model/NumberInput'
import SelectInput from '../model/SelectInput'
import TrueFalseInput from '../model/TrueFalseInput'
import List from '../model/List'
import {isArray, isPlainObject} from 'lodash'
import Data from '../model/Data'
import {Collection, FunctionDef} from '../model/index'
import MemoryDataStore from '../model/MemoryDataStore'
import FileDataStore from '../model/FileDataStore'
import Layout from '../model/Layout'
import AppBar from '../model/AppBar'
import {flatten, last, without} from 'ramda'
import {AppData} from '../runtime/components/App'
import Menu from '../model/Menu'
import MenuItem from '../model/MenuItem'

type IdentifierCollector = {add(s: string): void}
type FunctionCollector = {add(s: string): void}
type ExprType = 'singleExpression' | 'action' | 'multilineExpression'
interface ErrorCollector {
    add(elementId: ElementId, propertyName: string, error: string): void
}

function safeKey(name: string) { return name.match(/\W/) ? `'${name}'` : name}

function objectLiteralEntries(obj: object, suffixIfNotEmpty: string = '') {
    const entries = Object.entries(obj)
    return entries.length ? entries.map(([name, val]) => `${safeKey(name)}: ${val}`).join(', ') + suffixIfNotEmpty : ''
}

function objectLiteral(obj: object) {
    return `{${objectLiteralEntries(obj)}}`
}

const appFunctions = appFunctionsNames()
const appStateFunctions = Object.keys(new AppData({pages:{}})).filter( fnName => !['props', 'state'].includes(fnName))
const isComponent = (name: string) => name in components
const isGlobalFunction = (name: string) => name in globalFunctions
const isAppFunction = (name: string) => appFunctions.includes(name)
const isAppStateFunction = (name: string) => appStateFunctions.includes(name)
const isBuiltIn = (name: string) => ['undefined', 'null'].includes(name)
const isItemVar = (name: string) => name === '$item'
const trimParens = (expr?: string) => expr?.startsWith('(') ? expr.replace(/^\(|\)$/g, '') : expr
const indent = (codeBlock: string, indent: string) => codeBlock.split('\n').map( line => indent + line).join('\n')

class Ref {
    constructor(
        public ref: string
    ) {}
}

class DefinedFunction {
    constructor(public functionDef: string) {}
}

const valueLiteral = function (propertyValue: any): string {
    if (isPlainObject(propertyValue)) {
        return `{${Object.entries(propertyValue).map(([name, val]) => `${name}: ${valueLiteral(val)}`).join(', ')}}`
    } else if (isArray(propertyValue)) {
        return `[${propertyValue.map(valueLiteral).join(', ')}]`
    } else if (propertyValue instanceof Ref) {
        return propertyValue.ref
    } else if (typeof propertyValue === 'string') {
        return propertyValue.includes('\n') ? `\`${propertyValue}\`` : `'${propertyValue}'`
    } else {
        return String(propertyValue)
    }
}

type StateEntry = [name: string, code: string | DefinedFunction, dependencies: string[]]
const topoSort = (entries: StateEntry[]): StateEntry[] => {
    const sorter = new Topo.Sorter<StateEntry>()
    entries.forEach( entry => {
        const [name, code, dependencies] = entry
        sorter.add([entry], {after: dependencies, group: name})  // if add plain tuple, sorter treats it as an array
    })
    return sorter.nodes
}

class ListItem {
    constructor(public list: List) {}
    get id() { return this.list.id}
}


export function generate(app: App) {
    return new Generator(app).output()
}

export default class Generator {
    constructor(public app: App) {
    }

    output() {
        type ElementErrors = {[propertyName: string]: string}
        type AllErrors = {[elementId: ElementId]: ElementErrors}
        const errorCollector = {
            errors: {} as AllErrors,
            add(elementId: ElementId, propertyName: string, error: string) {
                if (!(elementId in this.errors)) {
                    this.errors[elementId] = {}
                }

                this.errors[elementId][propertyName] = error
            }
        }
        const pageFiles = this.app.pages.map( page => ({
            name: `${(page.codeName)}.js`,
            content: Generator.generateComponent(this.app, page, errorCollector)
        }))
        const appMainFile = {
            name: 'appMain.js',
            content: 'export default ' + Generator.generateComponent(this.app, this.app, errorCollector)
        }

        const imports = 'import React from \'react\'\nimport Elemento from \'elemento-runtime\'\n\n'
        return {
            files: [...pageFiles, appMainFile],
            errors: errorCollector.errors,
            get code() {
                return imports + this.files.map( f => `// ${f.name}\n${f.content}` ).join('\n')
            }
        }
    }

    private static allElements(component: Element | ListItem): Element[] {
        if (component instanceof App) {
            return flatten(component.otherComponents.map( el => [el, Generator.allElements(el)]))
        }
        if (component instanceof ListItem) {
            const childElements = component.list.elements || []
            return flatten(childElements.map( el => [el, Generator.allElements(el)]))
        }
        if (component instanceof List) {
            return []
        }

        const childElements = component.elements || []
        return flatten(childElements.map( el => [el, Generator.allElements(el)]))
    }

    private static generateComponent(app: App, component: Page | App | ListItem, errors: ErrorCollector, containingComponent?: Page) {
        const componentIsApp = component instanceof App
        const componentIsListItem = component instanceof ListItem
        const componentIsPage = component instanceof Page
        const identifierSet = new Set<string>()
        const topLevelFunctions = new Set<string>()
        const allPages = app.pages
        const allComponentElements = Generator.allElements(component)
        const allContainerElements = containingComponent ? Generator.allElements(containingComponent) : []
        const isAppElement = (name: string) => !!app.otherComponents.find( el => el.codeName === name )
        const isComponentElement = (name: string) => !!allComponentElements.find(el => el.codeName === name )
        const isContainerElement = (name: string) => !!allContainerElements.find(el => el.codeName === name )
        const isPageName = (name: string) => !!allPages.find(p => p.codeName === name )
        const isKnown = (name: string) => isGlobalFunction(name)
            || isAppFunction(name)
            || isAppStateFunction(name)
            || isComponentElement(name)
            || isPageName(name)
            || (/*componentIsListItem &&*/ isItemVar(name)) //TODO allow $item only in ListItem and predicates
            || isAppElement(name)
            || isContainerElement(name)
            || isBuiltIn(name)
        const uiElementCode = Generator.generateElement(component, app, identifierSet, topLevelFunctions, isKnown, errors, componentIsPage ? containingComponent : undefined)
        const identifiers = [...identifierSet.values()]

        const appStateFunctionIdentifiers = identifiers.filter(isAppStateFunction)
        const pages = componentIsApp ? `    const pages = {${allPages.map(p => p.codeName).join(', ')}}` : ''
        const appStateDeclaration = componentIsApp
            ? `    const app = Elemento.useObjectState('app', new App.State({pages}))`
            :  appStateFunctionIdentifiers.length ? `    const app = Elemento.useGetObjectState('app')` : ''
        const appStateFunctionDeclarations = appStateFunctionIdentifiers.length ? `    const {${appStateFunctionIdentifiers.join(', ')}} = app` : ''
        const componentIdentifiers = identifiers.filter(isComponent)
        const componentDeclarations = componentIdentifiers.length ? `    const {${componentIdentifiers.join(', ')}} = Elemento.components` : ''
        const globalFunctionIdentifiers = identifiers.filter(isGlobalFunction)
        const globalDeclarations = globalFunctionIdentifiers.length ? `    const {${globalFunctionIdentifiers.join(', ')}} = Elemento.globalFunctions` : ''
        const appFunctionIdentifiers = identifiers.filter(isAppFunction)
        const appFunctionDeclarations = appFunctionIdentifiers.length ? `    const {${appFunctionIdentifiers.join(', ')}} = Elemento.appFunctions` : ''

        let appLevelDeclarations
        if (!componentIsApp) {
            const appLevelIdentifiers = identifiers.filter(isAppElement)
            appLevelDeclarations = appLevelIdentifiers.map(ident => `    const ${ident} = Elemento.useGetObjectState('app.${ident}')`).join('\n')
        }
        let containerDeclarations
        if (containingComponent) {
            const containerIdentifiers = identifiers.filter(isContainerElement)
            containerDeclarations = containerIdentifiers.map(ident => `    const ${ident} = Elemento.useGetObjectState(parentPathWith('${ident}'))`).join('\n')
        }
        const elementoDeclarations = [componentDeclarations, globalDeclarations, pages, appStateDeclaration, appStateFunctionDeclarations, appFunctionDeclarations, appLevelDeclarations, containerDeclarations].filter( d => d !== '').join('\n').trimEnd()

        const statefulComponents = allComponentElements.filter( el => el.type() === 'statefulUI' || el.type() === 'background')
        const isStatefulComponentName = (name: string) => statefulComponents.find(comp => comp.codeName === name)
        const stateEntries = statefulComponents.map( (el): StateEntry => {
            const [entry, identifiers] = Generator.initialStateEntry(el, isKnown)
            const stateComponentIdentifiersUsed = identifiers.filter(isStatefulComponentName)
            return [el.codeName, entry, stateComponentIdentifiersUsed]
        }).filter( ([,entry]) => !!entry )
        const stateBlock = topoSort(stateEntries).map( ([name, entry]) => {
            const pathExpr = componentIsApp ? `'app.${name}'` : `pathWith('${name}')`
            return entry instanceof DefinedFunction
                ? `    const ${name} = ${entry.functionDef}`
                : `    const ${name} = Elemento.useObjectState(${pathExpr}, ${entry})`
        }).join('\n')

        const backgroundFixedComponents = componentIsApp ? component.otherComponents.filter(comp => comp.type() === 'backgroundFixed') : []
        const backgroundFixedDeclarations = backgroundFixedComponents.map( comp => {
            const [entry] = Generator.initialStateEntry(comp, isKnown)
            return `    const [${comp.codeName}] = React.useState(${entry})`
        }).join('\n')

        const pathWith = componentIsApp ? `    const pathWith = name => '${component.codeName}' + '.' + name`
                                        : `    const pathWith = name => props.path + '.' + name`
        const parentPathWith = containingComponent ? `    const parentPathWith = name => Elemento.parentPath(props.path) + '.' + name` : ''

        const extraDeclarations = component instanceof ListItem ? '    const {$item} = props' : ''
        const functionNamePrefix = containingComponent ? containingComponent.codeName + '_' : ''
        const functionName = functionNamePrefix + (component instanceof ListItem ? component.list.codeName + 'Item' : component.codeName)
        const declarations = [
            pathWith, parentPathWith, extraDeclarations, elementoDeclarations,
            backgroundFixedDeclarations, stateBlock
        ].filter( d => d !== '').join('\n')
        const componentFunction = `function ${functionName}(props) {
${declarations}

    return ${uiElementCode}
}
`.trimStart()
        return [...topLevelFunctions, componentFunction].join('\n\n')
    }

    private static generateElement(element: Element | ListItem, app: App, identifiers: IdentifierCollector, topLevelFunctions: FunctionCollector, isKnown: (name: string) => boolean, errors: ErrorCollector, containingComponent?: Page): string {

        const onError = (propertyName: string) => (err: string) => errors.add(element.id, propertyName, err)

        const pathWith = (name: string) => `pathWith('${name}')`

        const generateChildren = (element: Element, indent: string = '        ', containingComponent?: Page) => {
            const elementArray = element.elements ?? []
            const generatedUiElements = elementArray.map(p => Generator.generateElement(p, app, identifiers, topLevelFunctions, isKnown, errors, containingComponent))
            const generatedUiElementLines = generatedUiElements.filter(line => !!line).map(line => `${indent}${line},`)
            return generatedUiElementLines.join('\n')
        }

        if (element instanceof ListItem) {
             const children = element.list.elementArray().map(p => `        ${Generator.generateElement(p, app, identifiers, topLevelFunctions, isKnown, errors)},`).join('\n')

             return `React.createElement(React.Fragment, null,
${generateChildren(element.list, '        ')}
    )`
         }

        switch(element.kind) {
            case 'Project':
                throw new Error('Cannot generate code for Project')

            case 'App': {
                const app = element as App
                identifiers.add('App')
                const topChildrenElements = app.topChildren.map(p => `${Generator.generateElement(p, app, identifiers, topLevelFunctions, isKnown, errors)}`).filter(line => !!line.trim()).join(',\n')
                const topChildren = topChildrenElements.length ? `topChildren: React.createElement( React.Fragment, null, ${topChildrenElements})\n    ` : ''
                const bottomChildrenElements = app.bottomChildren.map(p => `        ${Generator.generateElement(p, app, identifiers, topLevelFunctions, isKnown, errors)}`).filter(line => !!line.trim()).join(',\n')
                const bottomChildren = bottomChildrenElements ? `\n${bottomChildrenElements}\n    ` : ''
                const maxWidth = Generator.getExprAndIdentifiers(app.maxWidth, identifiers, isKnown, onError('maxWidth'))
                const additionalReactProperties = definedPropertiesOf({maxWidth})

                return `React.createElement(App, {path: '${app.codeName}', ${objectLiteralEntries(additionalReactProperties, ',')}${topChildren}},${bottomChildren})`
            }

        case 'Page': {
            const page = element as Page
            identifiers.add('Page')
            return `React.createElement(Page, {id: props.path},
${generateChildren(page, '        ', page)}
    )`
        }

        case 'Layout': {
            const layout = element as Layout
            const path = pathWith(layout.codeName)
            identifiers.add('Layout')
            const horizontal = Generator.getExprAndIdentifiers(layout.horizontal, identifiers, isKnown, onError('horizontal'))
            const width = Generator.getExprAndIdentifiers(layout.width, identifiers, isKnown, onError('width'))
            const wrap = Generator.getExprAndIdentifiers(layout.wrap, identifiers, isKnown, onError('wrap'))
            const reactProperties = definedPropertiesOf({path, horizontal, width, wrap})
            return `React.createElement(Layout, ${objectLiteral(reactProperties)},
${generateChildren(layout, '            ', containingComponent)}
    )`
        }

        case 'AppBar': {
            const appBar = element as AppBar
            const path = pathWith(appBar.codeName)
            identifiers.add('AppBar')
            const children = appBar.elementArray().map(p => `            ${Generator.generateElement(p, app, identifiers, topLevelFunctions, isKnown, errors)},`).join('\n')
            const title = Generator.getExprAndIdentifiers(appBar.title, identifiers, isKnown, onError('title'))
            const reactProperties = definedPropertiesOf({path, title})
            return `React.createElement(AppBar, ${objectLiteral(reactProperties)},
${generateChildren(appBar, '            ')}
    )`
        }

        case 'Text': {
            const text = element as Text
            identifiers.add('TextElement')
            const path = pathWith(text.codeName)
            const content = Generator.getExprAndIdentifiers(text.content, identifiers, isKnown, onError('content'))
            const fontSize = Generator.getExprAndIdentifiers(text.fontSize, identifiers, isKnown, onError('fontSize'))
            const fontFamily = Generator.getExprAndIdentifiers(text.fontFamily, identifiers, isKnown, onError('fontFamily'))
            const color = Generator.getExprAndIdentifiers(text.color, identifiers, isKnown, onError('color'))
            const backgroundColor = Generator.getExprAndIdentifiers(text.backgroundColor, identifiers, isKnown, onError('backgroundColor'))
            const border = Generator.getExprAndIdentifiers(text.border, identifiers, isKnown, onError('border'))
            const borderColor = Generator.getExprAndIdentifiers(text.borderColor, identifiers, isKnown, onError('borderColor'))
            const width = Generator.getExprAndIdentifiers(text.width, identifiers, isKnown, onError('width'))
            const height = Generator.getExprAndIdentifiers(text.height, identifiers, isKnown, onError('height'))
            const marginBottom = Generator.getExprAndIdentifiers(text.marginBottom, identifiers, isKnown, onError('marginBottom'))
            const reactProperties = definedPropertiesOf({path, fontSize, fontFamily, color, backgroundColor, border, borderColor, width, height, marginBottom})
            return `React.createElement(TextElement, ${objectLiteral(reactProperties)}, ${content})`
        }

        case 'TextInput':
            const textInput = element as TextInput
            identifiers.add('TextInput')
            const initialValue = Generator.getExprAndIdentifiers(textInput.initialValue, identifiers, isKnown, onError('initialValue'))
            const path = pathWith(textInput.codeName)
            const maxLength = Generator.getExprAndIdentifiers(textInput.maxLength, identifiers, isKnown, onError('maxLength'))
            const width = Generator.getExprAndIdentifiers(textInput.width, identifiers, isKnown, onError('width'))
            const multiline = Generator.getExprAndIdentifiers(textInput.multiline, identifiers, isKnown, onError('multiline'))
            const readOnly = Generator.getExprAndIdentifiers(textInput.readOnly, identifiers, isKnown, onError('readOnly'))
            const label = Generator.getExprAndIdentifiers(textInput.label, identifiers, isKnown, onError('label'))
            const reactProperties = definedPropertiesOf({path, maxLength, multiline, readOnly, label, width})
            return `React.createElement(TextInput, ${objectLiteral(reactProperties)})`

        case 'NumberInput': {
            const numberInput = element as NumberInput
            identifiers.add('NumberInput')
            const initialValue = Generator.getExprAndIdentifiers(numberInput.initialValue, identifiers, isKnown, onError('initialValue'))
            const path = pathWith(numberInput.codeName)
            const label = Generator.getExprAndIdentifiers(numberInput.label, identifiers, isKnown, onError('label'))
            const reactProperties = definedPropertiesOf({path, label})
            return `React.createElement(NumberInput, ${objectLiteral(reactProperties)})`
        }

        case 'SelectInput': {
            const selectInput = element as SelectInput
            identifiers.add('SelectInput')
            const values = Generator.getExprAndIdentifiers(selectInput.values, identifiers, isKnown, onError('values'))
            const initialValue = Generator.getExprAndIdentifiers(selectInput.initialValue, identifiers, isKnown, onError('initialValue'))
            const path = pathWith(selectInput.codeName)
            const label = Generator.getExprAndIdentifiers(selectInput.label, identifiers, isKnown, onError('label'))
            const reactProperties = definedPropertiesOf({path, values, label})
            return `React.createElement(SelectInput, ${objectLiteral(reactProperties)})`
        }

        case 'TrueFalseInput': {
            const trueFalseInput = element as TrueFalseInput
            identifiers.add('TrueFalseInput')
            const initialValue = Generator.getExprAndIdentifiers(trueFalseInput.initialValue, identifiers, isKnown, onError('initialValue'))
            const path = pathWith(trueFalseInput.codeName)
            const label = Generator.getExprAndIdentifiers(trueFalseInput.label, identifiers, isKnown, onError('label'))
            const reactProperties = definedPropertiesOf({path, label})
            return `React.createElement(TrueFalseInput, ${objectLiteral(reactProperties)})`
        }

        case 'Button': {
            const button = element as Button
            identifiers.add('Button')
            const path = pathWith(button.codeName)
            const content = Generator.getExprAndIdentifiers(button.content, identifiers, isKnown, onError('content'))
            const action = Generator.getExprAndIdentifiers(button.action, identifiers, isKnown, onError('action'), 'action')
            const filled = Generator.getExprAndIdentifiers(button.filled, identifiers, isKnown, onError('filled'))
            const display = Generator.getExprAndIdentifiers(button.display, identifiers, isKnown, onError('display'))
            const reactProperties = definedPropertiesOf({path, content, filled, display, action})
            return `React.createElement(Button, ${objectLiteral(reactProperties)})`
        }

            case 'Menu': {
                const menu = element as Menu
                const path = pathWith(menu.codeName)
                identifiers.add('Menu')
                const label = Generator.getExprAndIdentifiers(menu.label, identifiers, isKnown, onError('label'))
                const filled = Generator.getExprAndIdentifiers(menu.filled, identifiers, isKnown, onError('filled'))
                const reactProperties = definedPropertiesOf({path, label, filled})
                return `React.createElement(Menu, ${objectLiteral(reactProperties)},
${generateChildren(menu, '            ', containingComponent)}
    )`
            }

            case 'MenuItem': {
                const menuItem = element as MenuItem
                identifiers.add('MenuItem')
                const path = pathWith(menuItem.codeName)
                const label = Generator.getExprAndIdentifiers(menuItem.label, identifiers, isKnown, onError('label'))
                const action = Generator.getExprAndIdentifiers(menuItem.action, identifiers, isKnown, onError('action'), 'action')
                const display = Generator.getExprAndIdentifiers(menuItem.display, identifiers, isKnown, onError('display'))
                const reactProperties = definedPropertiesOf({path, label, display, action})
                return `React.createElement(MenuItem, ${objectLiteral(reactProperties)})`
            }

            case 'List': {
            const list = element as List
            identifiers.add('ListElement')
            const listItemCode = Generator.generateComponent(app, new ListItem(list), errors, containingComponent)
            topLevelFunctions.add(listItemCode)

            const items = Generator.getExprAndIdentifiers(list.items, identifiers, isKnown, onError('items')) ?? '[]'
            const path = pathWith(list.codeName)
            const itemContentComponent = containingComponent!.codeName + '_' + list.codeName + 'Item'
            const width = Generator.getExprAndIdentifiers(list.width, identifiers, isKnown, onError('width'))
            const style = Generator.getExprAndIdentifiers(list.style, identifiers, isKnown, onError('style'))

            const reactProperties = definedPropertiesOf({path, items, itemContentComponent, width, style})
            return `React.createElement(ListElement, ${objectLiteral(reactProperties)})`
        }

        case 'Data': {
            const data = element as Data
            identifiers.add('Data')
            const initialValue = Generator.getExprAndIdentifiers(data.initialValue, identifiers, isKnown, onError('initialValue'))
            const path = pathWith(data.codeName)
            const display = Generator.getExprAndIdentifiers(data.display, identifiers, isKnown, onError('display'))
            const reactProperties = definedPropertiesOf({path, display})
            return `React.createElement(Data, ${objectLiteral(reactProperties)})`
        }

        case 'Collection': {
            const collection = element as Collection
            identifiers.add(element.kind)
            const initialValue = Generator.getExprAndIdentifiers(collection.initialValue, identifiers, isKnown, onError('initialValue'))
            const path = pathWith(collection.codeName)
            const display = Generator.getExprAndIdentifiers(collection.display, identifiers, isKnown, onError('display'))
            const dataStore = Generator.getExprAndIdentifiers(collection.dataStore, identifiers, isKnown, onError('dataStore'))
            const collectionName = Generator.getExprAndIdentifiers(collection.collectionName, identifiers, isKnown, onError('collectionName'))
            const reactProperties = definedPropertiesOf({path, display/*, dataStore, collectionName*/})
            return `React.createElement(Collection, ${objectLiteral(reactProperties)})`
        }

        case 'MemoryDataStore': {
            identifiers.add(element.kind)
            return ''
        }

        case 'FileDataStore': {
            identifiers.add(element.kind)
            return ''
        }

        case 'Function': {
            const functionDef = element as FunctionDef
            const input1 = functionDef.input1
            const input2 = functionDef.input2
            const input3 = functionDef.input3
            const input4 = functionDef.input4
            const input5 = functionDef.input5
            const params = [input1, input2, input3, input4, input5].filter( p => !!p)
            const isKnownOrParam = (identifier: string) => isKnown(identifier) || params.includes(identifier)
            const calculation = Generator.getExprAndIdentifiers(functionDef.calculation, identifiers, isKnownOrParam, onError('calculation'), 'multilineExpression')
            return ''
        }

        default:
            throw new UnsupportedValueError(element.kind)
        }
    }

    private static initialStateEntry(element: Element, isKnown: (name: string) => boolean): [(string | DefinedFunction), string[]] {
        const identifiers = new Set<string>()

        function ifDefined(name: string, expr: string | boolean | undefined) {
            return expr ? name + ': ' + expr + ', ' : ''
        }

        function stateEntryCode(): string | DefinedFunction{

            switch (element.kind) {
                case 'Project':
                    throw new Error('Cannot generate code for Project')
                case 'App':
                case 'Page':
                case 'Layout':
                case 'AppBar':
                case 'Text':
                case 'Button':
                case 'Menu':
                case 'MenuItem':
                    return ''

                case 'TextInput':
                case 'NumberInput':
                case 'SelectInput':
                case 'TrueFalseInput':
                case 'Data': {
                    const input = element as TextInput | NumberInput | SelectInput | TrueFalseInput | Data
                    const [valueExpr] = Generator.getExpr(input.initialValue, identifiers, isKnown)
                    return `new ${input.kind}.State({${ifDefined('value', valueExpr)}})`
                }

                case 'Collection': {
                    const collection = element as Collection
                    const [valueExpr] = Generator.getExpr(collection.initialValue, identifiers, isKnown)
                    const [dataStoreExpr] = Generator.getExpr(collection.dataStore, identifiers, isKnown)
                    const [collectionNameExpr] = Generator.getExpr(collection.collectionName, identifiers, isKnown)
                    return `new ${collection.kind}.State({${ifDefined('value', valueExpr)}${ifDefined('dataStore', dataStoreExpr)}${ifDefined('collectionName', collectionNameExpr)}}),`
                }
                case 'List': {
                    const list = element as List
                    const [itemsExpr] = Generator.getExpr(list.items, identifiers, isKnown)
                    return `new ListElement.State({})`
                }
                case 'MemoryDataStore':
                    const store = element as MemoryDataStore
                    const [valueExpr] = Generator.getExpr(store.initialValue, identifiers, isKnown)
                    return `new MemoryDataStore({${valueExpr ? 'value: ' + valueExpr : ''}})`

                case 'FileDataStore':
                    const fileStore = element as FileDataStore
                    return `new ${fileStore.kind}.State()`

                case 'Function': {
                    const functionDef = element as FunctionDef
                    const input1 = functionDef.input1
                    const input2 = functionDef.input2
                    const input3 = functionDef.input3
                    const input4 = functionDef.input4
                    const input5 = functionDef.input5
                    const params = [input1, input2, input3, input4, input5].filter( p => !!p)
                    const isKnownOrParam = (identifier: string) => isKnown(identifier) || params.includes(identifier)
                    const [calculation] = Generator.getExpr(functionDef.calculation, identifiers, isKnownOrParam, 'multilineExpression')
                    return new DefinedFunction(`(${params.join(', ')}) => ${calculation}`)
                }

                default:
                    throw new UnsupportedValueError(element.kind)
            }
        }

        return [stateEntryCode(), Array.from(identifiers.values())]

    }

    private static getExprAndIdentifiers(propertyValue: PropertyValue | undefined, identifiers: IdentifierCollector,
        isKnown: (name: string) => boolean, onError: (err: string) => void, exprType: ExprType = 'singleExpression') {
        if (propertyValue === undefined) {
            return undefined
        }

        function checkIsExpression(ast: any) {
            const bodyStatements = ast.program.body as any[]
            if (exprType === 'singleExpression') {
                if (bodyStatements.length !== 1) {
                    throw new Error('Must be a single expression')
                }
                const mainStatement = bodyStatements[0]
                if (mainStatement.type !== 'ExpressionStatement') {
                    throw new Error('Invalid expression')
                }
            }

            if (exprType === 'multilineExpression') {
                const lastStatement = last(bodyStatements)
                if (lastStatement.type !== 'ExpressionStatement') {
                    throw new Error('Invalid expression')
                }
            }
        }

        function checkErrors(ast: any) {
            if (ast.program.errors?.length) {
                throw new Error(ast.program.errors[0].description)
            }
        }

        function isShorthandProperty(node: any) {
            return node.shorthand
        }

        function isFunctionArg(functionName: string, argIndex: number) {
            const argIndexes = functionArgIndexes[functionName as keyof typeof functionArgIndexes]
            return argIndexes.includes(argIndex)
        }

        function addReturnStatement(ast: any) {
            const bodyStatements = ast.program.body as any[]
            const lastStatement = last(bodyStatements)
            const b = types.builders
            const returnStmt = b.returnStatement(lastStatement.expression)
            ast.program.body[bodyStatements.length - 1] = returnStmt
        }

        if (isExpr(propertyValue)) {
            const {expr} = propertyValue
            try {
                const exprToParse = expr.trim().startsWith('{') ? `(${expr})` : expr
                const ast = parse(exprToParse)
                checkIsExpression(ast)
                checkErrors(ast)
                const thisIdentifiers = new Set<string>()
                const variableIdentifiers = new Set<string>()
                visit(ast, {
                    visitVariableDeclarator(path) {
                        const node = path.value
                        variableIdentifiers.add(node.id.name)
                        this.traverse(path)
                    },
                    visitIdentifier(path) {
                        const node = path.value
                        const parentNode = path.parentPath.value
                        const isPropertyIdentifier = parentNode.type === 'MemberExpression' && parentNode.property === node
                        const isPropertyKey = parentNode.type === 'Property' && parentNode.key === node
                        const isVariableDeclaration = parentNode.type === 'VariableDeclarator' && parentNode.id === node
                        if (!isPropertyIdentifier && !isPropertyKey && !isVariableDeclaration) {
                            thisIdentifiers.add(node.name)
                        }
                        this.traverse(path)
                    },
                    visitAssignmentExpression(path) {
                        const node = path.value
                        node.type = 'BinaryExpression'
                        node.operator = '=='
                        this.traverse(path)
                    },

                    visitProperty(path) {
                        const node = path.value
                        if (isShorthandProperty(node)) {
                            node.value.name = 'undefined'
                            const errorMessage = `Incomplete item: ${node.key.name}`
                            onError(errorMessage)
                        }
                        this.traverse(path)
                    },

                    visitCallExpression(path) {
                        const node = path.value
                        const functionName = node.callee.name
                        const argsToTransform = functionArgIndexes[functionName as keyof typeof functionArgIndexes]
                        argsToTransform?.forEach( index => {
                            const bodyExpr = node.arguments[index]
                            const b = types.builders
                            const functionExpr = b.arrowFunctionExpression([b.identifier('$item')], bodyExpr)
                            node.arguments[index] = functionExpr
                        })
                        this.traverse(path)
                    }
                })

                if (exprType === 'multilineExpression') {
                    addReturnStatement(ast)
                }

                const identifierNames = Array.from(thisIdentifiers.values())
                const isLocal = (id: string) => variableIdentifiers.has(id)
                const unknownIdentifiers = identifierNames.filter(id => !isKnown(id) && !isLocal(id))
                if (unknownIdentifiers.length) {
                    const errorMessage = `Unknown names: ${unknownIdentifiers.join(', ')}`
                    onError(errorMessage)
                    return `Elemento.codeGenerationError(\`${expr}\`, '${errorMessage}')`
                }

                const externalIdentifiers = without(Array.from(variableIdentifiers), identifierNames)
                externalIdentifiers.forEach(name => identifiers.add(name))

                const exprCode = print(ast).code.replace(/;$/, '')
                switch (exprType) {
                    case 'singleExpression': return exprCode
                    case 'action': return `() => {${exprCode}}`
                    case 'multilineExpression': {
                        return `{\n${indent(exprCode, '        ')}\n    }`
                    }
                }
            } catch(e: any) {
                const errorMessage = `${e.constructor.name}: ${e.message}`
                onError(errorMessage)
                return `Elemento.codeGenerationError(\`${expr}\`, '${errorMessage}')`
            }
        } else {
            return valueLiteral(propertyValue)
        }
    }

    private static getExpr(propertyValue: PropertyValue | undefined, identifiers: IdentifierCollector, isKnown: (name: string) => boolean, exprType: ExprType = 'singleExpression') {
        const errors = []
        const onError = (err: string) => errors.push(err)
        const expr = trimParens(Generator.getExprAndIdentifiers(propertyValue, identifiers, isKnown, onError, exprType))
        const isError = !!errors.length

        return [expr, isError]
    }
}