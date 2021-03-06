import {expect, test} from '@playwright/test'

const pageUrl = '/studio'

const helpButton = 'button#help'
const helpPanel = '#helpPanel'
const helpPanelTitle = `${helpPanel} header .MuiTypography-h6`
const helpPanelText = `${helpPanel} .helpText`
const helpPanelClose = `${helpPanel} .closeButton`

test('open help panel and hide it', async ({ page }) => {
    await page.goto(pageUrl)

    await expect(page.locator(helpPanel)).toBeHidden()
    await page.click(helpButton)

    await expect(page.locator(helpPanel)).toBeVisible()
    await expect(page.locator(helpPanelTitle)).toHaveText('Help')

    await page.click(helpPanelClose)
    await expect(page.locator(helpPanel)).toBeHidden()
})

test('help panel contents scrolls to help item', async ({ page }) => {
    await page.goto(pageUrl)
    await page.click(helpButton)

    const itemContentLink = (itemTitle: string) => `${helpPanel} .helpContent >> text=${itemTitle}`
    const helpItem = (itemTitle: string, headingTag: string) => `${helpPanelText} ${headingTag}:text-is("${itemTitle}")`

    const isScrolledToTopInPage = (idArg:string) => {
        const [container, el] = idArg.split('|')
        const containerPos = document.querySelector(container)!.getBoundingClientRect().top
        const elementPos = document.querySelector(el)!.getBoundingClientRect().top

        const difference = elementPos - containerPos
        return difference > 0 && difference < 20
    }

    const topLevelItemTitle = 'Controls'
    await page.click(itemContentLink(topLevelItemTitle))
    await expect(page.locator(helpItem(topLevelItemTitle, 'h4'))).toBeVisible()
    await page.waitForFunction(isScrolledToTopInPage, `${helpPanelText}|#help-controls`, {timeout: 6000})

    const secondLevelItemTitle = 'Properties'
    await page.click(itemContentLink(secondLevelItemTitle))
    await expect(page.locator(helpItem(secondLevelItemTitle, 'h5'))).toBeVisible()
    await page.waitForFunction(isScrolledToTopInPage, `${helpPanelText}|#help-control-properties`, {timeout: 3000})
})
