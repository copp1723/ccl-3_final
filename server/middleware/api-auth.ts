import { Request, Response, NextFunction } from 'express';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  active: boolean;
}

export async function validateApiKey(req: Request, res: Response, next: NextFunction) {
  // Skip API key validation for non-production or if mode isn't 'full'
  if (process.env.NODE_ENV !== 'production' && req.query.mode !== 'full') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).send(`<?xml version="1.0" encoding="UTF-8"?>
<response>
  <status>error</status>
  <message>API key required for mode=full</message>
</response>`);
  }

  try {
    // For now, do simple validation. In production, check against database
    const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!validKeys.includes(apiKey as string)) {
      return res.status(401).send(`<?xml version="1.0" encoding="UTF-8"?>
<response>
  <status>error</status>
  <message>Invalid API key</message>
</response>`);
    }

    // API key is valid
    (req as any).apiKey = apiKey;
    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<response>
  <status>error</status>
  <message>Internal server error</message>
</response>`);
  }
}

// Helper to format XML responses
export function formatXmlResponse(data: any): string {
  const xmlParts = ['<?xml version="1.0" encoding="UTF-8"?>', '<response>'];
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      xmlParts.push(`  <${key}>${value}</${key}>`);
    }
  }
  
  xmlParts.push('</response>');
  return xmlParts.join('\n');
}