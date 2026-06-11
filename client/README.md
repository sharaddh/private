# KMJ Optical ERP - Client

React-based frontend for the KMJ Optical ERP system, built with TypeScript, Vite, and Tailwind CSS.

## Quick Start

```bash
npm install
npm run dev
```

The application will run at `http://localhost:5173`

## Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## Configuration

Set `VITE_API_URL` in `.env` to point to your backend API:

```
VITE_API_URL=http://localhost:5000/api
```

## Tech Stack

- **React 18.2** - UI framework
- **TypeScript** - Type safety
- **Vite 4.5** - Build tool
- **React Router 6** - Routing
- **Tailwind CSS 3** - Styling

## Pages

- `/login` - User login
- `/register` - New user registration
- `/customers` - Customer management
- `/orders` - Order management
- `/bills` - Billing system
- `/payments` - Payment tracking
- `/inventory` - Inventory management
- `/delivery` - Delivery tracking

## Project Structure

```
src/
├── pages/           # Page components
├── App.tsx          # Main application component
├── main.tsx         # Entry point
├── api.ts           # API client integration
├── App.css          # Global styles
└── index.css        # Tailwind styles
```

## Development

- All files use TypeScript (.tsx)
- Styling is done with Tailwind CSS utility classes
- API calls are managed through `api.ts`
- React Router v6 handles navigation
