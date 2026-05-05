import {
	ColorSchemeScript,
	MantineProvider,
	createTheme,
	mantineHtmlProps,
} from '@mantine/core'
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from '@tanstack/react-router'
import type * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import { seo } from '~/utils/seo'
import css from './__root.css?url'

const theme = createTheme({
	primaryColor: 'dark',
	fontFamily:
		'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
	headings: {
		fontFamily:
			'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
	},
})

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			...seo({
				title: 'LLMINI — Your private AI. On a Mac mini. Ready to run.',
				description:
					'A genuine Mac mini with a local Llama‑based LLM stack, fully configured, tested, and shipped to you. Your data never leaves the device. GDPR‑compliant by design.',
				keywords:
					'LLMINI, private AI, local LLM, Mac mini, Llama, GDPR compliant, on-premise AI, document structuring, offline AI',
			}),
		],
		links: [
			{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
			{
				rel: 'preconnect',
				href: 'https://fonts.gstatic.com',
				crossOrigin: 'anonymous',
			},
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
			},
			{
				rel: 'apple-touch-icon',
				sizes: '180x180',
				href: '/apple-touch-icon.png',
			},
			{
				rel: 'icon',
				type: 'image/png',
				sizes: '32x32',
				href: '/favicon-32x32.png',
			},
			{
				rel: 'icon',
				type: 'image/png',
				sizes: '16x16',
				href: '/favicon-16x16.png',
			},
			{ rel: 'manifest', href: '/site.webmanifest' },
			{ rel: 'icon', href: '/favicon.ico' },
			{ rel: 'stylesheet', href: css },
		],
	}),
	errorComponent: (props) => (
		<RootDocument>
			<DefaultCatchBoundary {...props} />
		</RootDocument>
	),
	notFoundComponent: () => <NotFound />,
	component: RootComponent,
})

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html {...mantineHtmlProps}>
			<head>
				<HeadContent />
				<ColorSchemeScript />
			</head>
			<body className="antialiased">
				<MantineProvider theme={theme}>{children}</MantineProvider>
				<Scripts />
			</body>
		</html>
	)
}
