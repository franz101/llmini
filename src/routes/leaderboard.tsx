import { createFileRoute } from '@tanstack/react-router'
import {
	Badge,
	Container,
	Group,
	Select,
	Table,
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

const COLUMNS: { key: keyof Model; label: string; tooltip?: string; format?: 'score' | 'price' | 'tokens' | 'latency' | 'speed' }[] = [
	{ key: 'name', label: 'Model' },
	{ key: 'organization', label: 'Org' },
	{ key: 'license', label: 'License' },
	{ key: 'context', label: 'Context', format: 'tokens' },
	{ key: 'input_price', label: 'In $/M', format: 'price' },
	{ key: 'output_price', label: 'Out $/M', format: 'price' },
	{ key: 'throughput', label: 'Speed', format: 'speed', tooltip: 'Tokens/sec' },
	{ key: 'index_reasoning', label: 'Reason', format: 'score' },
	{ key: 'index_math', label: 'Math', format: 'score' },
	{ key: 'index_code', label: 'Code', format: 'score' },
	{ key: 'coding_arena_score', label: 'Arena', format: 'score', tooltip: 'Coding Arena Elo' },
	{ key: 'gpqa_score', label: 'GPQA', format: 'score' },
	{ key: 'hle_score', label: 'HLE', format: 'score' },
	{ key: 'aime_2025_score', label: 'AIME', format: 'score' },
	{ key: 'swe_bench_verified_score', label: 'SWE-b', format: 'score' },
	{ key: 'mmmlu_score', label: 'MMMLU', format: 'score' },
	{ key: 'mmmu_score', label: 'MMMU', format: 'score' },
	{ key: 'arc_agi_v2_score', label: 'ARC', format: 'score' },
	{ key: 'browsecomp_score', label: 'Browse', format: 'score' },
	{ key: 'frontiermath_score', label: 'FMath', format: 'score' },
	{ key: 'scicode_score', label: 'SciCode', format: 'score' },
	{ key: 'release_date', label: 'Released' },
	{ key: 'params', label: 'Params', format: 'tokens' },
]

function formatValue(val: unknown, format?: string): string {
	if (val === null || val === undefined) return '–'
	if (format === 'score') {
		const n = Number(val)
		if (n >= 10) return n.toFixed(0)
		if (n >= 1) return (n * 100).toFixed(1) + '%'
		return n.toFixed(2)
	}
	if (format === 'price') return '$' + Number(val).toFixed(2)
	if (format === 'tokens') {
		const n = Number(val)
		if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M'
		if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
		return String(n)
	}
	if (format === 'latency') return Number(val).toFixed(0) + 'ms'
	if (format === 'speed') return Number(val).toFixed(0) + ' t/s'
	return String(val)
}

function scoreColor(val: number | null, format?: string): string {
	if (val === null || format !== 'score') return ''
	if (val >= 80) return 'text-emerald-600 font-semibold'
	if (val >= 60) return 'text-emerald-500'
	if (val >= 40) return 'text-amber-500'
	if (val >= 20) return 'text-orange-500'
	return 'text-red-400'
}

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
				list = list.filter(
					(m) => m.license && m.license !== 'proprietary'
				)
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
		if (sortKey === key) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
		} else {
			setSortKey(key)
			setSortDir('desc')
		}
	}

	const SortIcon = sortDir === 'asc' ? IconArrowUp : IconArrowDown

	return (
		<div className="min-h-screen bg-gray-50">
			<Container size="xl" className="py-8">
				{/* Header */}
				<div className="mb-6">
					<Group justify="space-between" align="end">
						<div>
							<Title
								order={1}
								className="text-2xl font-extrabold tracking-tight mb-1"
							>
								LLM Leaderboard
							</Title>
							<Text c="dimmed" size="sm">
								{data.models.length} models · benchmark scores from
								llm-stats.com · updated{' '}
								{new Date(data.scraped_at).toLocaleDateString()}
							</Text>
						</div>
						<Text size="xs" c="dimmed">
							Click column header to sort
						</Text>
					</Group>
				</div>

				{/* Filters */}
				<Group className="mb-4">
					<TextInput
						placeholder="Search models..."
						leftSection={<IconSearch size={14} />}
						value={search}
						onChange={(e) => setSearch(e.currentTarget.value)}
						w={260}
						size="sm"
					/>
					<Select
						placeholder="Organization"
						value={orgFilter}
						onChange={(v) => setOrgFilter(v || 'all')}
						data={[
							{ value: 'all', label: `All orgs (${orgs.length})` },
							...orgs.map((o) => ({ value: o, label: o })),
						]}
						w={200}
						size="sm"
						searchable
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
						w={160}
						size="sm"
					/>
					<Text size="xs" c="dimmed">
						{filtered.length} models shown
					</Text>
				</Group>

				{/* Table */}
				<div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
					<Table
						striped
						highlightOnHover
						className="text-xs"
						style={{ minWidth: 1600 }}
					>
						<Table.Thead className="bg-gray-50">
							<Table.Tr>
								{COLUMNS.map((col) => (
									<Table.Th
										key={col.key}
										className="cursor-pointer select-none whitespace-nowrap py-2 px-2 hover:bg-gray-100 transition-colors"
										onClick={() => handleSort(col.key)}
									>
										<Tooltip
											label={col.tooltip}
											disabled={!col.tooltip}
										>
											<Group gap={4} wrap="nowrap">
												<span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
													{col.label}
												</span>
												{sortKey === col.key && (
													<SortIcon
														size={10}
														className="text-gray-400"
													/>
												)}
											</Group>
										</Tooltip>
									</Table.Th>
								))}
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{filtered.map((m) => (
								<Table.Tr key={m.model_id} className="hover:bg-blue-50/30">
									{COLUMNS.map((col) => {
										const val = m[col.key]
										const formatted = formatValue(val, col.format)
										const colorClass = scoreColor(
											typeof val === 'number' ? val : null,
											col.format
										)
										return (
											<Table.Td
												key={col.key}
												className={`whitespace-nowrap py-1.5 px-2 ${
													col.key === 'name'
														? 'font-medium text-gray-900 max-w-[180px] truncate'
														: 'text-gray-600'
												} ${colorClass}`}
											>
												{col.key === 'name' ? (
													<a
														href={`https://llm-stats.com/models/${m.model_id}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-gray-900 hover:text-blue-600 no-underline transition-colors"
													>
														{String(val || '')}
													</a>
												) : col.key === 'license' ? (
													<Badge
														size="xs"
														variant="light"
														color={
															val === 'proprietary'
																? 'orange'
																: 'green'
														}
														className="font-normal"
													>
														{val === 'proprietary'
															? 'Prop'
															: String(val || '–')}
													</Badge>
												) : col.key === 'organization' ? (
													<span className="text-gray-500 text-[11px]">
														{String(val || '–').slice(0, 18)}
													</span>
												) : (
													formatted
												)}
											</Table.Td>
										)
									})}
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</div>

				{/* Footer */}
				<div className="mt-6 pt-4 border-t border-gray-200 text-center">
					<Text size="xs" c="dimmed">
						Data from{' '}
						<a
							href="https://llm-stats.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-500 hover:underline"
						>
							llm-stats.com
						</a>
						. Scores are normalized 0–100. Click model names for
						details.
					</Text>
				</div>
			</Container>
		</div>
	)
}
