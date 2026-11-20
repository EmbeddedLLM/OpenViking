import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  getContentDownload,
  getOvResult,
  ovClient,
} from '#/shared/api/ov-client/index'
import { Button } from '#/shared/ui/button'

type OriginalUpload = { filename: string; uri: string; can_retry: boolean }

function reportPreviewOrigin(): string | null {
  const configured = import.meta.env.VITE_OV_REPORT_PREVIEW_ORIGIN
  if (typeof configured !== 'string' || !configured.trim()) return null

  try {
    const url = new URL(configured)
    const localPreview = ['127.0.0.1', 'localhost', '[::1]'].includes(
      url.hostname,
    )
    const lanTest =
      import.meta.env.VITE_OV_REPORT_PREVIEW_ALLOW_HTTP === '1' &&
      window.location.protocol === 'http:' &&
      url.hostname === window.location.hostname
    if (
      url.origin !== window.location.origin &&
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && (localPreview || lanTest)))
    ) {
      return url.origin
    }
  } catch {
    return null
  }
  return null
}

async function originalBlob(uri: string): Promise<Blob> {
  const response = await getContentDownload({
    query: { uri },
    throwOnError: true,
    responseType: 'blob',
  })
  return response.data as Blob
}

export function ResourceOriginalActions({ uri }: { uri: string }) {
  const { t } = useTranslation('resources')
  const { data: original, refetch } = useQuery({
    queryKey: [
      'resource-original',
      ovClient.getOptions().baseUrl,
      ovClient.getConnection().accountId,
      ovClient.getConnection().userId,
      uri,
    ],
    queryFn: () =>
      getOvResult<OriginalUpload | null>(
        ovClient.client.get({
          url: '/api/v1/resources/original',
          query: { uri },
          throwOnError: true,
        }),
      ),
    enabled: /^viking:\/\/(?:resources\/|user\/[^/]+\/resources\/)/.test(uri),
    staleTime: 5_000,
  })
  const download = useMutation({
    mutationFn: async (file: OriginalUpload) => {
      const blob = await originalBlob(file.uri)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = file.filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    },
    onError: () => toast.error(t('original.fetchFailed')),
  })
  const retry = useMutation({
    mutationFn: (filename: string) =>
      getOvResult(
        ovClient.client.post({
          url: '/api/v1/resources/original/retry',
          body: { filename, uri },
          headers: { 'Content-Type': 'application/json' },
          throwOnError: true,
        }),
      ),
    onSuccess: () => {
      toast.success(t('original.queued'))
      void refetch()
    },
    onError: () => toast.error(t('original.retryFailed')),
  })

  if (!original) return null
  const previewOrigin = reportPreviewOrigin()
  const canOpen = previewOrigin && /\.html?$/i.test(original.filename)
  const openReport = async () => {
    if (!previewOrigin) return
    const tab = window.open('', '_blank')
    if (!tab) {
      toast.error(t('original.popupBlocked'))
      return
    }
    tab.opener = null
    const page = tab.document
    page.title = original.filename
    page.body.textContent = t('original.loading')
    try {
      const contents = await (await originalBlob(original.uri)).text()
      if (tab.closed) return
      const frame = page.createElement('iframe')
      // This is the trusted shim on the separate site. It puts the report
      // itself in a second iframe with scripts and an opaque origin.
      frame.sandbox.add('allow-scripts', 'allow-same-origin')
      frame.referrerPolicy = 'no-referrer'
      frame.title = original.filename
      const target = new URL('/preview.html', previewOrigin)
      target.hash = window.location.origin
      frame.src = target.href
      frame.style.cssText = 'display:block;width:100%;height:100vh;border:0'
      const channel = new MessageChannel()
      const expiry = window.setTimeout(() => {
        channel.port1.close()
        if (!tab.closed) page.body.textContent = t('original.fetchFailed')
      }, 10_000)
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === 'openviking-report-ready') {
          window.clearTimeout(expiry)
          channel.port1.postMessage(contents)
          channel.port1.close()
        }
      }
      frame.addEventListener(
        'load',
        () => {
          frame.contentWindow?.postMessage(
            'openviking-report-preview',
            previewOrigin,
            [channel.port2],
          )
        },
        { once: true },
      )
      page.body.style.margin = '0'
      page.body.replaceChildren(frame)
    } catch {
      if (!tab.closed) page.body.textContent = t('original.fetchFailed')
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-4 py-1">
      {canOpen ? (
        <Button size="sm" variant="ghost" onClick={() => void openReport()}>
          <ExternalLink className="size-4" />
          {t('original.open')}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={download.isPending}
        onClick={() => download.mutate(original)}
      >
        <Download className="size-4" />
        {t('original.download')}
      </Button>
      {original.can_retry ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={retry.isPending}
          onClick={() => retry.mutate(original.filename)}
        >
          <RotateCw className="size-4" />
          {t('original.retry')}
        </Button>
      ) : null}
    </div>
  )
}
