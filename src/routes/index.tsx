import { createFileRoute } from '@tanstack/react-router'
import {
	Accordion,
	Button,
	Container,
	Text,
	ThemeIcon,
	Title,
} from '@mantine/core'
import {
	IconCheck,
	IconX,
	IconShieldLock,
	IconCpu,
	IconFileText,
	IconHeadset,
	IconServer,
} from '@tabler/icons-react'

export const Route = createFileRoute('/')({
	component: Home,
})

function Home() {
	return (
		<div className="min-h-screen bg-white text-gray-900">
			<Nav />
			<Hero />
			<ValueProp />
			<Comparison />
			<Features />
			<HowItWorks />
			<Pricing />
			<Audience />
			<Legal />
			<FAQ />
			<FinalCTA />
			<Footer />
		</div>
	)
}

function Nav() {
	return (
		<header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
			<Container size="lg" className="flex items-center justify-between h-16">
				<a
					href="/"
					className="text-xl font-extrabold tracking-tight text-gray-900 no-underline"
				>
					LLMINI
				</a>
				<div className="flex items-center gap-4">
					<a
						href="/products"
						className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors no-underline"
					>
						Browse Models
					</a>
					<a
						href="/leaderboard"
						className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors no-underline"
					>
						Leaderboard
					</a>
					<a
						href="#faq"
						className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors no-underline"
					>
						FAQ
					</a>
					<a
						href="#pricing"
						className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors no-underline"
					>
						Pricing
					</a>
					<Button
						component="a"
						href="#cta"
						variant="filled"
						color="dark"
						size="sm"
						radius="md"
					>
						Get your LLmini →
					</Button>
				</div>
			</Container>
		</header>
	)
}

function Hero() {
	return (
		<section className="pt-32 pb-20 md:pt-40 md:pb-28 bg-gradient-to-b from-gray-50 to-white">
			<Container size="md" className="text-center">
				<div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-gray-100 text-sm font-medium text-gray-700">
					<IconCpu size={16} />
					Private AI, physically yours
				</div>
				<Title
					order={1}
					className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6"
				>
					Your private AI.
					<br />
					<span className="text-gray-400">On a Mac mini.</span>
					<br />
					Ready to run.
				</Title>
				<Text size="lg" c="dimmed" className="max-w-xl mx-auto mb-4">
					A genuine Mac mini with a local Llama‑based LLM stack, fully
					configured, tested, and shipped to you.
				</Text>
				<Text size="lg" c="dimmed" className="max-w-xl mx-auto mb-10">
					Plug it in. Your data never leaves the device.
				</Text>
				<Text size="sm" className="text-gray-500 mb-8">
					Subscription: €20/month for expert support, updates, and a
					maintained document‑structuring pipeline.
				</Text>
				<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
					<Button
						component="a"
						href="#cta"
						size="lg"
						radius="md"
						color="dark"
						className="px-8"
					>
						Get your LLmini →
					</Button>
					<Button
						component="a"
						href="mailto:hello@llmini.com"
						size="lg"
						radius="md"
						variant="outline"
						color="dark"
						className="px-8"
					>
						Book a demo
					</Button>
				</div>
			</Container>
		</section>
	)
}

function ValueProp() {
	return (
		<section className="py-16 bg-white">
			<Container size="md" className="text-center">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight mb-6"
				>
					Stop renting your AI. Own it.
				</Title>
				<Text size="lg" c="dimmed" className="max-w-2xl mx-auto leading-relaxed">
					Most LLM tools send your documents to the cloud. That means
					compliance nightmares, per‑token surprise bills, and someone else's
					server reading your data.
				</Text>
				<Text
					size="lg"
					c="dark"
					className="max-w-2xl mx-auto mt-4 font-semibold"
				>
					LLmini is different. It's a physical appliance that lives on your
					desk, runs open‑weight models locally, and keeps everything you feed
					it strictly on‑premise. No telemetry, no egress, no API key. Just
					your AI, your rules.
				</Text>
			</Container>
		</section>
	)
}

function Comparison() {
	const rows = [
		{
			badge: 'Cloud‑based AI',
			problem:
				'Every prompt, every document, every name goes to a third‑party server. GDPR risk, high.',
			solution: '100% local inference',
			benefit:
				'The model runs on the Mac mini in front of you. Nothing leaves the building. GDPR‑friendly by design.',
		},
		{
			badge: 'DIY setup hell',
			problem:
				'Installing Llama, Ollama, a frontend, and document‑parsing pipelines takes days and breaks constantly.',
			solution: 'Ready out of the box',
			benefit:
				'We preinstall, pre‑tune, and pre‑test the whole stack. Document structuring just works from day one.',
		},
		{
			badge: 'No support when it breaks',
			problem:
				"You're on your own reading GitHub issues at 2 am.",
			solution: '€20/month support subscription',
			benefit:
				'Human support, proactive updates, and a maintained pipeline that gets better each month.',
		},
	]

	return (
		<section className="py-20 bg-gray-50">
			<Container size="md">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4"
				>
					What changes with LLmini
				</Title>
				<div className="mt-12 space-y-4">
					{rows.map((row) => (
						<div
							key={row.badge}
							className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-white rounded-xl border border-gray-200"
						>
							<div className="flex items-start gap-3">
								<div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
									<IconX size={14} className="text-red-600" />
								</div>
								<div>
									<div className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-1">
										✕ {row.badge}
									</div>
									<Text size="sm" c="dimmed">
										{row.problem}
									</Text>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
									<IconCheck size={14} className="text-emerald-600" />
								</div>
								<div>
									<div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
										✓ {row.solution}
									</div>
									<Text size="sm" c="dimmed">
										{row.benefit}
									</Text>
								</div>
							</div>
						</div>
					))}
				</div>
			</Container>
		</section>
	)
}

function Features() {
	const features = [
		{
			num: '01',
			icon: IconCpu,
			title: 'A genuine Mac mini',
			description:
				'Sourced through legitimate resale channels. You own the hardware outright – no lease, no magic leaseback. It\'s yours.',
		},
		{
			num: '02',
			icon: IconServer,
			title: 'Local Llama‑based LLM, preloaded',
			description:
				'A curated open‑weight model (Mistral, Llama, etc.) running via a high‑performance inference engine (llama.cpp / Ollama). Temperature, context, and quantisation pre‑tuned for document work.',
		},
		{
			num: '03',
			icon: IconFileText,
			title: 'Document‑structuring pipeline',
			description:
				'Ingest messy PDFs, scanned docs, and raw text. LLmini classifies, splits, extracts fields, and returns structured JSON or CSV – all locally. No upload, no token meter.',
		},
		{
			num: '04',
			icon: IconShieldLock,
			title: 'GDPR‑compliant by default',
			description:
				'Data stays in‑memory and on‑disk on a machine you physically control. We don\'t see it, nobody else does. Perfect for legal, medical, HR, and government use cases.',
		},
		{
			num: '05',
			icon: IconHeadset,
			title: 'Support subscription (€20/month)',
			description:
				'Monthly updates to models and tooling, security patches for the whole stack, troubleshooting chat, and priority queue for feature requests. Cancel anytime – your hardware and installed software stay yours.',
		},
	]

	return (
		<section className="py-20 bg-white">
			<Container size="md">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4"
				>
					What you actually get
				</Title>
				<div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8">
					{features.map((f) => (
						<div key={f.num} className="flex gap-4">
							<div>
								<ThemeIcon
									size={44}
									radius="md"
									variant="light"
									color="dark"
								>
									<f.icon size={22} />
								</ThemeIcon>
							</div>
							<div>
								<div className="text-xs font-bold text-gray-300 mb-1">
									{f.num}
								</div>
								<Title order={3} size="h4" className="font-semibold mb-2">
									{f.title}
								</Title>
								<Text size="sm" c="dimmed" className="leading-relaxed">
									{f.description}
								</Text>
							</div>
						</div>
					))}
				</div>
			</Container>
		</section>
	)
}

function HowItWorks() {
	const steps = [
		{
			step: '1',
			title: 'Choose your spec',
			description:
				'Pick Mac mini RAM/storage, and the base model size (7B, 13B, etc.). We\'ll recommend the fit for your document load.',
		},
		{
			step: '2',
			title: 'We build and test',
			description:
				'Factory reset, OS licensing handled properly, LLM stack installed, inference verified, document‑structuring pipeline validated with sample files.',
		},
		{
			step: '3',
			title: 'Shipped to your door',
			description:
				'Plug it in, connect to your local network, open the provided interface. That\'s it.',
		},
		{
			step: '4',
			title: 'Stay supported',
			description:
				'The €20/month subscription handles ongoing model updates, base‑OS security, and direct access to our engineers. No long‑term lock‑in.',
		},
	]

	return (
		<section className="py-20 bg-gray-50">
			<Container size="md">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4"
				>
					How it works
				</Title>
				<div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					{steps.map((s) => (
						<div key={s.step} className="relative">
							<div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold mb-4">
								{s.step}
							</div>
							<Title order={3} size="h5" className="font-semibold mb-2">
								{s.title}
							</Title>
							<Text size="sm" c="dimmed" className="leading-relaxed">
								{s.description}
							</Text>
						</div>
					))}
				</div>
			</Container>
		</section>
	)
}

function Pricing() {
	return (
		<section id="pricing" className="py-20 bg-white">
			<Container size="sm" className="text-center">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
				>
					Simple, transparent pricing
				</Title>
				<div className="mt-12 bg-gray-50 rounded-2xl p-8 md:p-10 border border-gray-200">
					<div className="mb-8">
						<Text size="sm" c="dimmed" className="mb-1">
							Hardware – One‑time
						</Text>
						<Text size="sm" className="text-gray-600">
							You pay the cost of the Mac mini + a one‑off configuration and
							burn‑in fee (quoted upfront).
						</Text>
					</div>
					<div className="border-t border-gray-200 pt-8 mb-8">
						<div className="text-5xl font-extrabold tracking-tight mb-2">
							€20
							<span className="text-lg font-medium text-gray-400">
								/month
							</span>
						</div>
						<Text size="sm" c="dimmed" className="mb-6">
							LLmini Subscription (excl. VAT where applicable)
						</Text>
						<div className="space-y-2 text-left max-w-xs mx-auto">
							{[
								'LLM stack updates & model refresh',
								'Document‑structuring pipeline maintenance',
								'Technical support (email, chat, optional videocall)',
								'GDPR compliance guidance',
							].map((item) => (
								<div key={item} className="flex items-start gap-2">
									<IconCheck
										size={16}
										className="text-emerald-600 mt-0.5 flex-shrink-0"
									/>
									<Text size="sm">{item}</Text>
								</div>
							))}
						</div>
					</div>
					<Text size="xs" c="dimmed">
						No per‑query fees. No data limits. The hardware is yours
						regardless of subscription status.
					</Text>
				</div>
			</Container>
		</section>
	)
}

function Audience() {
	const audiences = [
		{
			title: 'Law firms and compliance teams',
			desc: 'handling sensitive client documents.',
		},
		{
			title: 'Healthcare providers',
			desc: 'needing offline, private summarisation and structuring.',
		},
		{
			title: 'HR departments',
			desc: 'parsing CVs and contracts without a cloud risk.',
		},
		{
			title: 'Small‑and‑medium businesses',
			desc: 'that want AI without losing data sovereignty.',
		},
		{
			title: 'Developers',
			desc: 'who want a dedicated local endpoint they can trust completely.',
		},
	]

	return (
		<section className="py-20 bg-gray-50">
			<Container size="md" className="text-center">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight mb-12"
				>
					Who is LLmini built for?
				</Title>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{audiences.map((a) => (
						<div
							key={a.title}
							className="bg-white rounded-xl p-5 border border-gray-200 text-left"
						>
							<Text size="sm" className="font-semibold">
								{a.title}
							</Text>
							<Text size="sm" c="dimmed">
								{a.desc}
							</Text>
						</div>
					))}
				</div>
			</Container>
		</section>
	)
}

function Legal() {
	return (
		<section className="py-16 bg-white border-t border-gray-100">
			<Container size="sm">
				<Title
					order={2}
					className="text-2xl font-bold tracking-tight mb-6"
				>
					Here's the legal clarity you need
				</Title>
				<div className="space-y-3">
					{[
						'You own the Mac mini. The subscription covers our software configuration, updates, and human support – not the hardware.',
						'macOS stays with the hardware as permitted by Apple\'s license. We never resell macOS separately.',
						'All open‑source components (llama.cpp, Ollama, models, etc.) are used in accordance with their licenses. A full license manifest is included in the box.',
						'We are not Apple. Apple and Mac mini are trademarks of Apple Inc. LLmini is an independent product built to run on Mac mini hardware.',
						'We never see your data. The system is offline‑capable. No backdoors, no cloud‑relay, no analytics phone‑home.',
					].map((item, i) => (
						<div key={i} className="flex items-start gap-3">
							<div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
								<Text size="xs" className="font-bold text-gray-400">
									{i + 1}
								</Text>
							</div>
							<Text size="sm" c="dimmed" className="leading-relaxed">
								{item}
							</Text>
						</div>
					))}
				</div>
			</Container>
		</section>
	)
}

function FAQ() {
	const faqs = [
		{
			q: 'Do I really own the Mac mini?',
			a: 'Yes. It\'s a one‑time purchase. The subscription is only for the software support and updates.',
		},
		{
			q: 'What happens if I cancel the €20/month subscription?',
			a: 'You keep the hardware and the currently installed software. The LLM and pipeline still work. You just stop receiving model updates and direct support.',
		},
		{
			q: 'Is it really GDPR compliant?',
			a: 'By default, yes. No personal data is transmitted to us or any third party. The inference happens locally, on a device under your physical and administrative control. We can provide a data processing factsheet for your DPA records.',
		},
		{
			q: 'Which documents can it structure?',
			a: 'Invoices, contracts, CVs, medical reports, scanned forms, ID documents, bank statements, and more. The pipeline is pre‑tuned and continuously refined through your subscription.',
		},
		{
			q: 'Can I add my own models later?',
			a: 'Of course. The stack is open. We give you full admin access. Your subscription covers advice on fine‑tuning and customisation as well.',
		},
	]

	return (
		<section id="faq" className="py-20 bg-gray-50">
			<Container size="sm">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4"
				>
					Questions we hear often
				</Title>
				<div className="mt-12">
					<Accordion variant="separated" radius="md">
						{faqs.map((faq, i) => (
							<Accordion.Item key={i} value={String(i)}>
								<Accordion.Control>
									<Text className="font-medium">{faq.q}</Text>
								</Accordion.Control>
								<Accordion.Panel>
									<Text size="sm" c="dimmed" className="leading-relaxed">
										{faq.a}
									</Text>
								</Accordion.Panel>
							</Accordion.Item>
						))}
					</Accordion>
				</div>
			</Container>
		</section>
	)
}

function FinalCTA() {
	return (
		<section id="cta" className="py-24 bg-black text-white">
			<Container size="sm" className="text-center">
				<Title
					order={2}
					className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-white"
				>
					Your private AI is waiting.
				</Title>
				<Text size="lg" className="text-gray-400 max-w-xl mx-auto mb-4 leading-relaxed">
					Stop sending sensitive documents to someone else's computer.
				</Text>
				<Text size="sm" className="text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
					LLmini is your local, Llama‑powered, GDPR‑compliant
					document‑structuring appliance — built on the reliable Mac mini, and
					backed by real humans for €20/month.
				</Text>
				<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
					<Button
						component="a"
						href="mailto:orders@llmini.com"
						size="lg"
						radius="md"
						color="white"
						variant="filled"
						className="px-8 bg-white text-black hover:bg-gray-200"
					>
						Order your LLmini →
					</Button>
					<Button
						component="a"
						href="mailto:hello@llmini.com"
						size="lg"
						radius="md"
						variant="outline"
						color="white"
						className="px-8 border-gray-600 text-white hover:bg-gray-900"
					>
						Talk to our team
					</Button>
				</div>
			</Container>
		</section>
	)
}

function Footer() {
	return (
		<footer className="py-10 bg-black border-t border-gray-800">
			<Container size="lg">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					<div>
						<a
							href="/"
							className="text-lg font-extrabold tracking-tight text-white no-underline"
						>
							LLMINI
						</a>
						<Text size="xs" className="text-gray-500 mt-1">
							Your private AI. On a Mac mini.
						</Text>
					</div>
					<Text size="xs" className="text-gray-600 text-center leading-relaxed max-w-lg">
						Apple and Mac mini are trademarks of Apple Inc., registered in
						the U.S. and other countries. LLmini is an independent product
						and is not affiliated with, endorsed by, or sponsored by Apple
						Inc. Open‑source software is provided under its respective
						license terms, included with the device.
					</Text>
				</div>
			</Container>
		</footer>
	)
}
