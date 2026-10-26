# API Specification - LifeLedger

Base URL: `/api/v1`
Style: REST
Content Type: `application/json`
Authentication: JWT Bearer Token (`Authorization: Bearer <token>`)

---

# Response Formats

Success:
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

Error:
```json
{
  "success": false,
  "message": "Error message",
  "error": {}
}
```

---

# Routes & Endpoints

## Authentication
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/google`
- `POST /auth/apple`
- `POST /auth/logout`
- `POST /auth/refresh-token`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/verify-email`
- `GET /auth/profile`
- `PUT /auth/profile`
- `DELETE /auth/account`

## Dashboard
- `GET /dashboard` (Returns aggregated widgets, health scores, timeline preview)

## Medical Reports
- `POST /reports/upload`
- `GET /reports`
- `GET /reports/:id`
- `PUT /reports/:id`
- `DELETE /reports/:id` (Soft delete)
- `GET /reports/search`
- `GET /reports/filter`
- `GET /reports/history`

## AI Engine
- `POST /ai/analyze`
- `GET /ai/history`
- `GET /ai/timeline`
- `GET /ai/story`
- `POST /ai/risk-prediction`
- `POST /ai/medicine-check`
- `POST /ai/ask`

## Hospitals & Geospatial
- `GET /hospitals` (Nearby hospitals)
- `GET /hospitals/:id`
- `GET /hospitals/search`
- `GET /hospitals/departments`
- `GET /hospitals/emergency`

## Doctors
- `GET /doctors`
- `GET /doctors/:id`
- `GET /doctors/search`
- `GET /doctors/specializations`
- `GET /doctors/availability`
- `POST /doctor/profile` (Onboarding)
- `PUT /doctor/profile`

## Appointments
- `POST /appointments` (Book slot)
- `GET /appointments` (History)
- `GET /appointments/:id`
- `PUT /appointments/:id` (Reschedule)
- `DELETE /appointments/:id` (Cancel)
- `GET /appointments/upcoming`

## Family Vault
- `POST /family` (Add member)
- `GET /family` (List members)
- `PUT /family/:id` (Update permissions/details)
- `DELETE /family/:id` (Remove member)

## Emergency
- `GET /emergency/qr` (Generate emergency QR code mapping)
- `POST /emergency/share`
- `GET /emergency/info`

## Notifications
- `GET /notifications`
- `PUT /notifications/:id/read`
- `DELETE /notifications/:id`

## Settings
- `GET /settings`
- `PUT /settings`
