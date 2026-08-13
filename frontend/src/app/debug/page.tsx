'use client'

/**
 * Debug — admin-only ticket inspection (feature 0020, ADR 0076).
 *
 * Enter a Jira issue key to see everything stored in our Postgres mirror for
 * that ticket: the issue row, changelog, sprint memberships, issue links, and
 * linked roadmap ideas, plus a collapsible raw JSON dump. Read-only; stored
 * data only (no live Jira).
 */
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { useReplaceParams } from '@/hooks/use-page-params'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  getIssueDebug,
  getSnapshotStatus,
  getSyncStatus,
  ApiError,
  type IssueDebugResponse,
  type IssueDebugChangelogEntry,
  type IssueDebugSprintMembership,
  type IssueDebugLink,
  type IssueDebugRoadmapIdea,
  type BoardSnapshotStatus,
  type SyncStatusItem,
} from '@/lib/api'

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: IssueDebugResponse }
  | { status: 'not-found'; key: string }
  | { status: 'error'; message: string }

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">
        {title}
        {count !== undefined && <span className="ml-1 text-text-muted">({count})</span>}
      </h2>
      {children}
    </section>
  )
}

const changelogColumns: Column<IssueDebugChangelogEntry>[] = [
  { key: 'field', label: 'Field', sortable: true },
  { key: 'fromValue', label: 'From', render: (_v, r) => r.fromValue ?? r.fromId ?? '—' },
  { key: 'toValue', label: 'To', render: (_v, r) => r.toValue ?? r.toId ?? '—' },
  { key: 'changedAt', label: 'Changed At', sortable: true },
]

const sprintColumns: Column<IssueDebugSprintMembership>[] = [
  { key: 'sprintId', label: 'Sprint ID', sortable: true },
  { key: 'name', label: 'Name', render: (_v, r) => r.name ?? '(missing sprint)' },
  { key: 'state', label: 'State', render: (_v, r) => r.state ?? '—' },
  { key: 'startDate', label: 'Start', render: (_v, r) => r.startDate ?? '—' },
  { key: 'endDate', label: 'End', render: (_v, r) => r.endDate ?? '—' },
  { key: 'completeDate', label: 'Completed', render: (_v, r) => r.completeDate ?? '—' },
]

const linkColumns: Column<IssueDebugLink>[] = [
  { key: 'linkTypeName', label: 'Type', sortable: true },
  { key: 'sourceIssueKey', label: 'Source', sortable: true },
  { key: 'targetIssueKey', label: 'Target', sortable: true },
  { key: 'isInward', label: 'Inward', render: (_v, r) => (r.isInward ? 'yes' : 'no') },
]

const ideaColumns: Column<IssueDebugRoadmapIdea>[] = [
  { key: 'key', label: 'Idea', sortable: true },
  { key: 'summary', label: 'Summary' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'matchReason', label: 'Matched via', sortable: true },
  { key: 'targetDate', label: 'Target', render: (_v, r) => r.targetDate ?? '—' },
]

const snapshotColumns: Column<BoardSnapshotStatus>[] = [
  { key: 'boardId', label: 'Board', sortable: true },
  { key: 'computedAt', label: 'Computed At', sortable: true, render: (_v, r) => r.computedAt ?? '—' },
  {
    key: 'isStale',
    label: 'Freshness',
    render: (_v, r) => (r.isStale === null ? '—' : r.isStale ? 'stale' : 'fresh'),
  },
  { key: 'hasAggregate', label: 'Aggregate', render: (_v, r) => (r.hasAggregate ? 'yes' : 'no') },
  { key: 'hasTrend', label: 'Trend', render: (_v, r) => (r.hasTrend ? 'yes' : 'no') },
]

const syncColumns: Column<SyncStatusItem>[] = [
  { key: 'boardId', label: 'Board', sortable: true },
  { key: 'lastSync', label: 'Last Sync', sortable: true, render: (_v, r) => r.lastSync ?? '—' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'syncType', label: 'Type', render: (_v, r) => r.syncType ?? '—' },
]

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T[] }
  | { status: 'error'; message: string }

/** Loads a list once on mount; each caller owns its own state so one section
 *  failing never affects the others or the ticket inspector. */
function useList<T extends object>(fetcher: () => Promise<T[]>): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load',
          })
      })
    return () => {
      cancelled = true
    }
    // fetcher is a module-level function reference — stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}

function ListSection<T extends object>({
  title,
  state,
  columns,
}: {
  title: string
  state: LoadState<T>
  columns: Column<T>[]
}) {
  if (state.status === 'loading') {
    return (
      <Section title={title}>
        <p className="text-sm text-muted">Loading…</p>
      </Section>
    )
  }
  if (state.status === 'error') {
    return (
      <Section title={title}>
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="text-red-700 dark:text-red-300">{state.message}</p>
        </div>
      </Section>
    )
  }
  if (state.data.length === 0) {
    return (
      <Section title={title} count={0}>
        <p className="text-sm text-muted">No data.</p>
      </Section>
    )
  }
  return (
    <Section title={title} count={state.data.length}>
      <DataTable columns={columns} data={state.data} />
    </Section>
  )
}

function IssueFields({ data }: { data: IssueDebugResponse }) {
  const entries = Object.entries(data.issue)
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-xl border border-border p-4 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-sm">
          <dt className="min-w-[110px] font-medium text-text-muted">{k}</dt>
          <dd className="break-all font-mono">{Array.isArray(v) ? v.join(', ') : String(v ?? '—')}</dd>
        </div>
      ))}
    </dl>
  )
}

function DebugPageInner() {
  const searchParams = useSearchParams()
  const replaceParams = useReplaceParams()

  const keyParam = searchParams.get('key') ?? ''
  const [input, setInput] = useState(keyParam)
  const [pageState, setPageState] = useState<PageState>({ status: 'idle' })

  const snapshotState = useList<BoardSnapshotStatus>(getSnapshotStatus)
  const syncState = useList<SyncStatusItem>(getSyncStatus)

  const submit = useCallback((e: FormEvent) => {
    e.preventDefault()
    replaceParams({ key: input.trim() || null })
  }, [input, replaceParams])

  useEffect(() => {
    const key = keyParam.trim()
    if (!key) {
      setPageState({ status: 'idle' })
      return
    }

    let cancelled = false
    setPageState({ status: 'loading' })

    getIssueDebug(key)
      .then((data) => {
        if (!cancelled) setPageState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setPageState({ status: 'not-found', key })
        } else {
          setPageState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load data',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [keyParam])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Debug</h1>
        <p className="mt-1 text-sm text-muted">
          Enter a ticket key to see everything currently stored about it in our database.
          Read-only — reflects our mirror, not live Jira.
        </p>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. ACC-123"
          aria-label="Ticket key"
          className="w-56 rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono dark:bg-transparent"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-interactive-hover-bg"
        >
          Inspect
        </button>
      </form>

      {pageState.status === 'loading' && <p className="text-sm text-muted">Loading…</p>}

      {pageState.status === 'not-found' && (
        <p className="text-sm text-muted">No stored data for “{pageState.key}”.</p>
      )}

      {pageState.status === 'error' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="text-red-700 dark:text-red-300">{pageState.message}</p>
        </div>
      )}

      {pageState.status === 'ready' && (
        <div className="space-y-6">
          <Section title="Issue">
            <IssueFields data={pageState.data} />
          </Section>

          <Section title="Changelog" count={pageState.data.changelog.length}>
            <DataTable columns={changelogColumns} data={pageState.data.changelog} />
          </Section>

          <Section title="Sprint memberships" count={pageState.data.sprintMemberships.length}>
            <DataTable columns={sprintColumns} data={pageState.data.sprintMemberships} />
          </Section>

          <Section title="Links (as source)" count={pageState.data.linksAsSource.length}>
            <DataTable columns={linkColumns} data={pageState.data.linksAsSource} />
          </Section>

          <Section title="Links (as target)" count={pageState.data.linksAsTarget.length}>
            <DataTable columns={linkColumns} data={pageState.data.linksAsTarget} />
          </Section>

          <Section title="Roadmap ideas" count={pageState.data.roadmapIdeas.length}>
            <DataTable columns={ideaColumns} data={pageState.data.roadmapIdeas} />
          </Section>

          <details className="rounded-xl border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
              Raw JSON
            </summary>
            <pre className="overflow-x-auto border-t border-border px-4 py-3 text-xs">
              {JSON.stringify(pageState.data, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <ListSection title="Snapshots" state={snapshotState} columns={snapshotColumns} />
      <ListSection title="Sync status" state={syncState} columns={syncColumns} />
    </div>
  )
}

export default function DebugPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <DebugPageInner />
    </Suspense>
  )
}
