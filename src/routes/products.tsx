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
	ThemeIcon,
} from '@mantine/core'
import {
	IconCpu,
	IconServer,
	IconDeviceDesktop,
	IconDatabase,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import products from '~/data/products.json'

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
	other: string[]
	specs: string[]
}

const typedProducts = products as Product[]

export const Route = createFileRoute('/products')({
	component: ProductsPage,
})

function ProductsPage() {
	const [typeFilter, setTypeFilter] = useState<string>('all')
	const [sortBy, setSortBy] = useState<string>('price-desc')

	const filtered = useMemo(() => {
		let list = [...typedProducts]

		if (typeFilter === 'mac-mini') {
			list = list.filter((p) => p.name.includes('Mac mini'))
		} else if (typeFilter === 'imac') {
			list = list.filter((p) => p.name.includes('iMac'))
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
	}, [typeFilter, sortBy])

	const macMiniCount = typedProducts.filter((p) => p.name.includes('Mac mini')).length
	const iMacCount = typedProducts.filter((p) => p.name.includes('iMac')).length

	return (
		<div className="min-h-screen bg-gray-50">
			<Container size="xl" className="py-12">
				{/* Header */}
				<div className="mb-8">
					<Title order={1} className="text-3xl font-extrabold tracking-tight mb-2">
						Apple Products — 32‑64 GB RAM
					</Title>
					<Text c="dimmed" size="sm">
						Live prices from notebooksbilliger.de · Sorted by highest price
						first · {macMiniCount} Mac mini + {iMacCount} iMac configurations
					</Text>
				</div>

				{/* Filters */}
				<Group className="mb-8">
					<Select
						label="Product type"
						value={typeFilter}
						onChange={(v) => setTypeFilter(v || 'all')}
						data={[
							{ value: 'all', label: `All (${typedProducts.length})` },
							{ value: 'mac-mini', label: `Mac mini (${macMiniCount})` },
							{ value: 'imac', label: `iMac (${iMacCount})` },
						]}
						w={200}
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
										color={p.availability === 'In stock' ? 'green' : 'orange'}
										variant="light"
										size="sm"
									>
										{p.availability}
									</Badge>
									<Badge color="gray" variant="outline" size="sm">
										{p.name.includes('iMac') ? 'iMac' : 'Mac mini'}
									</Badge>
								</Group>

								<Title order={3} size="h6" className="font-semibold mb-3 line-clamp-2">
									{p.name}
								</Title>

								{/* Key specs */}
								<div className="space-y-1.5 mb-4 text-sm">
									{p.cpu && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconCpu size={14} className="text-gray-400 flex-shrink-0" />
											<Text size="xs" c="dimmed" truncate>
												{p.cpu}
											</Text>
										</div>
									)}
									{p.gpu && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconServer size={14} className="text-gray-400 flex-shrink-0" />
											<Text size="xs" c="dimmed" truncate>
												{p.gpu}
											</Text>
										</div>
									)}
									{p.ram && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconDeviceDesktop size={14} className="text-gray-400 flex-shrink-0" />
											<Text size="xs" c="dimmed">
												{p.ram}
											</Text>
										</div>
									)}
									{p.storage && (
										<div className="flex items-center gap-2 text-gray-600">
											<IconDatabase size={14} className="text-gray-400 flex-shrink-0" />
											<Text size="xs" c="dimmed" truncate>
												{p.storage}
											</Text>
										</div>
									)}
								</div>

								{/* Connectivity chips */}
								{p.connectivity.length > 0 && (
									<Group gap={4} className="mb-4">
										{p.connectivity.slice(0, 4).map((c) => (
											<Badge
												key={c}
												variant="light"
												color="gray"
												size="xs"
												className="font-normal"
											>
												{c.slice(0, 25)}
											</Badge>
										))}
									</Group>
								)}

								{/* Price + CTA */}
								<div className="flex items-end justify-between pt-3 border-t border-gray-100">
									<div>
										<Text size="xl" className="font-extrabold tracking-tight">
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
									>
										View →
									</Button>
								</div>
							</div>
						</Card>
					))}
				</SimpleGrid>

				{/* Footer note */}
				<div className="mt-12 pt-6 border-t border-gray-200 text-center">
					<Text size="xs" c="dimmed">
						Product data scraped from notebooksbilliger.de. Prices and
						availability may vary. Click "View" to see the current listing.
					</Text>
				</div>
			</Container>
		</div>
	)
}
