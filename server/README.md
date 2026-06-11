# KMJ Optical ERP - Backend Server

Node.js + Express backend for the KMJ Optical ERP system with MongoDB database integration, JWT authentication, and comprehensive API endpoints.

## Quick Start

Install dependencies:
```bash
npm install
```

Start development server (with auto-reload):
```bash
npm run dev
```

The server will run at `http://localhost:5000`

## Scripts

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

## Configuration

Create a `.env` file in the server directory:

```
MONGO_URI=mongodb://localhost:27017/kmj-erp
JWT_SECRET=your-secret-key-here
PORT=5000
NODE_ENV=development
```

See `.env.example` for all available configuration options.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Bills
- `GET /api/bills` - List all bills
- `POST /api/bills` - Create bill
- `GET /api/bills/:id` - Get bill details
- `PUT /api/bills/:id` - Update bill

### Payments
- `GET /api/payments` - List all payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment details

### Inventory
- `GET /api/inventory` - List inventory items
- `POST /api/inventory` - Add inventory item
- `PUT /api/inventory/:id` - Update inventory

### Delivery
- `GET /api/delivery` - List deliveries
- `POST /api/delivery` - Create delivery
- `PUT /api/delivery/:id` - Update delivery status

## Project Structure

```
src/
├── routes/          # API route handlers
│   ├── auth.ts
│   ├── customers.ts
│   ├── orders.ts
│   ├── bills.ts
│   ├── payments.ts
│   ├── inventory.ts
│   ├── delivery.ts
│   └── index.ts
├── models/          # Database schemas
│   ├── user.ts
│   ├── customer.ts
│   ├── order.ts
│   ├── bill.ts
│   ├── payment.ts
│   ├── inventory.ts
│   ├── delivery.ts
│   ├── prescription.ts
│   └── visit.ts
├── middleware/      # Express middleware
│   ├── auth.ts      # JWT authentication
│   └── audit.ts     # Activity logging
├── migrations/      # Database migrations
│   └── migrate-legacy.ts
├── app.ts           # Express app configuration
├── config.ts        # Configuration
└── index.ts         # Server entry point
```

## Middleware

- **Authentication** - JWT token validation for protected routes
- **Audit** - Logs all API activities

## Database Models

- **User** - System users (admin, staff)
- **Customer** - Customer information
- **Order** - Customer orders
- **Bill** - Billing records
- **Payment** - Payment transactions
- **Inventory** - Product inventory
- **Delivery** - Delivery tracking
- **Prescription** - Optical prescriptions
- **Visit** - Customer visits

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

## API Documentation

Full OpenAPI/Swagger documentation is available in `docs/openapi.yaml`

## Development

- All code is written in **TypeScript**
- Database: **MongoDB**
- ORM/Query Builder: Check models for current implementation
- Express middleware stack for authentication and logging

## Migrations

Run database migrations:
```bash
npm run migrate
```

Sample customer data is available in `migrations/data/sample_customers.json`
