import { useAppConnection } from '#/features/connection/hooks/use-app-connection'
import { copyTextToClipboard } from '#/shared/lib/clipboard'
import { Button } from '#/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/shared/ui/tabs'
import { Link } from '@tanstack/react-router'
import { CopyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const clients = ['codex', 'claude', 'pi'] as const
type McpClient = (typeof clients)[number]
const memberKeyPlaceholder = 'YOUR_OPENVIKING_USER_API_KEY'

function getMcpEndpoint(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null
    }
    url.pathname = url.pathname.replace(/\/+$/, '') + '/mcp'
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

function shellQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\"'\"'") + "'"
}

function clientSetup(
  client: McpClient,
  endpoint: string,
  key?: string,
): string {
  const bearer = key ? 'Bearer ' + key : undefined
  if (client === 'codex') {
    return [
      '[mcp_servers.openviking]',
      'url = ' + JSON.stringify(endpoint),
      ...(bearer
        ? ['http_headers = { Authorization = ' + JSON.stringify(bearer) + ' }']
        : []),
    ].join('\n')
  }

  const url = shellQuote(endpoint)
  const header = bearer
    ? ' --header ' +
      shellQuote(
        (client === 'claude' ? 'Authorization: ' : 'Authorization=') + bearer,
      )
    : ''
  return (
    (client === 'claude'
      ? 'claude mcp add --scope user --transport http openviking '
      : 'pi mcp add openviking --url ') +
    url +
    header
  )
}

export function McpAccessPage() {
  const { t } = useTranslation(['appShell', 'settings'])
  const { connection, connectionRole, serverMode } = useAppConnection()
  const endpoint = getMcpEndpoint(connection.baseUrl)
  const supportsSetup = serverMode === 'api_key' || serverMode === 'dev'
  const memberKey =
    serverMode === 'api_key' &&
    connectionRole !== 'root' &&
    connection.userId.trim()
      ? connection.apiKey.trim()
      : ''
  const exampleKey = serverMode === 'api_key' ? memberKeyPlaceholder : undefined
  const identity = [connection.accountId, connection.userId]
    .filter(Boolean)
    .join(' / ')

  async function copy(value: string) {
    try {
      await copyTextToClipboard(value)
      toast.success(t('settings:toast.copied'))
    } catch {
      toast.error(t('settings:toast.copyFailed'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-4 sm:py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('mcpAccess.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('mcpAccess.description')}
        </p>
      </header>
      {endpoint ? (
        <>
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t('mcpAccess.endpoint')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 basis-56 break-all rounded-md bg-muted px-3 py-2 text-sm">
                  {endpoint}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copy(endpoint)}
                >
                  <CopyIcon />
                  {t('mcpAccess.copyEndpoint')}
                </Button>
              </div>
              {identity ? (
                <dl className="flex flex-wrap gap-x-2 text-sm">
                  <dt className="text-muted-foreground">
                    {t('mcpAccess.identity')}
                  </dt>
                  <dd className="break-all">{identity}</dd>
                </dl>
              ) : null}
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t('mcpAccess.setup')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  serverMode === 'api_key'
                    ? memberKey
                      ? 'mcpAccess.keyHint'
                      : 'mcpAccess.missingKey'
                    : serverMode === 'dev'
                      ? 'mcpAccess.devMode'
                      : 'mcpAccess.otherMode',
                )}
              </p>
              {supportsSetup ? (
                <Tabs defaultValue="codex">
                  <TabsList aria-label={t('mcpAccess.clientsLabel')}>
                    {clients.map((client) => (
                      <TabsTrigger key={client} value={client}>
                        {t('mcpAccess.clients.' + client + '.name')}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {clients.map((client) => (
                    <TabsContent
                      key={client}
                      value={client}
                      className="space-y-3"
                    >
                      <p className="text-sm text-muted-foreground">
                        {t('mcpAccess.clients.' + client + '.instructions')}
                      </p>
                      <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs leading-relaxed">
                        <code>{clientSetup(client, endpoint, exampleKey)}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void copy(
                            clientSetup(
                              client,
                              endpoint,
                              memberKey || exampleKey,
                            ),
                          )
                        }
                      >
                        <CopyIcon />
                        {t(
                          memberKey
                            ? 'mcpAccess.copyWithKey'
                            : 'mcpAccess.copySetup',
                        )}
                      </Button>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <a
                  className="text-sm underline underline-offset-4"
                  href="https://docs.openviking.ai/en/guides/06-mcp-integration#authentication"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('mcpAccess.docs')}
                </a>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('mcpAccess.noEndpoint')}
        </p>
      )}
      <Link
        to="/settings"
        className="inline-block text-sm underline underline-offset-4"
      >
        {t('mcpAccess.manageConnections')}
      </Link>
    </div>
  )
}
