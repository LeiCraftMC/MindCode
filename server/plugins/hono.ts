import { defineNitroPlugin } from 'nitropack/runtime'
import { ConfigHandler } from '../utils/config'
import { Logger } from '../utils/logger'
import { DB } from '../db'
import { API } from '../lib/api'

export default defineNitroPlugin(async () => {
	const config = await ConfigHandler.loadConfig()

	Logger.setLogLevel(config.MINDCODE_LOG_LEVEL ?? 'info')

	await DB.init(
		config.MINDCODE_DB_PATH ?? './data/db.sqlite',
		config.MINDCODE_DB_AUTO_MIGRATE,
		config.MINDCODE_CONFIG_BASE_DIR ?? './config'
	)

	await API.init(config.MINDCODE_API_DISABLE_DOCS === true)
})
