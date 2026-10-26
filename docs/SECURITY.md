# Security Design Specification (SECURITY.md) — LifeLedger

## 1. Authentication Architecture
* **Split JWT Storage**:
  * **Access Token**: Short-lived (e.g., 15 minutes) signed JSON Web Token stored strictly in frontend memory (React state). Never save to LocalStorage or SessionStorage to prevent Cross-Site Scripting (XSS) extraction.
  * **Refresh Token**: Long-lived (e.g., 7 days) token stored in a secure cookie with the following attributes:
    * `HttpOnly`: Prevents client-side scripts from reading the cookie.
    * `Secure`: Transmitted strictly over HTTPS.
    * `SameSite=Strict`: Protects against Cross-Site Request Forgery (CSRF).
    * `Path=/api/v1/auth`: Restricts transmission only to the auth token endpoint.
* **OAuth Security**: Google OAuth flow validates authorization codes on the server, generating JWTs strictly after validating ID tokens against Google's public keys.

---

## 2. API Hardening & Middleware
* **Helmet.js**: Configures Express headers to block clickjacking, MIME-sniffing, cross-site scripting, and enforcement of HTTP Strict Transport Security (HSTS).
* **Rate Limiting**:
  * Global limit of 100 requests per 15 minutes per IP.
  * Stricter rate limits for authentication endpoints (`/api/v1/auth/*` restricted to 5 attempts per 15 minutes per IP) to mitigate brute-force attempts.
* **CORS Policy**: Configured to restrict origin requests strictly to the production frontend URL, blocking wildcard inputs.

---

## 3. Data Sanitization & Encryption
* **Input Validation**: Double validation using Zod schemas. Any request payload hitting controllers is validated prior to service delivery.
* **Password Hashing**: Cryptographic hashing via `bcryptjs` using a salt work factor of 10 rounds. Cleartext passwords are never stored or logged.
* **XSS Sanitization**: Sanitization middleware filters HTML tags from request string fields before they are persisted in MongoDB.

---

## 4. Emergency Profile Data Isolation
* **QR Scan Security**: Scan URLs look up profiles via a secure, high-entropy uuid token (`qrToken`) instead of a database `userId` index.
* **Read-Only Restrictions**: The emergency endpoint `/api/v1/emergency/info?token=xyz` is strictly read-only and outputs only basic facts (blood group, allergies, contact telephone numbers), preventing leakage of private reports or account keys.
