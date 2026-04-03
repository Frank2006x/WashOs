# WashOs V1 Build Plan (Agent-Ready)

## 1. Goal

Build a production-oriented V1 laundry workflow for **two roles only**:

1. `student`
2. `laundry_staff`

Implement end-to-end flow:

1. Account signup/signin for both roles
2. Student gets one persistent QR identity (secure, non-forgeable)
3. Staff scan-in when receiving bag
4. Staff machine-controlled wash and dry lifecycle with strict matching
5. Staff mark bag ready with row number
6. Student pickup with final staff scan-out validation
7. Student push notification when bag is ready
8. Repeatable for unlimited future cycles per student

No warden features in V1 UI/API flow.

---

## 2. Locked Product Decisions

1. Roles in V1: `student` + `laundry_staff` only.
2. Student signup fields: `name`, `reg_no`, `email`, `password`.
3. Laundry staff signup fields: `name`, `phone`, `password`.
4. Student signin: `email + password`.
5. Laundry staff signin: `phone + password`.
6. QR security: server-signed payload, verified server-side on every scan.
7. Machine rule: strictly one active bag per machine at a time.
8. Finish wash/dry must scan the exact same bag that started that machine run.
9. Pickup flow: staff re-scan bag QR and verify student identity before scan-out.
10. QR rotation policy: student cannot rotate QR while bag is in active processing.
11. Notification channel in V1: Expo push token flow (no Firebase custom infra in scope).
12. QR issuance policy: one QR identity per student account; do not create a new QR per visit.
13. QR usage policy: student may attach the active QR physically on the bag (sticker/print) or show the same active QR from the app.

---

## 3. Current Codebase Baseline

### Client (Expo)

1. Auth context exists: `client/contexts/AuthContext.tsx`
2. API wrapper exists: `client/services/api.ts`
3. Secure auth storage exists: `client/utils/authStorage.ts`
4. Routes currently minimal: `client/app/index.tsx`, `client/app/(tabs)/*`
5. No QR scanning/generation packages installed yet.
6. No push notification integration yet.

### Server (Go + Fiber + Postgres + sqlc)

1. Auth login/logout currently exists in `server/internal/handler/auth.handler.go`
2. Auth middleware exists in `server/internal/auth/middleware.go`
3. Base schema includes bags/bookings in `server/sql/schema.sql`
4. sqlc query surface currently minimal in `server/sql/query.sql`
5. Routing currently minimal in `server/internal/router/auth.router.go`

---

## 4. System Architecture (V1)

### 4.1 Core Domain Objects

1. `users` (base identity + role)
2. `students` (profile with reg_no/email)
3. `laundry_staff` (profile with phone)
4. `bags` (one bag identity per student with QR versioning)
5. `bookings` (one lifecycle instance per laundry cycle)
6. `machines` (washers/dryers)
7. `machine_runs` (one active run per machine)
8. `workflow_events` (immutable audit trail)
9. `push_tokens` (device token per logged-in user/device)
10. `notifications` (delivery record + troubleshooting)

### 4.2 Lifecycle State Machine

Use canonical statuses:

1. `created`
2. `dropped_off`
3. `washing`
4. `wash_done`
5. `drying`
6. `dry_done`
7. `ready_for_pickup`
8. `collected`

Allowed transitions:

1. `created -> dropped_off`
2. `dropped_off -> washing`
3. `washing -> wash_done`
4. `wash_done -> drying`
5. `drying -> dry_done`
6. `dry_done -> ready_for_pickup`
7. `ready_for_pickup -> collected`

All other transitions must be rejected.

### 4.3 Machine Invariant

1. A machine can have only one active run (`status = running`) at any time.
2. Starting wash/dry checks machine availability inside DB transaction.
3. Finishing wash/dry validates machine has active run and scanned bag matches run bag.
4. If mismatch: reject with `409` and no state changes.

---

## 5. Security Requirements

## 5.1 Password Security

1. Hash passwords with bcrypt on signup.
2. Compare hashed passwords on signin.
3. Never return password hashes in responses.

## 5.2 JWT and Route Security

1. Keep JWT auth middleware on all protected routes.
2. Enforce role checks per endpoint (`student` or `laundry_staff`).
3. Validate JWT secret on startup (non-empty, minimum strength policy).

## 5.3 QR Anti-Forgery

Use signed QR token format (example fields):

1. `bag_id`
2. `student_id`
3. `reg_no`
4. `version`
5. `issued_at`
6. `nonce`

Rules:

1. Signature verification required server-side on every scan.
2. Also verify DB ownership and `bags.qr_version` matches token version.
3. Old/revoked versions are always rejected.
4. Student cannot revoke/regenerate QR during active lifecycle states.

---

## 6. Database Design Changes

Update `server/sql/schema.sql` and regenerate sqlc models.

## 6.1 Required New/Updated Tables

1. `machines`
2. `machine_runs`
3. `workflow_events`
4. `push_tokens`
5. `notifications`

Extend existing:

1. `bags`: enforce one row per student and add `qr_version`, `is_revoked`, `last_rotated_at`.
2. `bookings`: add processing timestamps and `row_no` for ready pickup location.

## 6.2 Suggested Constraints

1. Unique student reg no.
2. Unique student email.
3. Unique staff phone.
4. Unique active run per machine (partial unique index where run status is active/running).
5. FK integrity across booking, bag, student, machine run tables.
6. Unique constraint for one bag per student (`bags.student_id` unique).

## 6.3 Suggested Indexes

1. `bags(student_id)`
2. `bags(qr_code)` or token lookup key
3. `bookings(student_id, status, created_at desc)`
4. `bookings(bag_id, created_at desc)`
5. `machine_runs(machine_id, status)`
6. `workflow_events(booking_id, created_at)`
7. `push_tokens(user_id, is_active)`

---

## 7. API Contract (V1)

All JSON. Use JWT auth for protected routes.

## 7.1 Auth

1. `POST /api/auth/student/signup`
2. `POST /api/auth/staff/signup`
3. `POST /api/auth/student/signin`
4. `POST /api/auth/staff/signin`
5. `POST /api/auth/logout`

## 7.2 Student Bag Management

1. `POST /api/student/bag/init`
2. `GET /api/student/bag`
3. `POST /api/student/bag/qr/rotate`
4. `POST /api/student/bag/qr/regenerate` (optional alias; same behavior as rotate)
5. `GET /api/student/bookings`

Behavior:

1. Bag init is idempotent and creates student bag identity once; later calls return existing bag + latest active QR.
2. Rotate immediately invalidates old QR, increments `qr_version`, and returns a new active QR in the same response.
3. Rotate is disallowed if bag has active non-collected booking.
4. Revoke request should be treated as rotate behavior in V1 (never leave student without one active QR).

## 7.3 Laundry Staff Workflow

1. `GET /api/staff/machines?type=washer|dryer`
2. `POST /api/staff/scan/receive`
3. `POST /api/staff/wash/start`
4. `POST /api/staff/wash/finish`
5. `POST /api/staff/dry/start`
6. `POST /api/staff/dry/finish`
7. `POST /api/staff/ready`
8. `POST /api/staff/scan/collect`

Each operation requires QR payload and enforces lifecycle transition checks.

## 7.4 Notifications

1. `POST /api/notifications/push-token`
2. `DELETE /api/notifications/push-token/:token`
3. `GET /api/notifications`

On `ready_for_pickup`, backend sends Expo push and logs delivery result.

---

## 8. Backend Implementation Plan (By File)

## 8.1 Schema and Queries

1. Update `server/sql/schema.sql` with new tables/columns/indexes/constraints.
2. Extend `server/sql/query.sql` for:
	1. signup/signin lookup and insert queries
	2. one-time bag init/get/rotate queries
	3. booking creation and status transition queries
	4. machine availability + run start/finish queries
	5. workflow event insertion queries
	6. push token insert/upsert/deactivate queries
3. Regenerate sqlc outputs into `server/internal/repository/*`.

## 8.2 Auth Layer

1. Add password hashing helper under `server/internal/auth/`.
2. Update `server/internal/handler/auth.handler.go`:
	1. implement student/staff signup
	2. split signin by identifier type
	3. keep role-aware response shape
3. Ensure middleware + role guard helper is reusable for workflow routes.

## 8.3 Workflow Handlers

Create handlers under `server/internal/handler/`:

1. `student_bag.handler.go`
2. `staff_workflow.handler.go`
3. `notification.handler.go`

Key implementation points:

1. Use DB transactions for start/finish machine operations.
2. Reject illegal state transitions centrally.
3. Write `workflow_events` on every successful state change.
4. Log actor user id (`triggered_by`) for traceability.

## 8.4 Routing

1. Add route setup files in `server/internal/router/`:
	1. `auth.router.go` extend for new auth paths
	2. `student.router.go`
	3. `staff.router.go`
	4. `notification.router.go`
2. Register route groups from `server/cmd/api/main.go`.

## 8.5 Push Service

1. Add service under `server/internal/service/notifications/`.
2. Implement Expo push sender (HTTP API).
3. Add retry-safe logging in `notifications` table.
4. Trigger send when booking transitions to `ready_for_pickup`.

---

## 9. Client Implementation Plan (By File/Area)

## 9.1 Dependencies

Add packages in `client/package.json`:

1. camera + qr scanning package
2. qr rendering package for student QR display
3. `expo-notifications`

## 9.2 Auth and Route Structure

1. Keep provider in `client/app/_layout.tsx`.
2. Expand `client/contexts/AuthContext.tsx` to support both signup/signin paths.
3. Add role-based route groups:
	1. `client/app/(student)/...`
	2. `client/app/(staff)/...`
4. Keep unauth screens under auth group, split signin/signup clearly.

## 9.3 Student Screens

1. Signup/signin screens.
2. My Bag screen:
	1. generate/show QR
	2. regenerate/revoke actions
	3. enforce backend validation responses
3. Booking history/status timeline screen.
4. Notification inbox or status banner for ready alerts.

## 9.4 Staff Screens

1. Signup/signin screens.
2. Receive bag scanner screen.
3. Wash start/finish screen with machine selector and scanner.
4. Dry start/finish screen with machine selector and scanner.
5. Ready screen: scan bag + set row number.
6. Collection screen: scan bag to mark collected after identity check.

## 9.5 Notifications on Client

1. Register push permissions on signin.
2. Send device token to backend.
3. Handle foreground and tap-open flows.
4. Show booking detail when notification tapped.

---

## 10. Validation Rules

## 10.1 Student

1. `reg_no`: required, normalized format.
2. `email`: required, valid email, unique.
3. `password`: enforce minimum policy.

## 10.2 Laundry Staff

1. `name`: required.
2. `phone`: required, normalized, unique.
3. `password`: enforce minimum policy.

## 10.3 Workflow

1. QR payload parse and signature validation required.
2. Bag ownership and booking state checks required.
3. Machine mismatch and state mismatch return conflict errors.
4. Idempotent duplicate scans should not double-transition state.

---

## 11. Testing Strategy

## 11.1 Backend Tests

1. Auth signup/signin success/failure per role.
2. Password hashing and compare behavior.
3. JWT middleware + role guard enforcement.
4. State machine transition table tests.
5. Machine lock concurrency tests (parallel start attempts).
6. Wrong bag finish rejection tests.
7. QR tamper/replay/revoked token rejection tests.
8. Push token registration and notification trigger tests.

## 11.2 Client Tests (or Manual E2E if test infra not ready)

1. Auth flows for student and staff.
2. Camera permission and scan success/failure states.
3. Student QR regenerate/revoke UX and error states.
4. Staff machine flow correctness across wash and dry.
5. Ready push receipt and deep-link/open behavior.
6. Collection flow final state update to `collected`.

## 11.3 End-to-End Scenario Matrix

1. Happy path full cycle.
2. Machine already busy.
3. Wrong bag scanned on finish.
4. QR revoked token scanned.
5. Duplicate scan requests.
6. Unauthorized role trying wrong endpoint.

---

## 12. Definition of Done

Feature is done only when all are true:

1. Both roles can signup/signin with required fields and secure password handling.
2. Student can generate QR and rotate/revoke per policy.
3. Staff can receive, wash start/finish, dry start/finish, mark ready, and collect.
4. Machine lock invariant is enforced at DB + API level.
5. Invalid transitions and forged/tampered QR are rejected.
6. Student gets push notification when bag is ready.
7. Full lifecycle events are auditable per booking.
8. Repeated cycles per student work without data corruption.

---

## 13. Suggested Build Order (Execution Sequence)

1. Schema updates + sqlc query additions + regenerate repository code.
2. Auth signup/signin role-specific endpoints with hashed passwords.
3. Student single-bag QR init + rotate APIs (regenerate/revoke as rotate aliases).
4. Staff receive/wash/dry/ready/collect APIs with transaction-safe machine locking.
5. Workflow event logging and transition guard centralization.
6. Expo push token storage and server push sender.
7. Client auth screens and role-based route groups.
8. Client student QR and booking timeline UI.
9. Client staff scanner + machine flow UI.
10. End-to-end testing, race-condition checks, and error UX polish.

---

## 14. Agent Work Split (Optional)

For multi-agent parallel execution, assign:

1. Agent A: DB schema/query/sqlc generation
2. Agent B: Auth + route guards
3. Agent C: Staff workflow handlers + machine locking
4. Agent D: Client role-based navigation + auth screens
5. Agent E: QR scan/generation UI + service integration
6. Agent F: Push notification backend + client registration
7. Agent G: Test suite + e2e scenario verification

Merge order recommendation:

1. A -> B -> C
2. D and E after B stable
3. F after C stable
4. G runs continuously and final hardening

---

## 15. Implementation Notes to Prevent Rework

1. Keep status values stable from day one; map user-friendly labels in client only.
2. Put transition validation in one reusable backend function to avoid divergence.
3. Use transaction boundaries for all machine start/finish operations.
4. Emit workflow event after every successful transition.
5. Keep notification send side-effect after transaction commit to avoid ghost notifications.
6. Design APIs idempotently for scanner retry scenarios.
7. Keep all role checks explicit at route layer and handler layer.

---

## 16. Non-Goals for V1

1. Warden workflow UI/features.
2. Multi-bag batch processing per single machine run.
3. Advanced scheduling optimization.
4. Firebase-specific custom push backend.
5. Analytics dashboard beyond basic logs/events.

---

## 17. Handoff Prompt Template (for Any Agent)

Use this exact brief when delegating implementation:

"Implement WashOs V1 exactly per AGENT_IMPLEMENTATION_PLAN.md. Follow locked decisions, lifecycle transitions, and machine locking invariants. Do not include warden features. Build role-specific signup/signin, secure server-signed QR flow, strict wash/dry start-finish matching, ready notification via Expo push token flow, and final collection scan-out with identity verification step. Ensure DB constraints, transactional safety, and auditable workflow events."

---

## 18. Full Bag Tracking Specification (End-to-End)

This section is mandatory to guarantee complete student-visible and staff-visible tracking.

## 18.1 Tracking Fields Per Booking

For each booking (one laundry cycle), persist and expose:

1. `booking_id`
2. `bag_id`
3. `student_id`
4. `current_status`
5. `received_at`
6. `wash_started_at`
7. `wash_finished_at`
8. `wash_machine_id`
9. `dry_started_at`
10. `dry_finished_at`
11. `dry_machine_id`
12. `ready_at`
13. `row_no`
14. `collected_at`
15. `last_actor_user_id`
16. `last_actor_role`
17. `notes` (optional)
18. `updated_at`

## 18.2 Event Log Requirements

Create immutable timeline rows in `workflow_events` for every action:

1. `bag_created`
2. `qr_regenerated`
3. `qr_rotated`
4. `received`
5. `wash_started`
6. `wash_finished`
7. `dry_started`
8. `dry_finished`
9. `marked_ready`
10. `collected`
11. `action_rejected` (for traceability on invalid attempts)

Each event must contain:

1. `booking_id`
2. `bag_id`
3. `event_type`
4. `triggered_by`
5. `triggered_role`
6. `machine_id` when relevant
7. `metadata` JSON (reason/error context, row_no, token version)
8. `created_at`

## 18.3 Student Tracking Views

Student must see, for each active and historical cycle:

1. Current status text and icon.
2. Full timestamp timeline from drop-off to collection.
3. Machine assignment info (machine labels only).
4. Ready row number.
5. Last update time.
6. If rejected/error occurred, show clear reason and required next step.

## 18.4 Staff Tracking Views

Staff must see:

1. Active machine occupancy (which machine has which bag now).
2. Which exact bag is expected for finish action.
3. Status queue by stage (`dropped_off`, `washing`, `wash_done`, `drying`, `dry_done`, `ready_for_pickup`).
4. Scan history and latest action outcome.

---

## 19. Screen Inventory and Required Options

Implement all screens below to avoid missing UX flows.

## 19.1 Unauthenticated Screens

1. Role Selection Screen
	1. Choose Student or Laundry Staff
	2. Go to Signin or Signup
2. Student Signup Screen
3. Student Signin Screen
4. Staff Signup Screen
5. Staff Signin Screen

Common options:

1. Show/hide password
2. Basic input validation errors
3. Retry on network failure

## 19.2 Student App Screens

1. Student Home Dashboard
	1. Active bag status card
	2. Next recommended action
	3. Recent notifications
2. My Bag Screen
	1. Display active QR
	2. Rotate QR action (when allowed)
	3. Optional alias label: Regenerate QR
	4. Show instruction that student can stick/print this QR on bag or present the same QR in app.
3. Tracking Timeline Screen
	1. Step-by-step lifecycle timeline
	2. Event timestamps and machine labels
4. Booking History Screen
	1. List past cycles
	2. Filter by date/status
	3. Open cycle details
5. Notification Inbox Screen
	1. Read/unread state
	2. Open booking from notification
6. Profile and Security Screen
	1. View profile
	2. Update password
	3. Logout

## 19.3 Staff App Screens

1. Staff Home Dashboard
	1. Active machine cards
	2. Queue counts by stage
2. Receive Bag Screen
	1. Open scanner
	2. Scan-in action
3. Wash Start Screen
	1. Select washer machine
	2. Scan bag to start wash
4. Wash Finish Screen
	1. Select running washer machine
	2. Scan exact bag to finish wash
5. Dry Start Screen
	1. Select dryer machine
	2. Scan bag to start dry
6. Dry Finish Screen
	1. Select running dryer machine
	2. Scan exact bag to finish dry
7. Mark Ready Screen
	1. Scan bag
	2. Enter row number
	3. Confirm ready
8. Collection Scan-Out Screen
	1. Verify student identity step (manual confirmation)
	2. Scan bag to mark collected
9. Machine Management Screen
	1. List machine states
	2. View currently assigned bag
10. Staff Activity Log Screen
	1. Recent scans/actions
	2. Success/failure tags

## 19.4 Error and Utility Screens

1. Camera permission blocked screen
2. Invalid/forged QR error modal
3. Wrong machine/bag mismatch error modal
4. Offline mode warning with retry queue note
5. Session expired screen

---

## 20. CRUD and Operational Matrix

Use this matrix to ensure full data functionality coverage.

## 20.1 Users (Student/Staff)

1. Create
	1. Student signup
	2. Staff signup
2. Read
	1. Own profile read
3. Update
	1. Password change
	2. Optional profile edits (name/phone)
4. Delete
	1. Soft-deactivate account (optional V1.1)

## 20.2 Bags

1. Create
	1. Student initializes single bag identity once (idempotent)
2. Read
	1. Student reads own single bag identity
	2. Staff reads bag by scanned QR
3. Update
	1. Regenerate QR (version bump)
	2. Revoke/Unrevoke policy (revoke in V1, unrevoke optional V1.1)
4. Delete
	1. No delete in V1 (preserve identity and audit links)

## 20.3 Bookings (Laundry Cycles)

1. Create
	1. Create lifecycle record when bag is received
2. Read
	1. Student own bookings list/details
	2. Staff queue list/details
3. Update
	1. Status transitions via workflow endpoints only
	2. Set row number at ready stage
4. Delete
	1. Never hard delete in V1
	2. Optional cancel endpoint before washing starts

## 20.4 Machines

1. Create
	1. Add machine record (seed/admin script)
2. Read
	1. List machine states and active run
3. Update
	1. Toggle active/inactive
	2. Update machine label/metadata
4. Delete
	1. Soft-retire machine

## 20.5 Machine Runs

1. Create
	1. Start wash or dry run
2. Read
	1. Active run by machine
	2. Run history by bag
3. Update
	1. Finish run with exact bag verification
4. Delete
	1. No hard delete (audit retention)

## 20.6 Workflow Events

1. Create
	1. Auto-create on all state changes and key actions
2. Read
	1. Student timeline read (filtered own)
	2. Staff activity log read
3. Update
	1. No updates allowed (immutable)
4. Delete
	1. No delete in V1

## 20.7 Notifications and Push Tokens

1. Create
	1. Register push token
	2. Insert notification on ready state
2. Read
	1. Student notification list
3. Update
	1. Mark notification read/unread
	2. Deactivate invalid push token
4. Delete
	1. Optional archive notifications older than retention period

---

## 21. Additional API Endpoints for Full Tracking and CRUD

Add these to complete functionality coverage.

## 21.1 Student APIs

1. `GET /api/student/bookings/:bookingID`
2. `GET /api/student/bookings/:bookingID/events`
3. `GET /api/student/bag`
4. `PATCH /api/student/profile`
5. `PATCH /api/student/password`
6. `PATCH /api/notifications/:notificationID/read`

## 21.2 Staff APIs

1. `GET /api/staff/bookings/queue`
2. `GET /api/staff/bookings/:bookingID`
3. `GET /api/staff/bookings/:bookingID/events`
4. `GET /api/staff/machines/:machineID/active-run`
5. `GET /api/staff/activity`
6. `PATCH /api/staff/profile`
7. `PATCH /api/staff/password`

## 21.3 System APIs

1. `GET /api/health`
2. `GET /api/version`
3. `GET /api/config/client-flags` (optional)

---

## 22. UX States and Options Checklist

For every scan and transition screen, include:

1. Idle state
2. Scanning state
3. Success state
4. Error state (invalid QR, wrong bag, machine busy)
5. Retry action
6. Manual fallback (type booking id or bag id for support use, optional)
7. Last action summary banner
8. Pull-to-refresh or reload option

For timeline/history screens, include:

1. Empty state
2. Loading skeleton
3. Filter/sort
4. Pagination or infinite scroll
5. Tap-to-view details

---

## 23. Analytics and Observability (Recommended in V1)

Track these metrics to monitor operations quality:

1. Count of received bags per hour/day
2. Average wash duration per machine
3. Average dry duration per machine
4. End-to-end cycle time (`received -> collected`)
5. Scan failure rates (invalid QR, mismatch, unauthorized)
6. Push send success rate
7. Active machine utilization

Add structured logs with correlation ids:

1. `request_id`
2. `booking_id`
3. `bag_id`
4. `machine_id`
5. `actor_user_id`

---

## 24. Edge Cases to Explicitly Implement

1. Student tries QR rotate while bag is in progress -> reject with clear reason.
2. Staff scans a forged or stale QR -> reject and log `action_rejected`.
3. Staff tries to finish machine with wrong bag -> reject and keep run active.
4. Two staff try to start different bags on same machine concurrently -> only one succeeds.
5. Duplicate scan due to network retry -> idempotent response.
6. Student arrives for pickup without matching active ready booking -> reject with support message.
7. Push token expired/invalid -> mark token inactive and continue booking flow.

---

## 25. Updated Definition of Done Additions

Add these criteria on top of Section 12:

1. Student can view complete bag timeline for every cycle from receive to collect.
2. Staff can view machine occupancy and exact expected bag for finish actions.
3. CRUD and operational endpoints are implemented for all listed core entities.
4. Notification inbox read/unread flow is working.
5. Workflow event log is queryable by booking for both student and staff roles.
6. Edge case behavior in Section 24 is covered by tests.

