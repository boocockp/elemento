/**
 * @jest-environment jsdom
 */

import React from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react/pure'

import AppStructureTree, {ModelTreeItem} from '../../src/editor/AppStructureTree'
import {treeExpandControlSelector, treeItemSelector} from './Selectors'
import {stopSuppressingRcTreeJSDomError, suppressRcTreeJSDomError, treeItemLabels} from '../testutil/testHelpers'

let container: any, unmount: any

const wait = (time: number): Promise<void> => new Promise(resolve => setInterval(resolve, time) )
const actWait = async (testFn: () => void) => {
    await act(async ()=> {
        testFn()
        await wait(20)
    })
}

const clickExpandControlFn = (container: any) => async (...indexes: number[]) => {
    for (const index of indexes) await actWait(() => fireEvent.click(container.querySelectorAll(treeExpandControlSelector)[index]))
}
const clickExpandControl = (...indexes: number[]) => clickExpandControlFn(container)(...indexes)

const itemLabels = () => treeItemLabels(container)

const itemIcons = () => {
    const treeNodesShown = container.querySelectorAll(treeItemSelector)
    return [...treeNodesShown.values()].map( (it: any) => it.querySelector('svg').getAttribute('data-testid') )
}

const selectedItemLabel = () => {
    const treeNodesSelected = container.querySelectorAll('.rc-tree-list .rc-tree-treenode-selected')
    return [...treeNodesSelected.values()].map( (it: any) => it.textContent)[0]
}

const modelTree = new ModelTreeItem('project_1', 'Project One', 'Project', [
    new ModelTreeItem('app1', 'App One', 'App', [
        new ModelTreeItem('page_1', 'Main Page', 'Page', [
            new ModelTreeItem('text1_1', 'First Text', 'Text'),
            new ModelTreeItem('textInput1_2', 'The Text Input', 'TextInput'),
            new ModelTreeItem('numberInput1_2', 'The Number Input', 'NumberInput'),
            new ModelTreeItem('selectInput1_2', 'The Select Input', 'SelectInput'),
            new ModelTreeItem('trueFalseInput2_1', 'Some True-false', 'TrueFalseInput'),
            new ModelTreeItem('button2_1', 'Some Button', 'Button'),
            new ModelTreeItem('data_1_1', 'Some Data', 'Data'),
        ]),
        new ModelTreeItem('page2', 'Other Page', 'Page', [
            new ModelTreeItem('text2_1', 'Some Text', 'Text'),
        ])
    ])
])


beforeAll(suppressRcTreeJSDomError)
afterAll(stopSuppressingRcTreeJSDomError)

afterEach( async () => await act(() => {
    try{
        unmount && unmount()
    } catch(e: any) {
        if (!e.message?.match(/Cannot read properties of null \(reading 'removeEventListener'\)/)) {
            throw e
        }
    }
}))

describe('ModelTreeItem', () => {
    test('finds ancestor keys of the item with a given key', () => {
        const deepTree = new ModelTreeItem('project_1', 'Project One', 'Project', [
            new ModelTreeItem('app1', 'App One', 'App', [
                new ModelTreeItem('page_1', 'Main Page', 'Page', [
                    new ModelTreeItem('text1_1', 'First Text', 'Text'),
                    new ModelTreeItem('textInput1_2', 'The Text Input', 'TextInput', [
                        new ModelTreeItem('id1', 'An item', 'Text', [
                            new ModelTreeItem('id2', 'A deeper item', 'Text')
                        ])
                    ]),
                ]),
                new ModelTreeItem('page2', 'Other Page', 'Page', [
                    new ModelTreeItem('text2_1', 'Some Text', 'Text'),
                ])
            ])])

        expect(deepTree.ancestorKeysOf('project_1')).toStrictEqual([])
        expect(deepTree.ancestorKeysOf('app1')).toStrictEqual(['project_1'])
        expect(deepTree.ancestorKeysOf('page2')).toStrictEqual(['project_1', 'app1'])
        expect(deepTree.ancestorKeysOf('text1_1')).toStrictEqual(['project_1', 'app1', 'page_1'])
        expect(deepTree.ancestorKeysOf('id1')).toStrictEqual(['project_1', 'app1', 'page_1', 'textInput1_2'])
        expect(deepTree.ancestorKeysOf('id2')).toStrictEqual(['project_1', 'app1', 'page_1', 'textInput1_2', 'id1'])
        expect(deepTree.ancestorKeysOf('non_existent')).toStrictEqual([])
        expect(deepTree.ancestorKeysOf(undefined)).toStrictEqual([])
    })

    test('knows whether it contains the item with a given key', () => {
        let item_id2, item_textInput1
        const deepTree = new ModelTreeItem('project_1', 'Project One', 'Project', [
            new ModelTreeItem('app1', 'App One', 'App', [
            new ModelTreeItem('page1','Main Page', 'Page', [
                new ModelTreeItem('text1', 'First Text', 'Text'),
                item_textInput1 = new ModelTreeItem('textInput1', 'The Text Input', 'TextInput', [
                    new ModelTreeItem('id1', 'An item', 'Text', [
                        item_id2 = new ModelTreeItem('id2', 'A deeper item', 'Text')
                    ])
                ]),
            ]),
            new ModelTreeItem('page2','Other Page', 'Page', [
                new ModelTreeItem('text2_1', 'Some Text', 'Text'),
            ])
        ])])

        expect(deepTree.containsKey('project_1')).toBe(false)
        expect(deepTree.containsKey('app1')).toBe(true)
        expect(deepTree.containsKey('xxx')).toBe(false)
        expect(deepTree.containsKey('page2')).toBe(true)
        expect(deepTree.containsKey('id2')).toBe(true)

        expect(item_id2.containsKey('id2')).toBe(false)
        expect(item_id2.containsKey('textInput1')).toBe(false)

        expect(item_textInput1.containsKey('textInput1')).toBe(false)
        expect(item_textInput1.containsKey('page1')).toBe(false)
        expect(item_textInput1.containsKey('id1')).toBe(true)
        expect(item_textInput1.containsKey('id2')).toBe(true)
    })
})

test("renders tree with all types of model elements",  async () => {
    ({container, unmount} = render(<AppStructureTree treeData={modelTree} onAction={jest.fn()}/>))
    await clickExpandControl(0, 1)
    expect(itemLabels()).toStrictEqual(['Project One', 'App One', 'Main Page', 'Other Page'])
    expect(itemIcons()).toStrictEqual(['WebIcon', 'WebIcon', 'WebIcon', 'WebIcon',])

    await clickExpandControl(2)
    expect(itemLabels()).toStrictEqual(['Project One', 'App One', 'Main Page', 'First Text', 'The Text Input', 'The Number Input', 'The Select Input', 'Some True-false', 'Some Button', 'Some Data', 'Other Page'])
    expect(itemIcons()).toStrictEqual(['WebIcon', 'WebIcon', 'WebIcon', 'SubjectIcon', 'RectangleOutlinedIcon', 'MoneyOutlinedIcon', 'DensitySmallIcon', 'ToggleOnIcon', 'Crop75Icon', 'NoteIcon', 'WebIcon',])
})

test("can expand and collapse branches and show",  async () => {
    await actWait( () => ({container, unmount} = render(<AppStructureTree treeData={modelTree} onAction={jest.fn()}/>)))

    await clickExpandControl(0, 1, 2)
    expect(itemLabels()).toContain('First Text')

    await clickExpandControl(2)
    expect(itemLabels()).not.toContain('First Text')
})

test('notifies selected item id', async () => {
    const storeSelectedId = jest.fn()

    await actWait(() => ({container, unmount} = render(<AppStructureTree treeData={modelTree} onSelect={storeSelectedId} onAction={jest.fn()}/>)))
    await clickExpandControl(0, 1)
    await actWait(() => fireEvent.click(screen.getByText('Main Page')))
    expect(storeSelectedId).toHaveBeenCalledWith('page_1')

    await clickExpandControl(2)
    await actWait(() => fireEvent.click(screen.getByText('The Text Input')))
    expect(storeSelectedId).toHaveBeenCalledWith('textInput1_2')
})

test('shows selected item highlighted', async () => {
    await actWait(() => ({container, unmount} = render(<AppStructureTree treeData={modelTree} selectedItemId={'project_1'} onSelect={jest.fn()} onAction={jest.fn()}/>)))
    expect(itemLabels()).toContain('Project One')
    expect(selectedItemLabel()).toBe('Project One')
})

test('expands to show selected item highlighted', async () => {
    await actWait(() => ({container, unmount} = render(<AppStructureTree treeData={modelTree} selectedItemId={'textInput1_2'} onSelect={jest.fn()} onAction={jest.fn()}/>)))
    expect(itemLabels()).toContain('First Text')
    expect(selectedItemLabel()).toBe('The Text Input')
})

test('selects collapsed item if it contained the selected item', async () => {
    const onSelect = jest.fn()
    await actWait(() => {
        return ({container, unmount} = render(<AppStructureTree treeData={modelTree} selectedItemId={'textInput1_2'}
                                                       onSelect={onSelect} onAction={jest.fn()}/>))
    })
    expect(itemLabels()).toContain('First Text')
    expect(selectedItemLabel()).toBe('The Text Input')
    await clickExpandControl(1)
    expect(onSelect).toHaveBeenCalledWith('app1')
})

test('notifies delete with item id', async () => {
    const onAction = jest.fn()

    await actWait(() => ({container, unmount} = render(<AppStructureTree treeData={modelTree} onSelect={jest.fn()} onAction={onAction}/>)))
    await clickExpandControl(0, 1)
    await actWait(() => fireEvent.click(screen.getByText('Main Page')))

    await clickExpandControl(2)
    await actWait(() => fireEvent.contextMenu(screen.getByText('The Text Input')))
    await actWait(() => fireEvent.click(screen.getByText('Delete')))
    expect(onAction).not.toHaveBeenCalled()

    await actWait(() => fireEvent.click(screen.getByText('Yes', {exact: false})))
    expect(onAction).toHaveBeenCalledWith({action: 'delete', id: 'textInput1_2', itemName: 'this item'})
    expect(screen.queryByText('Delete')).toBeNull()
})

test('abandons delete if do not confirm', async () => {
    const onAction = jest.fn()

    await actWait(() => ({container, unmount} = render(<AppStructureTree treeData={modelTree} onSelect={jest.fn()} onAction={onAction}/>)))
    await clickExpandControl(0, 1)
    await actWait(() => fireEvent.click(screen.getByText('Main Page')))

    await clickExpandControl(2)
    await actWait(() => fireEvent.contextMenu(screen.getByText('The Text Input')))
    await actWait(() => fireEvent.click(screen.getByText('Delete')))
    expect(onAction).not.toHaveBeenCalled()

    await actWait(() => fireEvent.click(screen.getByText('No', {exact: false})))
    expect(onAction).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete')).toBeNull()
})



