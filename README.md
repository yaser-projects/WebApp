# Metal Brain WebApp

Professional Embedded & Web UI System for ESP32 devices.

## Project Structure

```
WebApp/
├── css/
│   ├── common-style.css    # Shared styles for all pages
│   ├── login.css           # Login page styles
│   └── quickstart.css      # QuickStart wizard styles
├── js/
│   ├── ws.js               # Shared WebSocket module
│   ├── auth.js             # Authentication module
│   └── quickstart.js       # QuickStart wizard logic
├── image/
│   └── background.png      # Background image
├── splash.html             # Splash/Preview screen (entry point)
├── index.html              # Login page
├── quickstart.html         # QuickStart wizard (5 steps)
└── README.md               # This file
```

## Features

- **Automatic WebSocket Detection**: Works in local, LAN, and server environments without manual configuration
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Multi-step Setup Wizard**: Guided device configuration
- **Real-time Communication**: WebSocket-based messaging with ESP32

## Getting Started

1. Open `splash.html` in your browser (or configure your server to serve it as the entry point)
2. The splash screen will detect the connection type and redirect accordingly
3. Login with device credentials
4. Use QuickStart wizard for initial setup

## WebSocket Configuration

The WebSocket module (`js/ws.js`) automatically detects the connection endpoint:

1. **Priority 1**: Direct device connection (192.168.1.2)
2. **Priority 2**: Current host (LAN or server)
3. **Fallback**: Localhost

You can modify `WS_CONFIG` in `js/ws.js` to customize the connection behavior.

## Pages

- **splash.html**: Entry point, detects connection and redirects
- **index.html**: Login page
- **quickstart.html**: 5-step setup wizard
- **dashboard.html**: Main dashboard (to be implemented)
- **userinterface.html**: User interface settings (to be implemented)
- **networksettings.html**: Network settings (to be implemented)
- **status.html**: Device status (to be implemented)
- **about.html**: About page (to be implemented)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

Copyright © 2023 Yaser Rashnabadi - Metal Brain. All rights reserved.

