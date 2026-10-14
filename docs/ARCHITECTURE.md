# System Architecture - LifeLedger

## Project Name
LifeLedger

---

# Architecture Overview
LifeLedger follows a modern, scalable, enterprise-grade full-stack architecture.
The project must be modular, reusable, maintainable, and production-ready.
The frontend and backend must be completely decoupled and communicate only through REST APIs.
Business logic must never exist inside UI components.
Database access must never occur directly from controllers.
Every layer should have a single responsibility.

---

# High-Level Architecture
```
                        User
                          │
                          ▼
                 Next.js Frontend
                          │
                 Axios / React Query
                          │
                          ▼
                  Express REST API
                          │
          Authentication Middleware
                          │
                          ▼
                    Controllers
                          │
                          ▼
                      Services
                          │
                          ▼
                   Repository Layer
                          │
                          ▼
                      MongoDB Atlas

External Services
Cloudinary
Gemini API
Google Maps API
Email Service
Redis (Optional)
```

---

# Frontend Architecture
Technology:
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- HeroUI
- Magic UI
- Aceternity UI
- Framer Motion

The frontend follows Feature-Based Architecture.
Example:
```
app/
features/
shared/
components/
hooks/
services/
types/
utils/
providers/
context/
```
Each feature should contain its own:
- components
- hooks
- services
- types
- validation
- utilities

---

# Backend Architecture
Technology:
- Node.js
- Express.js
- TypeScript

Backend follows Clean Architecture:
```
Routes -> Controllers -> Services -> Repositories -> Models -> MongoDB
```

Responsibilities:
- **Routes**: Only map endpoints.
- **Controllers**: Receive requests, validate input, call services, return responses.
- **Services**: Contain all business logic.
- **Repositories**: Communicate with MongoDB.
- **Models**: Only define schemas.

---

# AI Architecture
```
Medical Report Upload -> Cloudinary -> OCR Extraction -> Gemini AI -> Medical Report Analysis -> Timeline Generation -> Risk Prediction -> Health Story -> Dashboard Insights
```

---

# Authentication Flow
```
User -> Login -> JWT Access Token -> Refresh Token -> Protected Routes -> Authorized APIs
```
Role Based Access:
- User
- Doctor
- Admin (Future)

---

# Database Flow
```
Frontend -> REST API -> Service -> Repository -> MongoDB Atlas
```

---

# Folder Structure
```
LifeLedger
apps/
  web/
  server/
packages/
  ui/
  types/
  utils/
  config/
docs/
assets/
.cursor/
```

---

# API Design
RESTful APIs only.

Response Format:
```json
{
  "success": true,
  "message": "",
  "data": {}
}
```

Error Format:
```json
{
  "success": false,
  "message": "",
  "error": {}
}
```

---

# State Management
- React Context
- TanStack Query
- Server State
- Local State
- Global Theme
- Authentication Context

---

# File Upload Flow
```
User -> Upload -> Validation -> Cloudinary -> Metadata -> MongoDB -> AI Analysis
```

---

# Security Principles
- JWT Authentication
- Helmet
- Rate Limiting
- Input Validation
- Environment Variables
- Password Hashing
- Role Based Authorization
- Secure Cookies

---

# Performance Principles
- Lazy Loading
- Dynamic Imports
- Code Splitting
- Image Optimization
- Server Components
- Caching
- Pagination
- Debouncing

---

# Development Principles
- SOLID
- DRY
- KISS
- Clean Architecture
- Reusable Components
- Strict TypeScript
- Feature-Based Structure
- Scalable Folder Organization
- No Duplicate Code

---

# Important Rules
- Frontend and backend must remain independent.
- Never place business logic inside React components.
- Never access MongoDB directly from controllers.
- Always keep components reusable.
- Every feature should be modular.
- The project should be easy to extend without changing existing code.
- Maintain consistency throughout the project.
