import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
	appId: 'com.margin.ipad',
	appName: 'Margin',
	webDir: 'www',
	loggingBehavior: 'debug',
	ios: { webContentsDebuggingEnabled: process.env.MARGIN_IPAD_PROBE === '1' },
	plugins: { CapacitorSQLite: { iosDatabaseLocation: 'Library/CapacitorDatabase' } },
}

export default config
