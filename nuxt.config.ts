// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	modules: ['@nuxt/ui'],

	colorMode: {
		preference: 'dark',
		fallback: 'dark',
		classSuffix: ''
	},

	ssr: true,

	css: [
		'~/assets/css/main.css',
	],

	nitro: {
		preset: 'bun',
		experimental: {
			websocket: true,
		},
	},

	runtimeConfig: {
		public: {
			apiUrl: process.env.MINDCODE_API_URL || 'http://localhost:13338',
			appUrl: process.env.MINDCODE_APP_URL || 'http://localhost:13338',
		}
	},

	routeRules: {
		"/auth/**": { ssr: false },
		"/code/**": { ssr: false },
		"/**": { ssr: true }
	}
});
