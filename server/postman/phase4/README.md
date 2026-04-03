# Phase 4: Student Pickup Verification Tests

This folder contains Postman tests for Phase 4 routes:

- POST /api/scan/pickup-verify
- POST /api/bookings/:id/collect
- GET /api/notifications/my/unread
- PATCH /api/notifications/:id/read

## Files

- phase4.collection.json
- phase4.environment.json

## Test Flow

1. Health - Ping
2. Student signup/signin
3. Student bag init (captures qr_payload)
4. Staff signup/signin
5. Intake scan (creates booking_id)
6. Wash complete scan (moves booking to wash_done)
7. Pickup verify (expected 409 until booking is ready_for_pickup)
8. Collect booking (expected 409 until booking is ready_for_pickup)
9. List unread notifications
10. Mark notification read (200 if exists, 404 when no unread item)

## Why 409 for pickup/collect in this suite

Current implemented Phase 4 enforces ready_for_pickup before pickup verification and collection. This suite validates that guardrail by default.

If you later add/execute a route that transitions booking to ready_for_pickup, then:

- pickup-verify should return 200 with verified=true
- collect should return 200 and status collected

## Preconditions

- Server running at http://localhost:3001
- DATABASE_URL and JWT_SECRET set
- At least one laundry_services row for staff signup

## Assertions included

- Role-protected endpoints require proper bearer token
- pickup-verify conflict behavior before ready state
- collect conflict behavior before ready state
- unread notifications endpoint always returns array
- mark-read endpoint allows 200 (found) or 404 (not found)
