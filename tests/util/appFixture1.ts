import App from '../../src/model/App'
import Page from '../../src/model/Page'
import Text from '../../src/model/Text'

export default function () {

    return new App('app1', 'App One', {}, [
        new Page('page1', 'Main Page', {}, [
            new Text('text_1', 'First Text', {contentExpr: '"The first bit of text"'}),
            new Text('text_2', 'Second Text', {contentExpr: '"The second bit of text"'}),
        ]),
        new Page('page2', 'Other Page', {}, [
            new Text('text_3', 'Some Text', {contentExpr: '"Some text here"'}),
            new Text('text_4', 'More Text', {contentExpr: '"...and more text"'}),
        ])
    ])
}
