import React, {ChangeEvent} from 'react'
import {TextField} from '@mui/material'
import {definedPropertiesOf} from '../../util/helpers'
import {valueOfProps} from '../runtimeFunctions'

type Properties = {state: {value?: string, _path: string, _controlValue: string | null, _setValue: (val: string) => typeof TextInput.State}, label?: string, maxLength?: number, width?: string | number, multiline?: boolean}

export default function TextInput({state, ...props}: Properties) {
    const {maxLength, label, multiline, width} = valueOfProps(props)
    const inputProps = maxLength !== undefined ? {inputProps: {maxLength}} : {}
    const widthProp = width !== undefined ? {width} : {}
    const sxProps = {sx: {...widthProp}}
    const optionalProps = definedPropertiesOf({label, multiline})
    const {_path: path} = state
    const value = state._controlValue ?? ''
    const onChange = (event: ChangeEvent) => {
        const controlValue = (event.target as any).value
        const updateValue = controlValue !== '' ? controlValue : null
        state._setValue(updateValue)
    }

    return React.createElement(TextField, {
        id: path,
        type: 'text',
        variant: 'outlined',
        size: 'small',
        value,
        onChange,
        ...inputProps,
        ...sxProps,
        ...optionalProps
    })
}

TextInput.State = class State  {
    constructor(private props: { value: string | null | undefined }) {
    }

    defaultValue = ''

    get value() {
        return this.props.value
    }

    _setValue(value: string) {
        return new TextInput.State({value})
    }

    Reset() {
        return new TextInput.State({value: undefined})
    }
}
