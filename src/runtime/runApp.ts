import React from 'react'
import ReactDOM from 'react-dom'
import App from '../model/App'
import Generator from '../generator/Generator'
import TextElement from './TextElement'
import TextInput from './TextInput'
import NumberInput from './NumberInput'
import SelectInput from './SelectInput'
import TrueFalseInput from './TrueFalseInput'
import Button from './Button'
import Data from './Data'
import ErrorFallback from './ErrorFallback'
import welcomeApp from '../util/welcomeApp'
import {loadJSONFromString} from '../model/loadJSON'
import {ErrorBoundary} from 'react-error-boundary'
import {globalFunctions as importedGlobalFunctions} from './globalFunctions'
import importedAppFunctions from './appFunctions'
import {getState, updateState, useObjectState, useObjectStateWithDefaults} from './appData'
import AppLoadError from './AppLoadError'
import {codeGenerationError, showAppCode} from './runtimeFunctions'

let theApp: App

declare global {
    var app: () => App
    var setApp: (app: App) => void
    var setAppFromJSONString: (appJson: string) => void

    var runApp: () => any
    var AppMain: () => any
    var globalFunctions: object
    var appFunctions: object
    var appCode: string
}

export function app() { return theApp }
export function setApp(app: App) {
    theApp = app
    runApp()
}
export function setAppFromJSONString(appJson: string) {
    setApp(loadJSONFromString(appJson) as App)
}

window.app = app
window.setApp = setApp
window.runApp = runApp
window.setAppFromJSONString = setAppFromJSONString
window.globalFunctions = importedGlobalFunctions
window.appFunctions = importedAppFunctions

const appContainer = () => document.querySelector('#main')

async function loadApp() {
    const path = location.pathname.substring(1)
    if (path.startsWith('https://') || path.startsWith('http://') ) {
        const appUrl = path.replace(/www.dropbox.com/, 'dl.dropboxusercontent.com')
        try {
            const appData = await fetch(appUrl).then(resp => resp.text())
            theApp = loadJSONFromString(appData)
        } catch (error: any) {
            throw {appUrl, error}
        }
    } else {
        theApp = welcomeApp()
    }
}

function showError({appUrl, error}: {appUrl:string, error: Error}) {
    ReactDOM.render(React.createElement(AppLoadError, {appUrl, error}), appContainer())
}


function runApp() {
    const appMainCode = new Generator(theApp).output().files.map( f => f.content ).join('\n')

    const scriptElement = document.createElement('script')
    scriptElement.id = 'appMainCode'
    scriptElement.innerHTML = appMainCode
    window.appCode = appMainCode

    document.getElementById('appMainCode')?.remove()
    document.body.append(scriptElement)

    ReactDOM.render(
        React.createElement(ErrorBoundary, {FallbackComponent: ErrorFallback, resetKeys:[appMainCode]},
            React.createElement(AppMain, null)
        ), appContainer()
    )
}

// @ts-ignore
window.Button = Button
// @ts-ignore
window.TextElement = TextElement
// @ts-ignore
window.TextInput = TextInput
// @ts-ignore
window.NumberInput = NumberInput
// @ts-ignore
window.SelectInput = SelectInput
// @ts-ignore
window.TrueFalseInput = TrueFalseInput
// @ts-ignore
window.Data = Data
// @ts-ignore
window.useObjectState = useObjectState
// @ts-ignore
window.updateState = updateState
// @ts-ignore
window.getState = getState
// @ts-ignore
window.useObjectStateWithDefaults = useObjectStateWithDefaults
// @ts-ignore
window.codeGenerationError = codeGenerationError
// @ts-ignore
window.showAppCode = showAppCode

loadApp().then( runApp, showError )
