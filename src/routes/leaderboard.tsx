import { createFileRoute } from '@tanstack/react-router'
import {
	Badge,
	Container,
	Group,
	Select,
	Text,
	TextInput,
	Title,
	Tooltip,
} from '@mantine/core'
import { IconSearch, IconArrowUp, IconArrowDown } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import leaderboardData from '~/data/llmstats_leaderboard.json'

interface Model {
	model_id: string
	name: string
	organization: string
	organization_id: string
	organization_country: string | null
	params: number | null
	context: number | null
	release_date: string | null
	multimodal: boolean | null
	license: string | null
	knowledge_cutoff: string | null
	input_price: number | null
	output_price: number | null
	throughput: number | null
	latency: number | null
	gpqa_score: number | null
	hle_score: number | null
	aime_2025_score: number | null
	swe_bench_verified_score: number | null
	mmmlu_score: number | null
	mmmu_score: number | null
	arc_agi_v2_score: number | null
	browsecomp_score: number | null
	frontiermath_score: number | null
	mrcr_v2_score: number | null
	scicode_score: number | null
	apex_agents_score: number | null
	swe_bench_pro_score: number | null
	mmmu_pro_score: number | null
	screenspot_pro_score: number | null
	mcp_atlas_score: number | null
	simpleqa_score: number | null
	osworld_score: number | null
	toolathlon_score: number | null
	terminal_bench_score: number | null
	tau_bench_retail_score: number | null
	charxiv_r_score: number | null
	coding_arena_score: number | null
	index_reasoning: number | null
	index_math: number | null
	index_code: number | null
	index_search: number | null
	index_communication: number | null
	index_vision: number | null
	index_tool_calling: number | null
	index_long_context: number | null
	index_finance: number | null
	index_legal: number | null
	index_healthcare: number | null
}

const data = leaderboardData as { models: Model[]; scraped_at: string }

type SortKey = keyof Model | ''

// Column definitions with explicit score types
type ScoreFormat = 'index' | 'benchmark' | 'elo'
type ColFormat = ScoreFormat | 'price' | 'tokens' | 'speed' | 'text'

const COLUMNS: { key: keyof Model; label: string; tooltip?: string; format: ColFormat }[] = [
	{ key: 'name', label: 'Model', format: 'text' },
	{ key: 'organization', label: 'Org', format: 'text' },
	{ key: 'license', label: 'License', format: 'text' },
	{ key: 'context', label: 'Context', format: 'tokens' },
	{ key: 'input_price', label: 'In $/M', format: 'price' },
	{ key: 'output_price', label: 'Out $/M', format: 'price' },
	{ key: 'throughput', label: 't/s', format: 'speed', tooltip: 'Tokens/sec' },
	{ key: 'index_reasoning', label: 'Reason', format: 'index' },
	{ key: 'index_math', label: 'Math', format: 'index' },
	{ key: 'index_code', label: 'Code', format: 'index' },
	{ key: 'coding_arena_score', label: 'Arena', format: 'elo', tooltip: 'Coding Arena Elo' },
	{ key: 'gpqa_score', label: 'GPQA', format: 'benchmark' },
	{ key: 'hle_score', label: 'HLE', format: 'benchmark' },
	{ key: 'aime_2025_score', label: 'AIME', format: 'benchmark' },
	{ key: 'swe_bench_verified_score', label: 'SWE-b', format: 'benchmark' },
	{ key: 'mmmlu_score', label: 'MMMLU', format: 'benchmark' },
	{ key: 'mmmu_score', label: 'MMMU', format: 'benchmark' },
	{ key: 'arc_agi_v2_score', label: 'ARC', format: 'benchmark' },
	{ key: 'browsecomp_score', label: 'Browse', format: 'benchmark' },
	{ key: 'frontiermath_score', label: 'FMath', format: 'benchmark' },
	{ key: 'scicode_score', label: 'SciCode', format: 'benchmark' },
	{ key: 'release_date', label: 'Released', format: 'text' },
	{ key: 'params', label: 'Params', format: 'tokens' },
]

// ─── Formatting ────────────────────────────────────────────────────────

function formatCell(val: unknown, format: ColFormat): string {
	if (val === null || val === undefined) return '–'
	const n = Number(val)

	switch (format) {
		case 'index':
			return isNaN(n) ? '–' : n.toFixed(0)
		case 'benchmark':
			return isNaN(n) ? '–' : (n * 100).toFixed(0) + '%'
		case 'elo':
			return isNaN(n) ? '–' : n.toFixed(0)
		case 'price':
			return '$' + n.toFixed(2)
		case 'tokens': {
			if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
			if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M'
			if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
			return String(n)
		}
		case 'speed':
			return isNaN(n) ? '–' : n.toFixed(0) + ' t/s'
		default:
			return String(val)
	}
}

/**
 * Returns a cell background highlight class based on the score value.
 * Index scores: 0-100, benchmark scores: 0-1, elo: 600-2000+
 * Background highlight is much more readable than colored text.
 */
function scoreHighlight(val: number | null, format: ColFormat): string {
	if (val === null) return ''

	let pct = 0
	if (format === 'index') pct = val / 100
	else if (format === 'benchmark') pct = val
	else if (format === 'elo') pct = Math.max(0, Math.min(1, (val - 600) / 1400))

	if (pct >= 0.9) return 'bg-emerald-100 text-emerald-900'
	if (pct >= 0.8) return 'bg-emerald-50 text-emerald-800'
	if (pct >= 0.7) return 'bg-lime-50 text-lime-800'
	if (pct >= 0.6) return 'bg-yellow-50 text-yellow-800'
	if (pct >= 0.4) return 'bg-amber-50 text-amber-800'
	if (pct >= 0.2) return 'bg-orange-50 text-orange-800'
	return 'bg-red-50 text-red-800'
}

function licenseLabel(license: string | null): string {
	if (!license) return '–'
	const l = license.toLowerCase()
	if (l.includes('apache')) return 'Apache'
	if (l.includes('mit')) return 'MIT'
	if (l.includes('proprietary')) return 'Prop'
	if (l.includes('open') || l.includes('cc-') || l.includes('llama')) return 'Open'
	return license.slice(0, 12)
}

function licenseColor(license: string | null): string {
	if (!license) return 'gray'
	const l = license.toLowerCase()
	if (l === 'proprietary') return 'orange'
	return 'green'
}

// ─── Page ──────────────────────────────────────────────────────────────

export const Route = createFileRoute('/leaderboard')({
	component: LeaderboardPage,
})

function LeaderboardPage() {
	const [search, setSearch] = useState('')
	const [orgFilter, setOrgFilter] = useState<string>('all')
	const [licenseFilter, setLicenseFilter] = useState<string>('all')
	const [sortKey, setSortKey] = useState<SortKey>('index_reasoning')
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

	const orgs = useMemo(() => {
		const set = new Set<string>()
		for (const m of data.models) {
			if (m.organization) set.add(m.organization)
		}
		return [...set].sort()
	}, [])

	const filtered = useMemo(() => {
		let list = [...data.models]

		if (search) {
			const q = search.toLowerCase()
			list = list.filter(
				(m) =>
					m.name.toLowerCase().includes(q) ||
					m.organization.toLowerCase().includes(q) ||
					m.model_id.toLowerCase().includes(q)
			)
		}

		if (orgFilter !== 'all') {
			list = list.filter((m) => m.organization === orgFilter)
		}

		if (licenseFilter !== 'all') {
			if (licenseFilter === 'proprietary')
				list = list.filter((m) => m.license === 'proprietary')
			else if (licenseFilter === 'open')
				list = list.filter((m) => m.license && m.license !== 'proprietary')
		}

		if (sortKey) {
			list.sort((a, b) => {
				const av = a[sortKey]
				const bv = b[sortKey]
				if (av === null && bv === null) return 0
				if (av === null) return 1
				if (bv === null) return -1
				if (av < bv) return sortDir === 'asc' ? -1 : 1
				if (av > bv) return sortDir === 'asc' ? 1 : -1
				return 0
			})
		}

		return list
	}, [search, orgFilter, licenseFilter, sortKey, sortDir])

	function handleSort(key: keyof Model) {
		if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
		else { setSortKey(key); setSortDir('desc') }
	}

	const SortIcon = sortDir === 'asc' ? IconArrowUp : IconArrowDown

	return (
		<div className="min-h-screen bg-gray-50">
			<Container size="xl" className="py-8">
				{/* Header */}
				<div className="mb-6">
					<Group justify="space-between" align="end">
						<div>
							<Title order={1} className="text-2xl font-extrabold tracking-tight mb-1">
								LLM Leaderboard
							</Title>
							<Text c="dimmed" size="sm">
								{data.models.length} models · benchmark scores from llm-stats.com
								{' · '}updated {new Date(data.scraped_at).toLocaleDateString()}
							</Text>
						</div>
						<Text size="xs" c="dimmed">Click column header to sort</Text>
					</Group>
				</div>

				{/* Filters */}
				<Group className="mb-4">
					<TextInput
						placeholder="Search models..."
						leftSection={<IconSearch size={14} />}
						value={search}
						onChange={(e) => setSearch(e.currentTarget.value)}
						w={260} size="sm"
					/>
					<Select
						placeholder="Organization"
						value={orgFilter}
						onChange={(v) => setOrgFilter(v || 'all')}
						data={[
							{ value: 'all', label: `All orgs (${orgs.length})` },
							...orgs.map((o) => ({ value: o, label: o })),
						]}
						w={200} size="sm" searchable
					/>
					<Select
						placeholder="License"
						value={licenseFilter}
						onChange={(v) => setLicenseFilter(v || 'all')}
						data={[
							{ value: 'all', label: 'All licenses' },
							{ value: 'proprietary', label: 'Proprietary' },
							{ value: 'open', label: 'Open-source' },
						]}
						w={160} size="sm"
					/>
					<Badge variant="light" color="gray" size="lg" className="font-normal">
						{filtered.length} models
					</Badge>
				</Group>

				{/* Table */}
				<div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
					<table className="w-full text-sm" style={{ minWidth: 1700 }}>
						<thead>
							<tr className="border-b-2 border-gray-200 bg-gray-100">
								{COLUMNS.map((col) => (
									<th
										key={col.key}
										className="cursor-pointer select-none whitespace-nowrap py-2.5 px-3 text-left hover:bg-gray-200 transition-colors"
										onClick={() => handleSort(col.key)}
									>
										<Tooltip label={col.tooltip} disabled={!col.tooltip}>
											<div className="flex items-center gap-1">
												<span className="text-[13px] font-semibold text-gray-700 uppercase tracking-tight">
													{col.label}
												</span>
												{sortKey === col.key && (
													<SortIcon size={12} className="text-gray-500" />
												)}
											</div>
										</Tooltip>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{filtered.map((m, i) => (
								<tr
									key={m.model_id}
									className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${
										i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
									}`}
								>
									{COLUMNS.map((col) => {
										const val = m[col.key]
										const formatted = formatCell(val, col.format)
										const highlight =
											col.format === 'index' ||
											col.format === 'benchmark' ||
											col.format === 'elo'
												? scoreHighlight(
														typeof val === 'number' ? val : null,
														col.format
													)
												: ''

										return (
											<td
												key={col.key}
												className={`whitespace-nowrap py-2 px-3 ${
													col.key === 'name'
														? 'font-semibold text-gray-900 max-w-[200px] truncate'
														: col.format === 'text'
															? 'text-gray-600'
															: 'text-gray-800 text-center'
												} ${highlight}`}
											>
												{col.key === 'name' ? (
													<a
														href={`https://llm-stats.com/models/${m.model_id}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-gray-900 hover:text-blue-600 no-underline"
													>
														{String(val || '')}
													</a>
												) : col.key === 'license' ? (
													<Badge
														size="sm"
														variant="light"
														color={licenseColor(val as string | null)}
														className="font-medium"
													>
														{licenseLabel(val as string | null)}
													</Badge>
												) : col.key === 'organization' ? (
													<span className="text-gray-500 text-xs">
														{String(val || '–').slice(0, 20)}
													</span>
												) : (
													formatted
												)}
											</td>
										)
									})}
								</tr>
							))}
						</tbody>
					</table>

					{filtered.length === 0 && (
						<div className="text-center py-16">
							<Text c="dimmed">No models match your filters.</Text>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="mt-6 pt-4 border-t border-gray-200 text-center">
					<Text size="xs" c="dimmed">
						Data from{' '}
						<a href="https://llm-stats.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
							llm-stats.com
						</a>
						. Index scores: 0–100. Benchmarks: 0–100%. Arena: Elo. Click model names for details.
					</Text>
				</div>
			</Container>
		</div>
	)
}
