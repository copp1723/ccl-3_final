# CCL Chat Widget Implementation

## Overview

The CCL Chat Widget is a flexible, embeddable chat interface that supports multiple integration methods including Google Tag Manager, direct embedding, and programmatic control.

## Features

- **Flexible Positioning**: Bottom-right, bottom-left, top-right, top-left, or custom positioning
- **Real-time Messaging**: WebSocket-based communication with instant message delivery
- **Customizable Appearance**: Configure colors, text, and behavior
- **Multiple Integration Methods**: Script tag, Google Tag Manager, or npm module
- **Programmatic API**: Control the widget via JavaScript
- **Mobile Responsive**: Automatically adapts to mobile screens
- **Sound Notifications**: Optional audio alerts for new messages
- **Typing Indicators**: Shows when agent is typing
- **Session Persistence**: Maintains chat history during page navigation

## Integration Methods

### 1. Basic Script Tag

```html
<script src="https://your-domain.com/chat-widget-embed.js"></script>
```

### 2. With Configuration

```html
<script>
  window.CCLChatConfig = {
    position: 'bottom-left',
    primaryColor: '#ff6b35',
    headerText: 'Need Help?',
    welcomeMessage: 'Welcome! How can I assist you today?',
    startMinimized: false,
    soundEnabled: true,
    leadId: 'user-123',
    metadata: {
      source: 'homepage',
      campaign: 'summer-sale'
    }
  };
</script>
<script src="https://your-domain.com/chat-widget-embed.js"></script>
```

### 3. Google Tag Manager

Create a Custom HTML tag in GTM with:

```html
<script>
  window.CCLChatConfig = {
    position: 'bottom-right',
    primaryColor: '#2563eb',
    metadata: {
      source: 'gtm',
      gtmContainerId: '{{Container ID}}',
      pageUrl: '{{Page URL}}',
      pageTitle: '{{Page Title}}'
    }
  };
</script>
<script src="https://your-domain.com/chat-widget-embed.js"></script>
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiEndpoint` | string | Current origin | WebSocket server URL |
| `position` | string | 'bottom-right' | Widget position |
| `customPosition` | object | null | Custom CSS positioning |
| `primaryColor` | string | '#2563eb' | Primary theme color |
| `headerText` | string | 'Chat with us' | Header title text |
| `placeholderText` | string | 'Type your message...' | Input placeholder |
| `welcomeMessage` | string | 'Hi! How can I help you today?' | Initial message |
| `startMinimized` | boolean | false | Start in minimized state |
| `soundEnabled` | boolean | true | Enable notification sounds |
| `leadId` | string | null | Existing lead identifier |
| `metadata` | object | {} | Additional context data |

## JavaScript API

### Methods

```javascript
// Show/Hide Controls
CCLChat.show();        // Open the chat widget
CCLChat.hide();        // Close the chat widget
CCLChat.toggle();      // Toggle open/closed state
CCLChat.minimize();    // Minimize to header only
CCLChat.maximize();    // Expand from minimized state

// Messaging
CCLChat.sendMessage('Hello!');  // Send a message programmatically

// Data Updates
CCLChat.setLeadId('customer-456');  // Update lead ID
CCLChat.setMetadata({               // Update metadata
  cartValue: 150.00,
  itemsInCart: 3
});
```

### Event-Based Integration

```javascript
// Open chat on button click
document.getElementById('help-button').addEventListener('click', function() {
  CCLChat.show();
  CCLChat.sendMessage('I need help with my order');
});

// Update metadata on user actions
document.getElementById('add-to-cart').addEventListener('click', function() {
  CCLChat.setMetadata({
    action: 'added_to_cart',
    productId: this.dataset.productId,
    timestamp: new Date().toISOString()
  });
});
```

## Server Implementation

The chat widget connects to the WebSocket server and handles the following events:

- `chat:init` - Initialize chat session
- `chat:message` - Send/receive messages
- `chat:typing` - Typing indicators
- `chat:metadata` - Update session metadata
- `chat:updateLead` - Associate with lead ID

## Building the Widget

1. Install dependencies:
```bash
cd client
npm install
```

2. Build the widget bundle:
```bash
npm run build:widget
```

This creates `chat-widget.bundle.js` in the `client/public` directory.

## Testing

Open `client/public/chat-demo.html` in a browser to test various configurations and features.

## Deployment

1. Build the widget bundle
2. Deploy `chat-widget-embed.js` and `chat-widget.bundle.js` to your CDN or static hosting
3. Update the script URLs in your integration code
4. Ensure CORS is configured to allow embedding on target domains

## Security Considerations

- The widget uses secure WebSocket connections (wss://) in production
- Lead IDs should be validated server-side
- Metadata is sanitized before storage
- Rate limiting is applied to prevent spam

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome for Android)