// CCL Chat Widget Embed Script
// This script can be embedded via Google Tag Manager or directly on any website
// Usage:
// 1. Google Tag Manager: Add as Custom HTML tag
// 2. Direct embed: <script src="https://your-domain.com/chat-widget-embed.js"></script>
// 3. With configuration:
//    <script>
//      window.CCLChatConfig = {
//        position: 'bottom-left',
//        primaryColor: '#ff6b35',
//        headerText: 'Need Help?',
//        leadId: 'user-123',
//        metadata: { source: 'homepage' }
//      };
//    </script>
//    <script src="https://your-domain.com/chat-widget-embed.js"></script>

(function() {
  'use strict';
  
  // Prevent multiple initializations
  if (window.CCLChatInitialized) return;
  window.CCLChatInitialized = true;
  
  // Get configuration
  var config = window.CCLChatConfig || {};
  
  // Default configuration
  var defaults = {
    apiEndpoint: window.location.origin,
    position: 'bottom-right',
    primaryColor: '#2563eb',
    headerText: 'Chat with us',
    placeholderText: 'Type your message...',
    welcomeMessage: 'Hi! How can I help you today?',
    startMinimized: false,
    soundEnabled: true
  };
  
  // Merge configurations
  for (var key in defaults) {
    if (!config.hasOwnProperty(key)) {
      config[key] = defaults[key];
    }
  }
  
  // Create styles
  var style = document.createElement('style');
  style.textContent = `
    #ccl-chat-root {
      position: fixed;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    /* Ensure widget stays on top */
    #ccl-chat-root * {
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(style);
  
  // Create root element
  var root = document.createElement('div');
  root.id = 'ccl-chat-root';
  document.body.appendChild(root);
  
  // Load the widget bundle
  var script = document.createElement('script');
  script.src = config.apiEndpoint + '/chat-widget.bundle.js';
  script.async = true;
  script.onload = function() {
    console.log('CCL Chat Widget loaded successfully');
  };
  script.onerror = function() {
    console.error('Failed to load CCL Chat Widget');
  };
  document.body.appendChild(script);
  
  // Expose API
  window.CCLChat = {
    show: function() {
      window.dispatchEvent(new CustomEvent('ccl-chat-show'));
    },
    hide: function() {
      window.dispatchEvent(new CustomEvent('ccl-chat-hide'));
    },
    toggle: function() {
      window.dispatchEvent(new CustomEvent('ccl-chat-toggle'));
    },
    minimize: function() {
      window.dispatchEvent(new CustomEvent('ccl-chat-minimize'));
    },
    maximize: function() {
      window.dispatchEvent(new CustomEvent('ccl-chat-maximize'));
    },
    sendMessage: function(message) {
      window.dispatchEvent(new CustomEvent('ccl-chat-send', { 
        detail: { message: message } 
      }));
    },
    setMetadata: function(metadata) {
      window.dispatchEvent(new CustomEvent('ccl-chat-metadata', { 
        detail: { metadata: metadata } 
      }));
    },
    setLeadId: function(leadId) {
      window.dispatchEvent(new CustomEvent('ccl-chat-leadid', { 
        detail: { leadId: leadId } 
      }));
    }
  };
  
  // Track page views (useful for analytics)
  if (config.trackPageViews !== false) {
    window.CCLChat.setMetadata({
      pageUrl: window.location.href,
      pageTitle: document.title,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    });
  }
})();