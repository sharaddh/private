# 00 - Project Overview

## Purpose

This document provides a complete overview of the KMJ Optical ERP system, its business context, stakeholders, and system boundaries. Every engineer and AI agent must read this first to understand what they are building.

## Business Context

KMJ Optical is a multi-branch optical retail chain operating in India. The business sells prescription eyeglasses, sunglasses, contact lenses, and hearing aids. Each branch operates semi-independently with its own staff, inventory, and customers, but shares a central management system.

### Business Model

- **Retail sales**: Frames, lenses, coatings, accessories
- **Prescription services**: Eye examinations, prescription generation
- **Lab orders**: Outsourced lens grinding and fitting
- **Delivery**: Home delivery of finished orders
- **Payment**: Cash, UPI, card, bank transfer, insurance claims
- **Multi-branch**: Each branch has its own database, staff, and inventory

### Key Business Metrics

- Customer lifetime value (totalSpent)
- Visit frequency (totalVisits)
- Pending payments (pendingAmount)
- Order pipeline (Draft → Ordered → In Lab → Ready → Delivered)
- Inventory turnover
- Daily/weekly/monthly revenue
- Payment collection rate
- Delivery timeliness

## System Boundaries

### What the System Does

1. **Customer Management**: Store and retrieve customer information, contact details, visit history
2. **Visit Tracking**: Record customer visits with type, doctor, and remarks
3. **Prescription Management**: Store detailed eye prescriptions (right/left eye, DV/NV/PC)
4. **Order Processing**: Create and track orders through status pipeline
5. **Billing**: Generate invoices with line items, discounts, taxes
6. **Payment Processing**: Record payments with multiple modes
7. **Inventory Management**: Track stock levels, SKUs, pricing, locations
8. **Delivery Tracking**: Monitor order delivery status
9. **WhatsApp Integration**: Send notifications, bills, and demand lists
10. **Reporting**: Generate revenue, customer, inventory, and delivery reports
11. **Multi-branch**: Isolate data per branch while sharing infrastructure
12. **Warehouse**: Dedicated lens inventory management app

### What the System Does NOT Do

1. **Online sales**: No e-commerce functionality
2. **Insurance processing**: Only records insurance payments, no claims processing
3. **Accounting**: No double-entry bookkeeping or tax filing
4. **HR management**: No payroll, attendance, or leave management
5. **Supplier ordering**: No direct supplier integration (manual ordering via WhatsApp)
6. **Manufacturing**: No lens manufacturing tracking
7. **Multi-currency**: INR only
8. **Multi-language**: English (Hindi support planned)

## Stakeholders

### Primary Users

1. **Shop Owner**: Full system access, manages branches, users, and settings
2. **Shop Staff**: Customer management, visits, prescriptions, orders, billing
3. **Warehouse Staff**: Inventory management, stock updates

### Secondary Users

1. **Customers**: Receive WhatsApp notifications (passive)
2. **Lab Partners**: Receive demand lists via WhatsApp (passive)

### System Operators

1. **Developers**: Build and maintain the system
2. **DevOps**: Deploy and monitor the system
3. **AI Agents**: Assist with development (must follow AGENTS.md)

## System Architecture Summary

### Three-Application Architecture

1. **Main ERP Client** (React, Port 5173): Full ERP functionality for shop staff
2. **Warehouse App** (React, Port 5174): Dedicated lens inventory management
3. **Backend API** (Express, Port 4000): Shared API server for both clients

### Database Architecture

- **Root Database** (`kmj`): Users and branches only
- **Branch Databases** (`kmj_{code}`): All business data per branch
- **Redis** (optional): Route-level caching

### External Integrations

- **WhatsApp** (Baileys): Customer notifications, bill delivery, demand lists
- **MongoDB Atlas**: Primary database hosting
- **Render.com**: Application hosting

## Data Flow Summary

### Customer Lifecycle

```
Customer Arrives → Visit Created → Prescription Entered → Order Created → Bill Generated → Payment Recorded → Order Processed → Delivery Completed
```

### Order Lifecycle

```
Draft → Ordered → In Lab → Ready → Delivered
  │        │         │        │
  └────────┴─────────┴────────┴──→ Cancelled
```

### Payment Lifecycle

```
Bill Created (totalAmount, pendingAmount)
  → Payment 1 (partial)
  → Payment 2 (partial)
  → ...
  → Payment N (remaining)
  → pendingAmount = 0
```

## Cross-References

- **Complete technical specification**: See `PROJECT.md`
- **AI agent hierarchy**: See `AGENTS.md`
- **Business domains**: See `knowledge/business-domains.md`
- **Feature map**: See `knowledge/feature-map.md`
- **Architecture map**: See `knowledge/architecture-map.md`
- **Data flow**: See `knowledge/data-flow.md`

## AI Instructions

When working on this project:
1. Always understand the business context before making changes
2. Always consider the impact on all stakeholders
3. Always preserve the customer lifecycle
4. Always preserve the order lifecycle
5. Always preserve the payment lifecycle
6. Always consider multi-branch implications
7. Always consider WhatsApp integration implications
