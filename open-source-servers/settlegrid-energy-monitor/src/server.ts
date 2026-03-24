/**
 * settlegrid-energy-monitor — Home Energy Usage MCP Server
 *
 * Methods:
 *   get_realtime_usage()             (1¢)
 *   get_daily_usage(date)            (1¢)
 *   get_devices()                    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetDailyUsageInput { date?: string }

const USER_AGENT = 'settlegrid-energy-monitor/1.0 (contact@settlegrid.ai)'

// Simulated energy data for demo (replace with real Sense/Emporia API)
function generateUsageData(hours: number) {
  const data = []
  for (let i = 0; i < hours; i++) {
    data.push({
      hour: i,
      watts: Math.round(800 + Math.random() * 2000),
      cost_cents: Math.round((800 + Math.random() * 2000) * 0.12 / 100),
    })
  }
  return data
}

const sg = settlegrid.init({
  toolSlug: 'energy-monitor',
  pricing: { defaultCostCents: 1, methods: {
    get_realtime_usage: { costCents: 1, displayName: 'Get real-time energy usage' },
    get_daily_usage: { costCents: 1, displayName: 'Get daily energy breakdown' },
    get_devices: { costCents: 1, displayName: 'Get detected devices' },
  }},
})

const getRealtimeUsage = sg.wrap(async () => {
  return {
    timestamp: new Date().toISOString(),
    current_watts: Math.round(800 + Math.random() * 2000),
    voltage: Math.round(118 + Math.random() * 4),
    frequency_hz: 60,
    solar_watts: Math.round(Math.random() * 3000),
  }
}, { method: 'get_realtime_usage' })

const getDailyUsage = sg.wrap(async (args: GetDailyUsageInput) => {
  const date = args.date || new Date().toISOString().split('T')[0]
  return { date, hourly: generateUsageData(24), total_kwh: Math.round(20 + Math.random() * 30), total_cost_dollars: Math.round(300 + Math.random() * 400) / 100 }
}, { method: 'get_daily_usage' })

const getDevices = sg.wrap(async () => {
  return {
    devices: [
      { name: 'HVAC', watts: 3500, status: 'on' },
      { name: 'Refrigerator', watts: 150, status: 'on' },
      { name: 'Washer', watts: 0, status: 'off' },
      { name: 'Dryer', watts: 0, status: 'off' },
      { name: 'EV Charger', watts: 7200, status: 'on' },
      { name: 'Other', watts: 850, status: 'on' },
    ],
  }
}, { method: 'get_devices' })

export { getRealtimeUsage, getDailyUsage, getDevices }

console.log('settlegrid-energy-monitor MCP server ready')
console.log('Methods: get_realtime_usage, get_daily_usage, get_devices')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
