# Phase 6: Student Query + Rating Test Suite

This suite validates the new student query workflow:

- Student raises a query with text + image URL
- Student can view own queries and update ratings
- Staff can acknowledge, reply, resolve, and close a query
- Validation and transition checks are enforced

## Routes Covered

- POST /api/student/queries
- GET /api/student/queries
- GET /api/student/queries/:id
- PATCH /api/student/queries/:id/rating
- GET /api/staff/queries
- GET /api/staff/queries/:id
- POST /api/staff/queries/:id/acknowledge
- POST /api/staff/queries/:id/reply
- POST /api/staff/queries/:id/resolve
- POST /api/staff/queries/:id/close

## Files

- phase6-query.collection.json
- phase6-query.environment.json

## Test Order

Run in this order from the collection:

1. Health - Ping
2. Auth - Student Signup
3. Auth - Student Signin
4. Student - Init Bag
5. Auth - Staff Signup
6. Auth - Staff Signin
7. Scan - Intake (Create Booking)
8. Student - Raise Query
9. Student - List My Queries
10. Student - Get My Query
11. Student - Update Query Rating
12. Student - Update Query Rating Invalid (Negative)
13. Staff - List Queries
14. Staff - Get Query
15. Staff - Acknowledge Query
16. Staff - Reply Query
17. Staff - Resolve Query
18. Staff - Close Query
19. Staff - Close Query Again (Idempotent)
20. Student - Update Closed Query Rating (Negative)

## Expected Results

- Raise query: 201 with query id
- List my queries: 200 with `queries` array
- Get query: 200 with `query` and `replies`
- Update rating valid: 200
- Update rating invalid: 400
- Acknowledge/reply/resolve/close: 200 or 201 as specified
- Closing already closed query: 200 (idempotent behavior)
- Update rating after close: 409

## Preconditions

- Server running at http://localhost:3001
- DATABASE_URL and JWT_SECRET configured
- At least one laundry_services row exists (required for staff signup)

## Notes

- This suite creates fresh student/staff identities per run using timestamp seeds.
- `image_url` is validated as an absolute http/https URL.
- The API also supports multipart upload with an `image` file field; uploaded files are stored on Cloudinary and the resulting URL is persisted to `image_url`.
- Query flow depends on having a booking, so intake is included before raise-query.
