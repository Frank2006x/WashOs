# Phase 5: Hardening Test Suite

This suite validates Phase 5 hardening goals:

- Optional overview endpoints
- Idempotency of scan events
- Strict transition guards
- bcrypt-based auth flow behavior

## Routes Covered

- GET /api/admin/bookings/overview (optional)
- GET /api/warden/bookings/block/:blockId (optional)
- POST /api/scan/intake (idempotency check)
- POST /api/scan/wash-complete (idempotency check)
- POST /api/bookings/:id/collect (strict transition check)
- POST /api/auth/student/signin (bcrypt path)

## Files

- phase5.collection.json
- phase5.environment.json

## Test Order

Run in this order from the collection:

1. Health - Ping
2. Auth - Student Signup
3. Auth - Student Signin
4. Auth - Student Signin Wrong Password
5. Student - Init Bag
6. Auth - Staff Signup
7. Auth - Staff Signin
8. Scan - Intake (First)
9. Scan - Intake (Idempotent)
10. Scan - Wash Complete (First)
11. Scan - Wash Complete (Idempotent)
12. Bookings - Collect Before Ready (Strict Transition)
13. Admin - Bookings Overview (Optional)
14. Warden - Bookings by Block (Optional)

## Expected Results

- Intake first call: 201
- Intake second call: 200 (idempotent)
- Wash-complete first call: 200 and status wash_done
- Wash-complete second call: 200 (idempotent)
- Collect before ready_for_pickup: 409
- Student signin with wrong password: 401
- Admin overview: 200
- Warden block bookings: 200 and bookings array

## Preconditions

- Server running at http://localhost:3001
- DATABASE_URL and JWT_SECRET configured
- At least one laundry_services row exists (required for staff signup)

## Notes

- Admin/Warden routes are currently protected with laundry_staff auth because the current schema has roles student and laundry_staff.
- Bcrypt hardening means legacy plaintext users may fail signin unless passwords are bcrypt-hashed.
