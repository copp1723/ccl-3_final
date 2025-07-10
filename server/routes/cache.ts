import { Router } from 'express'
import { brandingCache } from '../../shared/config/branding-config'
import { logger } from '../utils/logger'

const router = Router()

// Clear branding cache
router.post('/clear/branding', async (req, res) => {
  try {
    brandingCache.clear()
    logger.info('Branding cache cleared')
    
    res.json({
      success: true,
      message: 'Branding cache cleared successfully'
    })
  } catch (error) {
    logger.error('Error clearing branding cache:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear branding cache'
    })
  }
})

// Get cache status
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      cache: {
        branding: {
          enabled: true,
          ttl: '5 minutes'
        }
      }
    })
  } catch (error) {
    logger.error('Error getting cache status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get cache status'
    })
  }
})

export default router