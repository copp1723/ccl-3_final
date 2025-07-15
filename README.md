# SWARM: AI-Powered Marketing Automation Platform

This is the central repository for SWARM (Scalable Workforce of Automated Resource Management), a multi-agent AI marketing automation platform designed for intelligent lead management, communication orchestration, and automated data processing.

## 🌟 Features

*   **Multi-Agent Architecture:** Specialized AI agents (Overlord, Email, SMS, Chat) handle distinct tasks for efficient process automation.
*   **Real-time Communication:** WebSocket integration for live dashboard updates, chat interactions, and agent monitoring.
*   **Lead Management:** Comprehensive tools for lead import, tracking, qualification, and submission to external systems (e.g., Boberdoo).
*   **Multi-Channel Campaigns:** Supports email (Mailgun) and SMS (Twilio) campaigns with contextual AI-generated responses.
*   **Web Chat Widget:** Embeddable chat interface for real-time customer interaction.
*   **Robust Backend:** Built with Node.js, Express, and TypeScript, ensuring type safety and scalability.
*   **Modern Frontend:** User-friendly dashboard and components built with React, TypeScript, Tailwind CSS, and shadcn/ui.
*   **Relational Database:** PostgreSQL with Drizzle ORM for type-safe queries and data integrity.
*   **Configurable AI:** Utilizes OpenAI GPT models, with per-agent configurability.

## 🛠️ Tech Stack

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Tanstack Query, Wouter
*   **Backend:** Node.js, Express, TypeScript, WebSockets
*   **Database:** PostgreSQL, Drizzle ORM
*   **AI:** OpenAI (GPT models)
*   **Email:** Mailgun
*   **SMS:** Twilio
*   **Deployment:** Render (configuration in `render.yaml`)

## 📂 Project Structure

The project is organized into several key directories:

```
├── client/              # Frontend React application
├── server/              # Backend Node.js server (including AI agents)
├── email-system/        # Standalone email campaign processing system
├── migrations/          # Database migration files (Drizzle ORM)
├── docs/                # Comprehensive project documentation
├── tests/               # Unit, integration, and E2E tests
├── scripts/             # Utility and deployment scripts
├── config/              # Environment configurations
├── build-config/        # Build tool configurations (Vite, TypeScript, etc.)
└── ... (other configuration files)
```

For a more detailed breakdown, please see `PROJECT_STRUCTURE.md`.

## 🚀 Quick Start

Follow these steps to get the application running locally:

1.  **First-Time Setup (Do this once):**
    ```bash
    # Install all dependencies from the root directory
    npm install

    # Run the quick setup script (creates .env, may start mock services)
    npm run setup:quick
    ```

2.  **Start the Application:**
    Open two terminal windows:

    *   **Terminal 1 - Backend:**
        ```bash
        # Starts a minimal backend server (often with in-memory data)
        npm run dev:quick
        ```
        The backend will typically be available at `http://localhost:5000`.

    *   **Terminal 2 - Frontend:**
        ```bash
        # Starts the React frontend development server
        npm run dev
        ```
        The frontend will typically be available at `http://localhost:5173`.

3.  **Open Your Browser:**
    Navigate to `http://localhost:5173` to see the CCL dashboard.

ℹ️ The `dev:quick` script often uses mock data and services. For setup with a real database and external services, consult the detailed guides in the `docs/` directory, particularly regarding environment variable configuration (`.env` file based on `.env.example`).

##🧪 Running Tests

Test files are located in the `tests/` directory. To run tests, you can typically use scripts defined in `package.json`. Look for scripts like:

*   `npm test`
*   `npm run test:unit`
*   `npm run test:e2e`
*   `npm run test:integration`

Please refer to `package.json` and any `README.md` files within the `tests/` directory for specific commands and testing procedures.

##✅ Code Validation

Run linting, type checks, and the unit test suite in a single step:

```bash
npm run validate
```

This script helps ensure code quality before committing changes.

##☁️ Deployment

This project is configured for deployment on [Render](https://render.com/). The deployment configuration can be found in `render.yaml`.

Key aspects of the deployment include:
*   Building the frontend and backend assets.
*   Running database migrations.
*   Starting the server application.

Refer to `docs/deployment/RENDER_DEPLOYMENT.md` for more detailed deployment instructions.

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory. Key documents include:

*   `docs/TECHNICAL_ARCHITECTURE.md`: Detailed overview of the system architecture.
*   `docs/IMPLEMENTATION_SUMMARY.md`: Summary of the project implementation.
*   `PROJECT_STRUCTURE.md`: Explanation of the directory layout.
*   `QUICK_START.md`: Quick setup guide.
*   Various guides on specific features, integrations, and deployment.

##🤝 Contributing

(Contribution guidelines can be added here if they exist or are established in the future.)

##📜 License

(License information can be added here if a license file is present or chosen for the project.)
