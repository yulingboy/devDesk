import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button asChild', () => {
  it('链接式按钮只向 Radix Slot 传入一个元素', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(Button, { asChild: true }, createElement('a', { href: '#/git' }, '管理身份'))
      )
    ).not.toThrow()
  })

  it('禁用链接式按钮保留可访问性状态', () => {
    const markup = renderToStaticMarkup(
      createElement(
        Button,
        { asChild: true, disabled: true },
        createElement('a', { href: '#/git' }, '管理身份')
      )
    )

    expect(markup).toContain('aria-disabled="true"')
  })
})
