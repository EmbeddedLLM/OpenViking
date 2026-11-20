import { McpAccessPage } from '#/features/connection/pages/mcp-access-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/mcp-access')({
  component: McpAccessPage,
})
