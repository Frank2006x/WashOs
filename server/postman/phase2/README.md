# Phase 2: Intake Scan + Schedule

This document explains the Phase 2 API routes and how to test them.

## Scope

Phase 2 focuses on:

- Student schedule visibility
- Vendor QR precheck
- Vendor intake scan

Implemented Phase 2 routes:

- `GET /api/schedules/my`
- `GET /api/bags/qr/:qrCode`
- `POST /api/scan/intake`

Related helper route used in tests:

- `POST /api/student/me/bag/init`

## Base URL

Default local server:

- `http://localhost:3001`

## Authentication and Roles

- `GET /api/schedules/my`
  - Requires `Authorization: Bearer <student_access_token>`
  - Student role required

- `GET /api/bags/qr/:qrCode`
  - Requires `Authorization: Bearer <staff_access_token>`
  - Laundry staff role required

- `POST /api/scan/intake`
  - Requires `Authorization: Bearer <staff_access_token>`
  - Laundry staff role required

## Route Details

### 1) GET /api/schedules/my

Purpose:

- Return the logged-in student's schedule slots for the next 7 days.

Headers:

- `Authorization: Bearer <student_access_token>`

Success response (200):

```json
{
  "student_id": "uuid",
  "block": "A",
  "timezone": "Asia/Kolkata",
  "slots": [
    {
      "date": "2026-04-04",
      "day": "Saturday",
      "drop_start": "07:00",
      "drop_end": "09:00",
      "pickup_start": "18:00",
      "pickup_end": "21:00",
      "is_today": true
    }
  ]
}
```

Notes:

- Current implementation uses generated time slots based on block offset.
- Sundays are skipped.

### 2) GET /api/bags/qr/:qrCode

Purpose:

- Staff precheck before intake.
- Validates QR payload signature and bag ownership/version/revocation state.

Headers:

- `Authorization: Bearer <staff_access_token>`

Path param:

- `qrCode`: signed QR payload from student bag data.

Success response (200):

```json
{
  "valid": true,
  "bag_id": "uuid",
  "student_id": "uuid",
  "reg_no": "24BCEXXXXX",
  "name": "Student Name",
  "block": "A",
  "qr_version": 1,
  "can_intake": true
}
```

Possible conflict response (409):

- Active booking already exists for this bag.
- Outdated QR version.
- Revoked QR.

### 3) POST /api/scan/intake

Purpose:

- Staff records bag drop-off by scanning QR.
- Creates booking and transitions it to `dropped_off`.

Headers:

- `Authorization: Bearer <staff_access_token>`
- `Content-Type: application/json`

Body:

```json
{
  "qr_code": "<signed_qr_payload>"
}
```

Success response (201):

```json
{
  "message": "bag intake recorded",
  "booking": {
    "booking_id": "uuid",
    "status": "dropped_off",
    "bag_id": "uuid",
    "student_id": "uuid",
    "reg_no": "24BCEXXXXX",
    "name": "Student Name"
  }
}
```

Conflict response (409):

```json
{
  "error": "active booking already exists for this bag",
  "booking": {
    "booking_id": "uuid",
    "status": "dropped_off"
  }
}
```

## Test Flow (Postman)

Use files in this folder:

- `phase2.collection.json`
- `phase2.environment.json`

Recommended run order:

1. Health - Ping
2. Auth - Student Signup
3. Auth - Student Signin
4. Student - Init Bag
5. Schedule - My
6. Auth - Staff Signup
7. Auth - Staff Signin
8. Scan - Bag QR Precheck
9. Scan - Intake

## Required Data/Setup

- `.env` must include:
  - `DATABASE_URL`
  - `JWT_SECRET`

- Database schema and sqlc-generated code must be up to date.

- For staff signup to pass (`201`), at least one row must exist in `laundry_services`.
  - If no service exists, staff signup may return `412` and staff scan routes cannot be executed.

## Troubleshooting

- `401 Unauthorized`
  - Missing/invalid bearer token
  - Wrong role for route

- `400 invalid qr code`
  - Corrupted QR payload
  - Non-signed payload

- `409 active booking already exists`
  - Bag already has non-collected booking; finish existing flow first.
