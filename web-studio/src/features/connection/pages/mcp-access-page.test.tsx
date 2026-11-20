// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { McpAccessPage } from '#/features/connection/pages/mcp-access-page'

const mocks = vi.hoisted(() => ({
  copy: vi.fn().mockResolvedValue(undefined),
  role: 'user',
  mode: 'api_key',
  key: 'member-key-fixture',
}))

vi.mock('#/features/connection/hooks/use-app-connection', () => ({
  useAppConnection: () => ({
    connectionRole: mocks.role,
    serverMode: mocks.mode,
    connection: {
      accountId: 'team',
      userId: 'member',
      apiKey: mocks.key,
      adminApiKey: 'root-key-fixture',
      baseUrl: 'https://studio.example.test/',
    },
  }),
}))
vi.mock('#/shared/lib/clipboard', () => ({ copyTextToClipboard: mocks.copy }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/settings">{children}</a>
  ),
}))

describe('MCP Access', () => {
  afterEach(cleanup)
  beforeEach(() => {
    mocks.copy.mockClear()
    mocks.role = 'user'
    mocks.mode = 'api_key'
    mocks.key = 'member-key-fixture'
  })

  it('keeps the key out of examples and copies the selected client setup', async () => {
    const user = userEvent.setup()
    render(<McpAccessPage />)
    expect(screen.getByText('https://studio.example.test/mcp')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'mcpAccess.copyEndpoint' }),
    )
    expect(mocks.copy).toHaveBeenLastCalledWith(
      'https://studio.example.test/mcp',
    )

    const cases = [
      [
        'codex',
        '[mcp_servers.openviking]',
        'Authorization = "Bearer member-key-fixture"',
      ],
      [
        'claude',
        'claude mcp add --scope user --transport http openviking',
        'Authorization: Bearer member-key-fixture',
      ],
      [
        'pi',
        'pi mcp add openviking --url',
        'Authorization=Bearer member-key-fixture',
      ],
    ]
    for (const [client, prefix, header] of cases) {
      await user.click(
        screen.getByRole('tab', {
          name: 'mcpAccess.clients.' + client + '.name',
        }),
      )
      expect(screen.getByRole('tabpanel').textContent).toContain(
        'YOUR_OPENVIKING_USER_API_KEY',
      )
      expect(document.body.textContent).not.toContain('member-key-fixture')
      await user.click(
        screen.getByRole('button', { name: 'mcpAccess.copyWithKey' }),
      )
      const copy = mocks.copy.mock.lastCall?.[0]
      expect(copy).toContain(prefix)
      expect(copy).toContain(header)
      expect(copy).not.toContain('root-key-fixture')
    }
  })

  it('copies a placeholder for a root connection and never copies its key', async () => {
    mocks.role = 'root'
    mocks.key = 'root-key-fixture'
    render(<McpAccessPage />)
    await userEvent.click(
      screen.getByRole('button', { name: 'mcpAccess.copySetup' }),
    )
    expect(mocks.copy.mock.lastCall?.[0]).toContain(
      'YOUR_OPENVIKING_USER_API_KEY',
    )
    expect(mocks.copy.mock.lastCall?.[0]).not.toContain('root-key-fixture')
  })
})
