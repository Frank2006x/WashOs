# WashOs API Endpoint Specification (JWT)

## 1. Purpose

This document defines all API endpoints needed for WashOs V1 and the exact JWT-based authentication behavior.

Roles in scope:

1. `student`
2. `laundry_staff`

QR identity policy:

1. Each student has one persistent QR identity.
2. QR is not recreated for each visit/cycle.
3. Student can rotate QR only when not in active processing.
4. Student may keep this active QR on a physical bag sticker/print or present the same active QR from the app.
5. Revoke in V1 means automatic rotate: old QR becomes invalid and a new active QR is returned immediately.

---

## 2. Base API Conventions

1. Base path: `/api`
2. Content type: `application/json`
3. Time format: ISO 8601 UTC
4. ID format: UUID strings
5. Pagination default: `page=1`, `limit=20`

Standard response envelope:

```json
{
  "success": true,
  "message": "optional",
  "data": {}
}
```

Standard error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## 3. JWT Authentication Specification

## 3.1 Token Type

1. Access token: JWT (Bearer)
2. Algorithm: `HS256`
3. Header: `Authorization: Bearer <token>`
4. Expiry: recommended 24h for V1

## 3.2 JWT Claims (Required)

```json
{
  "sub": "<user_id>",
  "role": "student|laundry_staff",
  "reg_no": "optional-for-student",
  "phone": "optional-for-staff",
  "iat": 1712123456,
  "exp": 1712209856,
  "jti": "<token-id-uuid>"
}
```

## 3.3 Server Validation Rules

1. Reject missing/invalid Bearer token with `401`.
2. Verify signature, expiry, and malformed claims.
3. Require `sub` and `role` claims.
4. Enforce route-level role guard.
5. Attach auth context to request (`user_id`, `role`).

## 3.4 Auth Error Codes

1. `AUTH_MISSING_TOKEN` -> `401`
2. `AUTH_INVALID_TOKEN` -> `401`
3. `AUTH_TOKEN_EXPIRED` -> `401`
4. `AUTH_FORBIDDEN_ROLE` -> `403`

---

## 4. Role Access Matrix

1. Public routes: signup/signin/health/version
2. Student-only routes: `/api/student/*`
3. Staff-only routes: `/api/staff/*`
4. Shared authenticated routes: `/api/notifications/*`, `/api/profile/*` (self only)

---

## 5. Auth Endpoints

## 5.1 Student Signup

- Method: `POST`
- Path: `/api/auth/student/signup`
- Auth: Public

Request:

```json
{
  "name": "<string>",
  "reg_no": "<string>",
  "email": "<email>",
  "password": "<string>"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "<uuid>",
      "role": "student",
      "email": "<email>"
    }
  }
}
```

## 5.2 Student Signin

- Method: `POST`
- Path: `/api/auth/student/signin`
- Auth: Public

Request:

```json
{
  "email": "<email>",
  "password": "<string>"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "role": "student",
      "email": "<email>",
      "reg_no": "<reg_no>",
      "name": "<string>"
    }
  }
}
```

## 5.3 Staff Signup

- Method: `POST`
- Path: `/api/auth/staff/signup`
- Auth: Public

Request:

```json
{
  "name": "<string>",
  "phone": "<string>",
  "password": "<string>"
}
```

Response `201` similar to student with role `laundry_staff`.

## 5.4 Staff Signin

- Method: `POST`
- Path: `/api/auth/staff/signin`
- Auth: Public

Request:

```json
{
  "phone": "<string>",
  "password": "<string>"
}
```

Response `200` contains `token` + staff profile.

## 5.5 Logout

- Method: `POST`
- Path: `/api/auth/logout`
- Auth: JWT required

Behavior:

1. Stateless in V1 (client deletes token).
2. Optional: keep token denylist by `jti` for advanced revocation.

---

## 6. Student Endpoints

All routes below require:

1. Valid JWT
2. Role = `student`

## 6.1 Initialize Student Bag Identity (One-Time, Idempotent)

- `POST /api/student/bag/init`

Request:

```json
{
  "label": "optional display label"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "bag": {
      "id": "<uuid>",
      "student_id": "<uuid>",
      "qr_version": 1,
      "is_revoked": false
    },
    "qr": {
      "token": "<signed-qr-token>",
      "payload_preview": {
        "bag_id": "<uuid>",
        "student_id": "<uuid>",
        "version": 1
      }
    }
  }
}
```

Behavior:

1. If student bag does not exist, create it and return QR.
2. If student bag already exists, return existing bag and latest active QR.
3. This endpoint is safe to call repeatedly.

## 6.2 Get Student Bag (Single)


- `GET /api/student/bag`

Returns the single bag identity and current active QR metadata.

## 6.3 Rotate Student QR


- `POST /api/student/bag/qr/rotate`

Rules:

1. Block if bag has active non-collected booking.
2. Increment `qr_version`, invalidate old QR, and return new active QR.

## 6.4 Revoke Student QR (Alias to Rotate)


- `POST /api/student/bag/qr/revoke`

Rules:

1. Block if bag has active non-collected booking.
2. Execute rotate behavior: invalidate old QR and return new active QR.
3. System must always keep one active QR for the student bag identity.

## 6.5 List Student Bookings

- `GET /api/student/bookings`

Query params:

1. `status` (optional)
2. `from`, `to` (optional date range)
3. `page`, `limit`

## 6.6 Get Booking Detail

- `GET /api/student/bookings/:bookingID`

## 6.7 Get Booking Timeline Events

- `GET /api/student/bookings/:bookingID/events`

## 6.8 Update Student Profile

- `PATCH /api/student/profile`

Request (partial):

```json
{
  "name": "optional",
  "email": "optional"
}
```

## 6.9 Change Student Password

- `PATCH /api/student/password`

Request:

```json
{
  "current_password": "<string>",
  "new_password": "<string>"
}
```

---

## 7. Staff Endpoints

All routes below require:

1. Valid JWT
2. Role = `laundry_staff`

## 7.1 List Machines

- `GET /api/staff/machines`

Query params:

1. `type=washer|dryer|all`
2. `status=active|inactive|running|idle|all`

## 7.2 Receive Bag (Scan In)

- `POST /api/staff/scan/receive`

Request:

```json
{
  "qr_token": "<signed-qr-token>"
}
```

Behavior:

1. Verify QR signature and version.
2. Create or activate booking with status `dropped_off`.
3. Write workflow event `received`.

## 7.3 Start Wash

- `POST /api/staff/wash/start`

Request:

```json
{
  "machine_id": "<uuid>",
  "qr_token": "<signed-qr-token>"
}
```

Behavior:

1. Validate machine type = washer.
2. Validate machine idle.
3. Validate booking currently `dropped_off`.
4. Create active machine run and set booking `washing`.

## 7.4 Finish Wash

- `POST /api/staff/wash/finish`

Request:

```json
{
  "machine_id": "<uuid>",
  "qr_token": "<signed-qr-token>"
}
```

Behavior:

1. Validate machine has active wash run.
2. Validate scanned bag matches active run bag.
3. Close run and set booking `wash_done`.

## 7.5 Start Dry

- `POST /api/staff/dry/start`

Same pattern as wash start, with dryer machine and required booking status `wash_done`.

## 7.6 Finish Dry

- `POST /api/staff/dry/finish`

Same pattern as wash finish, setting booking status to `dry_done`.

## 7.7 Mark Ready

- `POST /api/staff/ready`

Request:

```json
{
  "qr_token": "<signed-qr-token>",
  "row_no": "<string>"
}
```

Behavior:

1. Require booking status `dry_done`.
2. Set status `ready_for_pickup`.
3. Save `row_no`.
4. Trigger push notification to student.

## 7.8 Collect (Scan Out)

- `POST /api/staff/scan/collect`

Request:

```json
{
  "qr_token": "<signed-qr-token>",
  "identity_verified": true,
  "verification_note": "optional"
}
```

Behavior:

1. Require booking status `ready_for_pickup`.
2. Require `identity_verified=true`.
3. Set status `collected`.
4. Write event `collected`.

## 7.9 Queue and Tracking

1. `GET /api/staff/bookings/queue`
2. `GET /api/staff/bookings/:bookingID`
3. `GET /api/staff/bookings/:bookingID/events`
4. `GET /api/staff/machines/:machineID/active-run`
5. `GET /api/staff/activity`

## 7.10 Staff Profile and Password

1. `PATCH /api/staff/profile`
2. `PATCH /api/staff/password`

---

## 8. Notification Endpoints (Authenticated)

## 8.1 Register Push Token

- `POST /api/notifications/push-token`

Request:

```json
{
  "token": "<expo_push_token>",
  "platform": "ios|android|web",
  "device_name": "optional"
}
```

## 8.2 Deactivate Push Token

- `DELETE /api/notifications/push-token/:token`

## 8.3 List Notifications

- `GET /api/notifications`

Query params:

1. `read=true|false|all`
2. `page`, `limit`

## 8.4 Mark Notification Read

- `PATCH /api/notifications/:notificationID/read`

Request:

```json
{
  "read": true
}
```

---

## 9. System Endpoints

1. `GET /api/health` (public)
2. `GET /api/version` (public)

---

## 10. Transition Guard Rules (Server-Side)

1. `created -> dropped_off` only through `scan/receive`
2. `dropped_off -> washing` only through `wash/start`
3. `washing -> wash_done` only through `wash/finish` with exact bag match
4. `wash_done -> drying` only through `dry/start`
5. `drying -> dry_done` only through `dry/finish` with exact bag match
6. `dry_done -> ready_for_pickup` only through `ready`
7. `ready_for_pickup -> collected` only through `scan/collect` with identity verification

Invalid transitions return `409` (`WORKFLOW_INVALID_TRANSITION`).

---

## 11. QR Security API Rules

1. Every scan endpoint receives `qr_token` only.
2. Server verifies signature and token version against DB.
3. Reject revoked/stale token with `403` (`QR_TOKEN_REVOKED_OR_STALE`).
4. Reject forged token with `401` (`QR_TOKEN_INVALID`).

---

## 12. Idempotency and Retry Rules

1. Scanner endpoints accept header `Idempotency-Key`.
2. Repeated same key + same payload returns same success response.
3. Repeated same key + different payload returns `409`.

---

## 13. Suggested HTTP Status Codes

1. `200` success read/update
2. `201` created
3. `400` validation error
4. `401` auth invalid/missing
5. `403` role/qr forbidden
6. `404` resource not found
7. `409` workflow conflict/state conflict
8. `422` semantically invalid operation
9. `500` internal error

---

## 14. Implementation Checklist for Agents

1. Add/extend routes in Go Fiber router files.
2. Add sqlc queries matching every endpoint above.
3. Add middleware for JWT auth + role guard.
4. Add QR token signing/verification utility.
5. Add transition guard service and machine-lock transaction logic.
6. Add notification token handling + Expo push sender.
7. Add endpoint tests covering success and failure paths.

---

## 15. Minimal OpenAPI Starter (Optional)

If generating OpenAPI, use tags:

1. `Auth`
2. `Student`
3. `Staff`
4. `Notifications`
5. `System`

Security scheme:

1. `bearerAuth` (HTTP Bearer JWT)
