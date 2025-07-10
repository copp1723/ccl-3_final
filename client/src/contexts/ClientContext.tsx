import React, { createContext, useContext, useEffect, useState } from 'react'
import { CCLBrandingConfig, DEFAULT_BRANDING } from '../../../shared/config/branding-config'

interface ClientContextType {
  clientId: string | null
  branding: CCLBrandingConfig
  isLoading: boolean
  error: string | null
  refreshBranding: () => Promise<void>
}

const ClientContext = createContext<ClientContextType | undefined>(undefined)

export function useClient() {
  const context = useContext(ClientContext)
  if (!context) {
    throw new Error('useClient must be used within a ClientProvider')
  }
  return context
}

interface ClientProviderProps {
  children: React.ReactNode
  clientId?: string
}

export function ClientProvider({ children, clientId: propClientId }: ClientProviderProps) {
  const [clientId, setClientId] = useState<string | null>(propClientId || null)
  const [branding, setBranding] = useState<CCLBrandingConfig>(DEFAULT_BRANDING)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const detectClientFromDomain = (): string | null => {
    if (typeof window === 'undefined') return null
    
    const hostname = window.location.hostname
    const subdomain = hostname.split('.')[0]
    
    if (subdomain && subdomain !== 'www' && subdomain !== hostname) {
      return subdomain
    }
    
    return hostname === 'localhost' ? 'localhost' : null
  }

  const fetchBranding = async (targetClientId: string | null): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      if (!targetClientId) {
        setBranding(DEFAULT_BRANDING)
        return
      }

      const response = await fetch(`/api/branding/${targetClientId}`)
      const data = await response.json()

      if (data.success && data.branding) {
        setBranding(data.branding.branding)
      } else {
        setBranding(DEFAULT_BRANDING)
      }
    } catch (err) {
      console.error('Failed to fetch branding:', err)
      setError('Failed to load branding configuration')
      setBranding(DEFAULT_BRANDING)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshBranding = async (): Promise<void> => {
    await fetchBranding(clientId)
  }

  useEffect(() => {
    const detectedClientId = propClientId || detectClientFromDomain()
    setClientId(detectedClientId)
    fetchBranding(detectedClientId)
  }, [propClientId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    
    root.style.setProperty('--primary-color', branding.primaryColor)
    root.style.setProperty('--secondary-color', branding.secondaryColor)
    
    const primaryHsl = hexToHsl(branding.primaryColor)
    const secondaryHsl = hexToHsl(branding.secondaryColor)
    
    root.style.setProperty('--primary', primaryHsl)
    root.style.setProperty('--secondary', secondaryHsl)
    
    document.title = `${branding.companyName} - AI Marketing Platform`
    
    if (branding.favicon) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (!favicon) {
        favicon = document.createElement('link')
        favicon.rel = 'icon'
        document.head.appendChild(favicon)
      }
      favicon.href = branding.favicon
    }

    let customStyleElement = document.getElementById('client-custom-css')
    if (branding.customCss) {
      if (!customStyleElement) {
        customStyleElement = document.createElement('style')
        customStyleElement.id = 'client-custom-css'
        document.head.appendChild(customStyleElement)
      }
      customStyleElement.textContent = branding.customCss
    } else if (customStyleElement) {
      customStyleElement.remove()
    }
  }, [branding])

  return (
    <ClientContext.Provider value={{
      clientId,
      branding,
      isLoading,
      error,
      refreshBranding
    }}>
      {children}
    </ClientContext.Provider>
  )
}

function hexToHsl(hex: string): string {
  hex = hex.replace('#', '')
  
  const r = parseInt(hex.substr(0, 2), 16) / 255
  const g = parseInt(hex.substr(2, 2), 16) / 255
  const b = parseInt(hex.substr(4, 2), 16) / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}