# KMJ Optical ERP System

A comprehensive Enterprise Resource Planning (ERP) system designed for KMJ Optical, featuring customer management, order processing, billing, inventory tracking, and delivery management.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React SPA  │────▶│  Express API │────▶│   MongoDB    │
│   (Vite)     │     │  (TypeScript)│     │   + Redis    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │              ┌─────┴─────┐
       │              │  WhatsApp  │
       ▼              │  Webhook   │
  Warehouse App       └───────────┘
```

## Tech Stack

### Frontend
- **React 18.2** - UI library
- **TypeScript** - Type-safe development
- **Vite 4.5** - Fast build tool and dev server
- **React Router 6** - Client-side routing
- **Tailwind CSS 3** - Utility-first CSS framework
- **PostCSS & Autoprefixer** - CSS processing

### Backend
- **Node.js & Express** - Server framework
- **TypeScript** - Type-safe backend code
- **MongoDB** - Database
- **JWT** - Authentication
- **Nodemon** - Development auto-reload

## Project Structure

```
├── client/                 # React frontend (TypeScript + Vite)
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── api.ts         # API integration
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                # Node.js backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── models/        # Database models
│   │   ├── middleware/    # Auth, audit middleware
│   │   ├── migrations/    # Database migrations
│   │   ├── app.ts         # Express app setup
│   │   └── index.ts       # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── warehouse/                 # Warehouse App
└── package.json           # Root package.json
```

## Features

- **Customer Management** - Add, edit, and manage customer information
- **Order Management** - Create and track orders
- **Billing System** - Generate and manage bills
- **Inventory Management** - Track stock levels
- **Delivery Tracking** - Monitor order deliveries
- **Payment Processing** - Manage payment records
- **User Authentication** - Secure login and registration
- **Audit Trail** - Track system activities
- **Multi-branch Support** - Manage multiple store locations
- **Reporting** - Generate business reports and analytics
- **WhatsApp Communications** - Transactional order/payment/invoice notifications and opt-in marketing campaigns through the Meta Cloud API, with a local mock provider, consent tracking, delivery logs, and owner-only controls

## WhatsApp Communications

The WhatsApp module is documented in [`docs/whatsapp/`](docs/whatsapp/):

- [`ARCHITECTURE.md`](docs/whatsapp/ARCHITECTURE.md) - components, data flow, safety gates
- [`IMPLEMENTATION.md`](docs/whatsapp/IMPLEMENTATION.md) - file map, API, event matrix
- [`ENVIRONMENT.md`](docs/whatsapp/ENVIRONMENT.md) - configuration reference
- [`OPERATIONS.md`](docs/whatsapp/OPERATIONS.md) - runbook and troubleshooting
- [`META_SETUP_HANDOFF.md`](docs/whatsapp/META_SETUP_HANDOFF.md) - go-live checklist
- [`meta-template-drafts.md`](docs/whatsapp/meta-template-drafts.md) - template copy to submit

Live sending is disabled by default. Use `WHATSAPP_PROVIDER=mock` for local work.

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB instance running

### Installation

1. **Clone and setup (installs all dependencies):**
```bash
git clone <repo-url>
cd 123
npm install
```

2. **Setup individual apps** (if you prefer manual setup over `npm install` at root):

**Frontend:**
```bash
cd client
npm install
```

**Backend:**
```bash
cd server
npm install
```

**Warehouse App:**
```bash
cd warehouse
npm install
```

### Environment Setup

**Backend (.env file in `server/`):**
```
MONGO_URI=mongodb://localhost:27017/kmj-erp
JWT_SECRET=your-secret-key
PORT=4000
```

**Frontend (.env file in `client/`):**
```
VITE_API_URL=http://localhost:4000/api
```

**Warehouse App (.env file in `warehouse/`):**
```
VITE_API_URL=http://localhost:4000
```

### Running the Project

**Option 1: Run all services together**
```bash
npm run dev
```

**Option 2: Run services individually**

Terminal 1 - Backend:
```bash
cd server
npm run dev
```

Terminal 2 - Frontend:
```bash
cd client
npm run dev
```

Terminal 3 - Warehouse App:
```bash
cd warehouse
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **Warehouse App**: http://localhost:5174

## Available Scripts

### Frontend (client/)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend (server/)
- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript
- `npm start` - Start production server

### Warehouse App (warehouse/)
- `npm run dev` - Start development server (port 5174)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## API Documentation

API documentation is available at `/api/docs` (OpenAPI/Swagger)

See `server/docs/openapi.yaml` for the OpenAPI specification.

## Development Guidelines

- All frontend code is **TypeScript (.tsx)**
- Use **React Router** for navigation
- Follow **Tailwind CSS** for styling
- Backend uses **Express** with **TypeScript**
- Database models are in `server/src/models/`

## Recent Updates

- ✅ Frontend standardized on TypeScript (removed JSX/old templates)
- ✅ Unified Vite configuration
- ✅ Streamlined dependency versions
- ✅ Clean build pipeline
- ✅ Multi-branch support added
- ✅ Warehouse management module

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Private Project

## Support

For issues and questions, please open an issue on the repository.

