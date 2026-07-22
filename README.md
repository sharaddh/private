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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Private Project

