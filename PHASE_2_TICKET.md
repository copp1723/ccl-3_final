# Phase 2: White-Label UI Integration Ticket

## Overview
Integrate the core branding system (Phase 1) into CCL-3's user interface components to enable dynamic white-label branding across the application.

## Acceptance Criteria

### 1. Navigation Branding Integration
- [ ] Update `client/src/App.tsx` to use `useBranding()` hook
- [ ] Replace hardcoded "CCL-3 SWARM" with `{branding.companyName}`
- [ ] Apply `branding.primaryColor` to navigation highlights
- [ ] Add logo support with `branding.logoUrl`

### 2. Dynamic Theme System
- [ ] Create `client/src/components/BrandingProvider.tsx` context provider
- [ ] Inject CSS custom properties for colors: `--primary-color`, `--secondary-color`
- [ ] Update Tailwind config to use CSS variables
- [ ] Apply branding colors to buttons, badges, and UI elements

### 3. Email Template Integration
- [ ] Update `server/config/email-templates.json` to use branding variables
- [ ] Modify email service to inject branding data
- [ ] Replace hardcoded "The Team" with `{branding.emailFromName}`
- [ ] Use `branding.supportEmail` for reply-to addresses

### 4. Metadata and SEO
- [ ] Create `shared/config/branding-metadata.ts` for dynamic page titles
- [ ] Update `client/index.html` to use dynamic title
- [ ] Add favicon support via `branding.favicon`
- [ ] Generate Open Graph tags with branding

## Technical Implementation

### Files to Modify:
1. `client/src/App.tsx` - Main navigation header
2. `client/src/components/ui/` - UI components for theming
3. `server/config/email-templates.json` - Email branding
4. `client/index.html` - Dynamic title and favicon
5. `client/tailwind.config.js` - CSS variable support

### New Files to Create:
1. `client/src/components/BrandingProvider.tsx`
2. `client/src/hooks/useTheme.ts`
3. `shared/config/branding-metadata.ts`

## Code Examples

### App.tsx Integration:
```tsx
import { useBranding } from '@/hooks/useBranding';

function App() {
  const branding = useBranding();
  
  return (
    <div className="bg-white border-b">
      <div className="flex items-center space-x-3">
        {branding.logoUrl && (
          <img src={branding.logoUrl} alt="Logo" className="h-8 w-8" />
        )}
        <h1 className="text-2xl font-bold text-gray-900">
          {branding.companyName}
        </h1>
      </div>
    </div>
  );
}
```

### CSS Variables Integration:
```css
:root {
  --primary-color: #2563eb;
  --secondary-color: #1d4ed8;
}

.btn-primary {
  background-color: var(--primary-color);
}
```

### Email Template Update:
```json
{
  "subject": "Welcome {{name}}! Quick question from {{branding.emailFromName}}",
  "body": "Hi {{name}},\n\nThanks for your interest in {{branding.companyName}}!\n\nBest regards,\n{{branding.emailFromName}} Team"
}
```

## Testing Requirements
- [ ] Test branding changes with different client configurations
- [ ] Verify email templates render with correct branding
- [ ] Test responsive design with long company names
- [ ] Validate color contrast for accessibility
- [ ] Test logo display with various image formats

## Dependencies
- Phase 1 (Core Branding System) must be completed
- Database migration 0007 must be applied
- Client branding configurations must be seeded

## Estimated Effort
- **Development**: 4-6 hours
- **Testing**: 2-3 hours
- **Total**: 6-9 hours

## Definition of Done
- All UI components dynamically use branding configuration
- Email templates include branding variables
- Navigation shows client-specific company name and colors
- Logo support is functional
- No hardcoded "CCL-3 SWARM" references remain in UI
- All tests pass with branding integration