import renderer from 'react-test-renderer'
import React from 'react'
import {stateProxy} from '../../src/runtime/stateProxy'
import {treeItemSelector} from '../editor/Selectors'

export function asJSON(obj: object): any { return JSON.parse(JSON.stringify(obj)) }

export const componentJSON = (component: JSX.Element) => renderer.create(component).toJSON()

export const snapshot = (element: React.ReactElement) => () => expect(componentJSON(element)).toMatchSnapshot()

export const snapshotTest = (element: JSX.Element) => test(`${element.type.name} has expected structure`, snapshot(element))

export const componentProps = (domElement: any) => {
    const propsKey = Object.keys(domElement).find(k => k.startsWith("__reactProps$"))
    return propsKey !== undefined ? domElement[propsKey as string] : null
}

export const stateVal = (value: any, path = 'path.x') => testProxy(path, {value})

const dummyUpdateFn = () => {
    throw new Error('Dummy update fn called')
}
export const testProxy = (path: string, storedState: object | undefined, initialValues: object = {}) => stateProxy(path, storedState, initialValues, dummyUpdateFn)
export const testUpdatableProxy = (path: string, storedState: object | undefined, initialValues: object = {}) => {
    const updateFn = jest.fn()
    const proxy = stateProxy(path, storedState, initialValues, updateFn)
    return [proxy, updateFn]
}

let suppressionReported = false
const originalConsoleError = console.error

export const suppressRcTreeJSDomError = () => {
    if (console.error === originalConsoleError) {
        jest.spyOn(console, 'error').mockImplementation( (...args: any[]) => {
            const message = args[0].message ?? args[0]
            if (message.match(/Cannot read properties of null \(reading 'removeEventListener'\)|The above error occurred in/)) {
                !suppressionReported && console.log('Suppressed JSDOM removeEventListener error')
                suppressionReported = true
            } else {
                originalConsoleError(...args)
            }
        })
    }
}
export const stopSuppressingRcTreeJSDomError = () => {
    console.error = originalConsoleError
    jest.restoreAllMocks()
    suppressionReported = false
}

export const timeoutForDebugging = () => {
    jest.setTimeout(1000000)
    console.log('timeoutForDebugging')
}

export function ex([s]: TemplateStringsArray) {
    return {expr: s}
}

export const treeItemLabels = (container: any) => {
    const treeNodesShown = container.querySelectorAll(treeItemSelector)
    return [...treeNodesShown.values()].map((it: any) => it.textContent)
}

export const waitUntil = <T>(fn: () => T, time = 1000, wait = 10000): Promise<T> => {
    const startTime = new Date().getTime();
    try {
        const result = fn()
        if (result) {
            return Promise.resolve(result)
        } else {
            return new Promise((resolve, reject) => {
                const timer = setInterval(() => {
                    try {
                        const result = fn()
                        if (result) {
                            clearInterval(timer);
                            resolve(result);
                        } else if (new Date().getTime() - startTime > wait) {
                            clearInterval(timer);
                            reject(new Error('Max wait reached'));
                        }
                    } catch (e) {
                        clearInterval(timer);
                        reject(e);
                    }
                }, time);
            });
        }
    } catch (e) {
        return Promise.reject(e);
    }
}

export const valObj = <T>(val: T) => ({
    v: val, valueOf() {
        return this.v
    }
})

export let saveFileData: any
export let saveFilePickerOptions: any

export function resetSaveFileCallData() {
    saveFileData = undefined
    saveFilePickerOptions = undefined
}

export function mockFileHandle(returnedData?: object, name?: string) {
    const file = {
        async text() {
            return JSON.stringify(returnedData)
        }
    }

    const writable = {
        async write(data: any) {
            saveFileData = data
        },
        async close() {
        }
    }

    return {
        name,
        async getFile() {
            return file
        },
        async createWritable() {
            return writable
        }
    } as unknown as FileSystemFileHandle
}

export const saveFilePicker = (fileHandleName?: string) => async (options: any) => {
    saveFilePickerOptions = options
    return mockFileHandle(undefined, fileHandleName)
}

export function filePickerReturning(returnedData: object, fileHandleName?: string) {
    return () => Promise.resolve([mockFileHandle(returnedData, fileHandleName)])
}

export const filePickerCancelling = () => Promise.reject({name: 'AbortError'})
export const filePickerErroring = () => Promise.reject(new Error('Could not access file'))