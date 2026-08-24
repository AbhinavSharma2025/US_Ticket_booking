import cron from 'node-cron'
import { releaseExpiredHolds } from '../services/cleanupService.js'

export function startScheduler() {
  // run every 30 seconds
  cron.schedule('*/30 * * * * *', () => {
    releaseExpiredHolds()
  })
}

export default { startScheduler }
