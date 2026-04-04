-- =========================
-- Auth and Profile Queries
-- =========================

-- name: GetUserByEmail :one
SELECT *
FROM users
WHERE email = $1
LIMIT 1;

-- name: GetStudentByUserID :one
SELECT *
FROM students
WHERE user_id = $1
LIMIT 1;

-- name: GetStudentByID :one
SELECT *
FROM students
WHERE id = $1
LIMIT 1;

-- name: GetLaundryStaffByUserID :one
SELECT *
FROM laundry_staff
WHERE user_id = $1
LIMIT 1;

-- Staff signs in by phone.
-- name: GetLaundryStaffUserByPhone :one
SELECT u.*
FROM users u
JOIN laundry_staff ls ON ls.user_id = u.id
WHERE ls.phone = $1
LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (email, password, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CreateStudent :one
INSERT INTO students (user_id, reg_no, name)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CreateLaundryStaff :one
INSERT INTO laundry_staff (user_id, name, phone, laundry_service_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetFirstLaundryService :one
SELECT *
FROM laundry_services
ORDER BY created_at ASC
LIMIT 1;

-- name: EnsureDefaultLaundryService :one
INSERT INTO laundry_services (name)
VALUES ($1)
ON CONFLICT (name)
DO UPDATE SET updated_at = NOW()
RETURNING *;

-- =========================
-- Bag Queries
-- =========================

-- One bag per student; idempotent init.
-- name: InitStudentBag :one
INSERT INTO bags (student_id)
VALUES ($1)
ON CONFLICT (student_id)
DO UPDATE SET updated_at = NOW()
RETURNING *;

-- name: GetStudentBagByStudentID :one
SELECT *
FROM bags
WHERE student_id = $1
LIMIT 1;

-- name: RotateStudentBagQR :one
UPDATE bags
SET qr_version = qr_version + 1,
    is_revoked = FALSE,
    last_rotated_at = NOW(),
    updated_at = NOW()
WHERE student_id = $1
RETURNING *;

-- Optional alias behavior.
-- name: RevokeStudentBagQRAliasRotate :one
UPDATE bags
SET qr_version = qr_version + 1,
    is_revoked = FALSE,
    last_rotated_at = NOW(),
    updated_at = NOW()
WHERE student_id = $1
RETURNING *;

-- name: GetBagByID :one
SELECT *
FROM bags
WHERE id = $1
LIMIT 1;

-- =========================
-- Booking Queries
-- =========================

-- name: CreateBooking :one
INSERT INTO bookings (student_id, bag_id, status)
VALUES ($1, $2, 'created')
RETURNING *;

-- name: GetBookingByID :one
SELECT *
FROM bookings
WHERE id = $1
LIMIT 1;

-- name: GetStudentBookings :many
SELECT *
FROM bookings
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLatestActiveBookingByBagID :one
SELECT *
FROM bookings
WHERE bag_id = $1
  AND status <> 'collected'
ORDER BY created_at DESC
LIMIT 1;

-- name: GetLatestActiveBookingByStudentID :one
SELECT *
FROM bookings
WHERE student_id = $1
  AND status <> 'collected'
ORDER BY created_at DESC
LIMIT 1;

-- name: ListProcessingBookings :many
SELECT *
FROM bookings
WHERE status IN ('dropped_off', 'washing', 'wash_done', 'drying', 'dry_done')
ORDER BY updated_at DESC
LIMIT $1 OFFSET $2;

-- name: ListReadyBookings :many
SELECT *
FROM bookings
WHERE status = 'ready_for_pickup'
ORDER BY ready_at DESC NULLS LAST, updated_at DESC
LIMIT $1 OFFSET $2;

-- name: CountBookingsOverview :many
SELECT status,
       COUNT(*)::bigint AS total
FROM bookings
GROUP BY status
ORDER BY status;

-- name: ListBookingsByBlock :many
SELECT b.*
FROM bookings b
JOIN students s ON s.id = b.student_id
WHERE UPPER(COALESCE(s.block, '')) = UPPER($1)
ORDER BY b.updated_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateBookingStatus :one
UPDATE bookings
SET status = $2,
    last_actor_user_id = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetBookingDroppedOff :one
UPDATE bookings
SET status = 'dropped_off',
    received_at = NOW(),
    last_actor_user_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetBookingWashing :one
UPDATE bookings
SET status = 'washing',
    wash_started_at = NOW(),
    last_actor_user_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetBookingWashDone :one
UPDATE bookings
SET status = 'wash_done',
    wash_finished_at = NOW(),
    last_actor_user_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetBookingDrying :one
UPDATE bookings
SET status = 'drying',
    dry_started_at = NOW(),
    last_actor_user_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetBookingDryDone :one
UPDATE bookings
SET status = 'dry_done',
    dry_finished_at = NOW(),
    last_actor_user_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetBookingReady :one
UPDATE bookings
SET status = 'ready_for_pickup',
    row_no = $2,
    ready_at = NOW(),
    last_actor_user_id = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetBookingCollected :one
UPDATE bookings
SET status = 'collected',
    collected_at = NOW(),
    last_actor_user_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- =========================
-- Machine and Run Queries
-- =========================

-- name: ListMachinesByType :many
SELECT *
FROM machines
WHERE machine_type = $1
  AND is_active = TRUE
ORDER BY code ASC;

-- name: GetMachineByID :one
SELECT *
FROM machines
WHERE id = $1
LIMIT 1;

-- name: CreateMachineRun :one
INSERT INTO machine_runs (booking_id, bag_id, machine_id, machine_type, started_by_user_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetRunningMachineRunByMachineID :one
SELECT *
FROM machine_runs
WHERE machine_id = $1
  AND status = 'running'
LIMIT 1;

-- name: FinishMachineRun :one
UPDATE machine_runs
SET status = 'finished',
    ended_by_user_id = $2,
    ended_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- =========================
-- Workflow Event Queries
-- =========================

-- name: CreateWorkflowEvent :one
INSERT INTO workflow_events (
  booking_id,
  bag_id,
  student_id,
  machine_id,
  triggered_by_user_id,
  triggered_role,
  event_type,
  metadata
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetBookingWorkflowEvents :many
SELECT *
FROM workflow_events
WHERE booking_id = $1
ORDER BY created_at ASC;

-- =========================
-- Notification Queries
-- =========================

-- name: UpsertPushToken :one
INSERT INTO push_tokens (user_id, token, platform, device_name, is_active, last_seen_at)
VALUES ($1, $2, $3, $4, TRUE, NOW())
ON CONFLICT (token)
DO UPDATE SET user_id = EXCLUDED.user_id,
              platform = EXCLUDED.platform,
              device_name = EXCLUDED.device_name,
              is_active = TRUE,
              last_seen_at = NOW(),
              updated_at = NOW()
RETURNING *;

-- name: DeactivatePushToken :exec
UPDATE push_tokens
SET is_active = FALSE,
    invalidated_at = NOW(),
    updated_at = NOW()
WHERE token = $1;

-- name: CreateNotification :one
INSERT INTO notifications (recipient_user_id, booking_id, title, message, payload)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListNotificationsByUser :many
SELECT *
FROM notifications
WHERE recipient_user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListUnreadNotificationsByUser :many
SELECT *
FROM notifications
WHERE recipient_user_id = $1
  AND is_read = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: MarkNotificationRead :one
UPDATE notifications
SET is_read = TRUE,
    read_at = NOW()
WHERE id = $1
  AND recipient_user_id = $2
RETURNING *;

-- =========================
-- Student Query Queries
-- =========================

-- name: RaiseQuery :one
INSERT INTO queries (
  booking_id,
  student_id,
  raised_by_user_id,
  title,
  description,
  image_url,
  service_rating,
  handling_rating
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListQueriesByRaisedByUser :many
SELECT *
FROM queries
WHERE raised_by_user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetStudentQueryByID :one
SELECT *
FROM queries
WHERE id = $1
  AND raised_by_user_id = $2
LIMIT 1;

-- name: GetQueryByID :one
SELECT *
FROM queries
WHERE id = $1
LIMIT 1;

-- name: UpdateStudentQueryRatings :one
UPDATE queries
SET service_rating = $3,
    handling_rating = $4,
    updated_at = NOW()
WHERE id = $1
  AND raised_by_user_id = $2
RETURNING *;

-- name: ListStaffQueries :many
SELECT *
FROM queries
ORDER BY created_at ASC
LIMIT $1 OFFSET $2;

-- name: GetStaffRatingSummary :one
SELECT
  COALESCE(AVG(service_rating)::float8, 0) AS avg_service_rating,
  COALESCE(AVG(handling_rating)::float8, 0) AS avg_handling_rating,
  COALESCE(
    AVG(
      (
        COALESCE(service_rating, 0) + COALESCE(handling_rating, 0)
      )::float8 /
      NULLIF(
        (CASE WHEN service_rating IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN handling_rating IS NOT NULL THEN 1 ELSE 0 END),
        0
      )
    ),
    0
  ) AS avg_overall_rating,
  COUNT(*)::bigint AS rated_query_count
FROM queries
WHERE assigned_staff_user_id = $1
  AND (service_rating IS NOT NULL OR handling_rating IS NOT NULL);

-- name: SetQueryAcknowledged :one
UPDATE queries
SET status = 'acknowledged',
    assigned_staff_user_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetQueryResolved :one
UPDATE queries
SET status = 'resolved',
    assigned_staff_user_id = $2,
    resolved_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetQueryClosed :one
UPDATE queries
SET status = 'closed',
    assigned_staff_user_id = $2,
    closed_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateQueryReply :one
INSERT INTO query_replies (query_id, replied_by_user_id, message)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListQueryRepliesByQueryID :many
SELECT *
FROM query_replies
WHERE query_id = $1
ORDER BY created_at ASC;
