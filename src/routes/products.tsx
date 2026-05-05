import { createFileRoute } from '@tanstack/react-router'
import {
	Badge,
	Button,
	Card,
	Container,
	Group,
	Image,
	Select,
	SimpleGrid,
	Text,
	Title,
} from '@mantine/core'
import {
	IconCpu,
	IconServer,
	IconDeviceDesktop,
	IconDatabase,
	IconExternalLink,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import productsNbb from '~/data/products.json'
import productsIdealo from '~/data/products_idealo.json'

interface Product {
	name: string
	price: number
	priceFormatted: string
	imageUrl: string
	productUrl: string
	availability: string
	ram: string
	storage: string
	cpu: string
	gpu: string
	os: string
	formFactor: string
	connectivity: string[]
	specs: string[]
	source: string
}

// Merge both sources, deduplicate by normalized name
const nbbProducts: Product[] = (productsNbb as any[]).map((p: any) => ({
	...p,
	availability: p.availability || 'Unknown',
	source: 'NBB',
	connectivity: p.connectivity || [],
	specs: p.specs || [],
}))

const idealoProducts: Product[] = (productsIdealo as any[]).map((p: any) => ({
	...p,
	availability: p.offerCount > 0 ? 'In stock' : 'Unknown',
	source: 'Idealo',
	connectivity: p.connectivity || [],
	specs: p.specs || [],
}))

// Dedupe: prefer idealo for matching names (better parsed specs)
const seenNames = new Set<string>()
const allProducts: Product[] = []
for (const p of [...idealoProducts, ...nbbProducts]) {
	const key = p.name.toLowerCase().replace(/\s+/g, ' ').trim()
	if (!seenNames.has(key)) {
		seenNames.add(key)
		allProducts.push(p)
	}
}

export const Route = createFileRoute('/products')({
	component: ProductsPage,
})

function ProductsPage() {
	const [typeFilter, setTypeFilter] = useState<string>('mac-mini')
	const [sortBy, setSortBy] = useState<string>('price-desc')
	const [sourceFilter, setSourceFilter] = useState<string>('all')

	const filtered = useMemo(() => {
		let list = [...allProducts]

		if (typeFilter === 'mac-mini') {
			list = list.filter((p) => p.name.toLowerCase().includes('mac mini'))
		} else if (typeFilter === 'imac') {
			list = list.filter((p) => p.name.toLowerCase().includes('imac'))
		} else if (typeFilter === 'mac-studio') {
			list = list.filter((p) => p.name.toLowerCase().includes('mac studio'))
		}

		if (sourceFilter === 'nbb') {
			list = list.filter((p) => p.source === 'NBB')
		} else if (sourceFilter === 'idealo') {
			list = list.filter((p) => p.source === 'Idealo')
		}

		switch (sortBy) {
			case 'price-asc':
				list.sort((a, b) => a.price - b.price)
				break
			case 'price-desc':
				list.sort((a, b) => b.price - a.price)
				break
			case 'ram-desc':
				list.sort((a, b) => {
					const ra = Number.parseInt(a.ram) || 0
					const rb = Number.parseInt(b.ram) || 0
					return rb - ra
				})
				break
			case 'name':
				list.sort((a, b) => a.name.localeCompare(b.name))
				break
		}

		return list
	}, [typeFilter, sortBy, sourceFilter])

	const macMiniCount = allProducts.filter((p) =>
		p.name.toLowerCase().includes('mac mini')
	).length
	const iMacCount = allProducts.filter((p) =>
		p.name.toLowerCase().includes('imac')
	).length
	const macStudioCount = allProducts.filter((p) =>
		p.name.toLowerCase().includes('mac studio')
	).length

	return (
		<div className="min-h-screen bg-gray-50">
			<Container size="xl" className="py-12">
				{/* Header */}
				<div className="mb-8">
					<Title
						order={1}
						className="text-3xl font-extrabold tracking-tight mb-2"
					>
						Apple Silicon Macs — 32‑64 GB RAM
					</Title>
					<Text c="dimmed" size="sm">
						Live prices from notebooksbilliger.de & idealo.de ·{' '}
						{macMiniCount} Mac mini + {iMacCount} iMac + {macStudioCount} Mac
						Studio configurations
					</Text>
				</div>

				{/* Filters */}
				<Group className="mb-8">
					<Select
						label="Product type"
						value={typeFilter}
						onChange={(v) => setTypeFilter(v || 'mac-mini')}
						data={[
							{ value: 'all', label: `All (${allProducts.length})` },
							{
								value: 'mac-mini',
								label: `Mac mini (${macMiniCount})`,
							},
							{
								value: 'mac-studio',
								label: `Mac Studio (${macStudioCount})`,
							},
							{ value: 'imac', label: `iMac (${iMacCount})` },
						]}
						w={220}
					/>
					<Select
						label="Source"
						value={sourceFilter}
						onChange={(v) => setSourceFilter(v || 'all')}
						data={[
							{ value: 'all', label: 'All sources' },
							{ value: 'nbb', label: 'NBB' },
							{ value: 'idealo', label: 'Idealo' },
						]}
						w={160}
					/>
					<Select
						label="Sort by"
						value={sortBy}
						onChange={(v) => setSortBy(v || 'price-desc')}
						data={[
							{ value: 'price-desc', label: 'Price ↓' },
							{ value: 'price-asc', label: 'Price ↑' },
							{ value: 'ram-desc', label: 'RAM ↓' },
							{ value: 'name', label: 'Name A‑Z' },
						]}
						w={160}
					/>
				</Group>

				{/* Product Grid */}
				<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
					{filtered.map((p) => (
						<Card
							key={p.name}
							shadow="sm"
							padding="lg"
							radius="md"
							withBorder
							className="bg-white hover:shadow-md transition-shadow"
						>
							<Card.Section className="bg-gray-100 p-4 flex items-center justify-center h-48">
								{p.imageUrl ? (
									<Image
										src={p.imageUrl}
										alt={p.name}
										fit="contain"
										h={160}
										fallbackSrc="https://placehold.co/200x160/f3f4f6/9ca3af?text=No+Image"
									/>
								) : (
									<Text c="dimmed" size="sm">
										No image
									</Text>
								)}
							</Card.Section>

							<div className="mt-4">
								<Group justify="space-between" className="mb-2">
									<Badge
										color={
											p.availability === 'In stock'
												? 'green'
												: 'orange'
										}
										variant="light"
										size="sm"
									>
										{p.availability}
									</Badge>
									<Badge color="gray" variant="outline" size="sm">
										{p.source}
									</Badge>
								</Group>

								<Title
									order={3}
									size="h6"
									className="font-semibold mb-3 line-clamp-2"
								>
									{p.name}
								</Title>

								{/* Key specs */}
								<div className="space-y-1.5 mb-4 text-sm">
									{p.cpu && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconCpu
												size={14}
												className="text-gray-400 flex-shrink-0"
											/>
											<Text size="xs" c="dimmed" truncate>
												{p.cpu}
											</Text>
										</div>
									)}
									{p.gpu && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconServer
												size={14}
												className="text-gray-400 flex-shrink-0"
											/>
											<Text size="xs" c="dimmed" truncate>
												{p.gpu}
											</Text>
										</div>
									)}
									{p.ram && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconDeviceDesktop
												size={14}
												className="text-gray-400 flex-shrink-0"
											/>
											<Text size="xs" c="dimmed">
												{p.ram}
											</Text>
										</div>
									)}
									{p.storage && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconDatabase
												size={14}
												className="text-gray-400 flex-shrink-0"
											/>
											<Text size="xs" c="dimmed" truncate>
												{p.storage}
											</Text>
										</div>
									)}
								</div>

								{/* Price + CTA */}
								<div className="flex items-end justify-between pt-3 border-t border-gray-100">
									<div>
										<Text
											size="xl"
											className="font-extrabold tracking-tight"
										>
											{p.priceFormatted}
										</Text>
										<Text size="xs" c="dimmed">
											inkl. MwSt.
										</Text>
									</div>
									<Button
										component="a"
										href={p.productUrl || '#'}
										target="_blank"
										rel="noopener noreferrer"
										variant="filled"
										color="dark"
										size="sm"
										radius="md"
										rightSection={<IconExternalLink size={14} />}
									>
										View
									</Button>
								</div>
							</div>
						</Card>
					))}
				</SimpleGrid>

				{/* Empty state */}
				{filtered.length === 0 && (
					<div className="text-center py-20">
						<Text c="dimmed" size="lg">
							No products match your filters.
						</Text>
					</div>
				)}

				{/* Footer note */}
				<div className="mt-12 pt-6 border-t border-gray-200 text-center">
					<Text size="xs" c="dimmed">
						Product data scraped from notebooksbilliger.de & idealo.de.
						Prices and availability may vary. Click "View" to see the
						current listing.
					</Text>
				</div>
			</Container>
		</div>
	)
}
