# Phase 3: Wash Completion Scan and Booking Views

This folder contains Postman assets for Phase 3 APIs.

## Implemented Routes

- POST /api/scan/wash-complete
- GET /api/bookings/processing
- GET /api/bookings/ready
- GET /api/bookings/my/active
- GET /api/bookings/:id

## Files

- phase3.collection.json
- phase3.environment.json

## Auth and Access Rules

- POST /api/scan/wash-complete
  - Requires laundry staff access token

- GET /api/bookings/processing
  - Requires laundry staff access token

- GET /api/bookings/ready
  - Requires laundry staff access token

- GET /api/bookings/my/active
  - Requires student access token

- GET /api/bookings/:id
  - Staff can read any booking
  - Student can read only own booking

## Route Details

### POST /api/scan/wash-complete

Purpose:

- Mark a bag as wash complete based on scanned QR.

Headers:

- Authorization: Bearer <staff_access_token>
- Content-Type: application/json

Body:

```json
{
  "qr_code": "<signed_qr_payload>"
}
```

Success response (200):

```json
{
  "message": "bag marked wash_done",
  "booking": {
    "id": "uuid",
    "status": "wash_done"
  }
}
```

Key behavior:

- Accepts washable states: dropped_off, washing
- Returns idempotent success for already washed states: wash_done, drying, dry_done
- Rejects invalid transitions (example: ready_for_pickup, collected)

### GET /api/bookings/processing

Purpose:

- List bookings currently in processing pipeline.

Headers:

- Authorization: Bearer <staff_access_token>

Query params:

- limit (optional, default 20, max 100)
- offset (optional, default 0)

Success response (200):

```json
{
  "bookings": []
}
```

Included statuses:

- dropped_off
- washing
- wash_done
- drying
- dry_done

### GET /api/bookings/ready

Purpose:

- List bookings ready for pickup.

Headers:

- Authorization: Bearer <staff_access_token>

Query params:

- limit (optional, default 20, max 100)
- offset (optional, default 0)

Success response (200):

```json
{
  "bookings": []
}
```

### GET /api/bookings/my/active

Purpose:

- Fetch latest non-collected booking for logged-in student.

Headers:

- Authorization: Bearer <student_access_token>

Success response with active booking (200):

```json
{
  "booking": {
    "id": "uuid",
    "status": "wash_done"
  }
}
```

Success response when none exists (200):

```json
{
  "booking": null
}
```

### GET /api/bookings/:id

Purpose:

- Fetch booking details by booking id.

Headers:

- Authorization: Bearer <student_or_staff_access_token>

Path param:

- id: booking UUID

Success response (200):

```json
{
  "booking": {
    "id": "uuid",
    "status": "wash_done"
  }
}
```

Common error responses:

- 400 invalid booking id
- 403 student trying to access another student's booking
- 404 booking not found

## Postman Execution Order

Run in this order:

1. Health - Ping
2. Auth - Student Signup
3. Auth - Student Signin
4. Student - Init Bag
5. Auth - Staff Signup
6. Auth - Staff Signin
7. Scan - Intake
8. Scan - Wash Complete
9. Bookings - Processing
10. Bookings - Ready
11. Bookings - My Active
12. Bookings - By ID

## Preconditions

- Server running on http://localhost:3001
- DATABASE_URL and JWT_SECRET configured
- Schema and sqlc generated code up-to-date
- At least one record in laundry_services (required for staff signup)

## Expected Outcomes

- Intake returns 201 and creates a dropped_off booking
- Wash-complete returns 200 and booking transitions to wash_done
- Processing list returns 200 and includes processing statuses
- Ready list returns 200 and returns bookings array
- Student active endpoint returns the booking created in flow
- Booking by id returns the same booking id captured after intake
