package dbgen

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func sqlDate(t time.Time) string {
	return t.Format("2006-01-02")
}

func sqlTime(t time.Time) string {
	return t.Format("15:04:05")
}

type SlotWindowAvailability struct {
	ID                 pgtype.UUID `json:"id"`
	Date               time.Time   `json:"date"`
	StartTime          time.Time   `json:"start_time"`
	EndTime            time.Time   `json:"end_time"`
	AllowedStartFloor  int32       `json:"allowed_start_floor"`
	AllowedEndFloor    int32       `json:"allowed_end_floor"`
	CyclePart          int32       `json:"cycle_part"`
	CapacityLimit      int32       `json:"capacity_limit"`
	DayLimit           int32       `json:"day_limit"`
	BookedCount        int64       `json:"booked_count"`
	EligibleViaOverride bool       `json:"eligible_via_override"`
}

type SlotReservationWithWindow struct {
	ReservationID      pgtype.UUID `json:"reservation_id"`
	SlotWindowID       pgtype.UUID `json:"slot_window_id"`
	StudentID          pgtype.UUID `json:"student_id"`
	Status             string      `json:"status"`
	OverrideUsed       bool        `json:"override_used"`
	CheckedInAt        pgtype.Timestamptz `json:"checked_in_at"`
	CancelledAt        pgtype.Timestamptz `json:"cancelled_at"`
	CreatedAt          pgtype.Timestamptz `json:"created_at"`
	WindowDate         time.Time   `json:"window_date"`
	WindowStartTime    time.Time   `json:"window_start_time"`
	WindowEndTime      time.Time   `json:"window_end_time"`
	AllowedStartFloor  int32       `json:"allowed_start_floor"`
	AllowedEndFloor    int32       `json:"allowed_end_floor"`
}

type CreateSlotReservationParams struct {
	StudentID      pgtype.UUID
	SlotWindowID   pgtype.UUID
	BookedByUserID pgtype.UUID
	OverrideUsed   bool
}

type SlotUtilizationRow struct {
	SlotWindowID      pgtype.UUID `json:"slot_window_id"`
	Date              time.Time   `json:"date"`
	StartTime         time.Time   `json:"start_time"`
	EndTime           time.Time   `json:"end_time"`
	AllowedStartFloor int32       `json:"allowed_start_floor"`
	AllowedEndFloor   int32       `json:"allowed_end_floor"`
	CapacityLimit     int32       `json:"capacity_limit"`
	BookedCount       int64       `json:"booked_count"`
	CheckedInCount    int64       `json:"checked_in_count"`
}

type CreateSlotOverrideParams struct {
	Date           time.Time
	BaseStartFloor int32
	BaseEndFloor   int32
	NextStartFloor int32
	NextEndFloor   int32
	EnabledByUserID pgtype.UUID
	EnabledUntil   time.Time
	Reason         pgtype.Text
}

func (q *Queries) ListEligibleSlotWindowsForStudent(ctx context.Context, date time.Time, floorNo int32, now time.Time) ([]SlotWindowAvailability, error) {
	const query = `
SELECT
  sw.id,
  sw.date,
  sw.start_time,
  sw.end_time,
  sw.allowed_start_floor,
  sw.allowed_end_floor,
  sw.cycle_part,
  sw.capacity_limit,
  sw.day_limit,
  COALESCE(sr.booked_count, 0) AS booked_count,
  EXISTS (
    SELECT 1
    FROM slot_overrides so
    WHERE so.is_active = TRUE
      AND so.date = sw.date
      AND so.base_start_floor = sw.allowed_start_floor
      AND so.base_end_floor = sw.allowed_end_floor
      AND $2 BETWEEN so.next_start_floor AND so.next_end_floor
	AND $3::timestamptz BETWEEN so.enabled_from AND so.enabled_until
  ) AS eligible_via_override
FROM slot_windows sw
LEFT JOIN (
  SELECT slot_window_id, COUNT(*)::bigint AS booked_count
  FROM slot_reservations
  WHERE status IN ('booked', 'checked_in')
  GROUP BY slot_window_id
) sr ON sr.slot_window_id = sw.id
WHERE sw.date = $1::date
  AND (
    $2 BETWEEN sw.allowed_start_floor AND sw.allowed_end_floor
    OR EXISTS (
      SELECT 1
      FROM slot_overrides so
      WHERE so.is_active = TRUE
        AND so.date = sw.date
        AND so.base_start_floor = sw.allowed_start_floor
        AND so.base_end_floor = sw.allowed_end_floor
        AND $2 BETWEEN so.next_start_floor AND so.next_end_floor
		AND $3::timestamptz BETWEEN so.enabled_from AND so.enabled_until
    )
  )
ORDER BY sw.start_time ASC`

	rows, err := q.db.Query(ctx, query, sqlDate(date), floorNo, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SlotWindowAvailability, 0)
	for rows.Next() {
		var s SlotWindowAvailability
		if err := rows.Scan(
			&s.ID,
			&s.Date,
			&s.StartTime,
			&s.EndTime,
			&s.AllowedStartFloor,
			&s.AllowedEndFloor,
			&s.CyclePart,
			&s.CapacityLimit,
			&s.DayLimit,
			&s.BookedCount,
			&s.EligibleViaOverride,
		); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func (q *Queries) CountActiveReservationsInWindow(ctx context.Context, slotWindowID pgtype.UUID) (int64, error) {
	const query = `
SELECT COUNT(*)::bigint
FROM slot_reservations
WHERE slot_window_id = $1
  AND status IN ('booked', 'checked_in')`

	var count int64
	err := q.db.QueryRow(ctx, query, slotWindowID).Scan(&count)
	return count, err
}

func (q *Queries) CountTodayIntakes(ctx context.Context, date time.Time) (int64, error) {
	const query = `
SELECT COUNT(*)::bigint
FROM bookings
WHERE received_at IS NOT NULL
  AND (received_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date`

	var count int64
	err := q.db.QueryRow(ctx, query, sqlDate(date)).Scan(&count)
	return count, err
}

func (q *Queries) CountActiveReservationsForDate(ctx context.Context, date time.Time) (int64, error) {
	const query = `
SELECT COUNT(*)::bigint
FROM slot_reservations sr
JOIN slot_windows sw ON sw.id = sr.slot_window_id
WHERE sw.date = $1::date
  AND sr.status IN ('booked', 'checked_in')`

	var count int64
	err := q.db.QueryRow(ctx, query, sqlDate(date)).Scan(&count)
	return count, err
}

func (q *Queries) CountStudentMonthlyIntakes(ctx context.Context, studentID pgtype.UUID, now time.Time) (int64, error) {
	const query = `
SELECT COUNT(*)::bigint
FROM bookings
WHERE student_id = $1
  AND received_at IS NOT NULL
  AND date_trunc('month', received_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('month', $2::timestamptz AT TIME ZONE 'Asia/Kolkata')`

	var count int64
	err := q.db.QueryRow(ctx, query, studentID, now).Scan(&count)
	return count, err
}

func (q *Queries) GetSlotWindowByID(ctx context.Context, slotWindowID pgtype.UUID) (SlotWindowAvailability, error) {
	const query = `
SELECT
  id,
  date,
  start_time,
  end_time,
  allowed_start_floor,
  allowed_end_floor,
  cycle_part,
  capacity_limit,
  day_limit,
  0::bigint AS booked_count,
  FALSE AS eligible_via_override
FROM slot_windows
WHERE id = $1
LIMIT 1`

	var s SlotWindowAvailability
	err := q.db.QueryRow(ctx, query, slotWindowID).Scan(
		&s.ID,
		&s.Date,
		&s.StartTime,
		&s.EndTime,
		&s.AllowedStartFloor,
		&s.AllowedEndFloor,
		&s.CyclePart,
		&s.CapacityLimit,
		&s.DayLimit,
		&s.BookedCount,
		&s.EligibleViaOverride,
	)
	return s, err
}

func (q *Queries) HasActiveOverrideForFloor(ctx context.Context, date time.Time, baseStartFloor, baseEndFloor, floorNo int32, now time.Time) (bool, error) {
	const query = `
SELECT EXISTS (
  SELECT 1
  FROM slot_overrides
  WHERE is_active = TRUE
		AND date = $1::date
    AND base_start_floor = $2
    AND base_end_floor = $3
    AND $4 BETWEEN next_start_floor AND next_end_floor
	AND $5::timestamptz BETWEEN enabled_from AND enabled_until
)`

	var ok bool
	err := q.db.QueryRow(ctx, query, sqlDate(date), baseStartFloor, baseEndFloor, floorNo, now).Scan(&ok)
	return ok, err
}

func (q *Queries) CreateSlotReservation(ctx context.Context, arg CreateSlotReservationParams) (SlotReservationWithWindow, error) {
	const query = `
INSERT INTO slot_reservations (student_id, slot_window_id, status, override_used, booked_by_user_id)
VALUES ($1, $2, 'booked', $3, $4)
RETURNING id, slot_window_id, student_id, status::text, override_used, checked_in_at, cancelled_at, created_at`

	var r SlotReservationWithWindow
	err := q.db.QueryRow(ctx, query, arg.StudentID, arg.SlotWindowID, arg.OverrideUsed, arg.BookedByUserID).Scan(
		&r.ReservationID,
		&r.SlotWindowID,
		&r.StudentID,
		&r.Status,
		&r.OverrideUsed,
		&r.CheckedInAt,
		&r.CancelledAt,
		&r.CreatedAt,
	)
	return r, err
}

func (q *Queries) GetStudentActiveReservationForDate(ctx context.Context, studentID pgtype.UUID, date time.Time) (SlotReservationWithWindow, error) {
	const query = `
SELECT
  sr.id,
  sr.slot_window_id,
  sr.student_id,
  sr.status::text,
  sr.override_used,
  sr.checked_in_at,
  sr.cancelled_at,
  sr.created_at,
  sw.date,
  sw.start_time,
  sw.end_time,
  sw.allowed_start_floor,
  sw.allowed_end_floor
FROM slot_reservations sr
JOIN slot_windows sw ON sw.id = sr.slot_window_id
WHERE sr.student_id = $1
	AND sw.date = $2::date
  AND sr.status IN ('booked', 'checked_in')
ORDER BY sr.created_at DESC
LIMIT 1`

	var r SlotReservationWithWindow
	err := q.db.QueryRow(ctx, query, studentID, sqlDate(date)).Scan(
		&r.ReservationID,
		&r.SlotWindowID,
		&r.StudentID,
		&r.Status,
		&r.OverrideUsed,
		&r.CheckedInAt,
		&r.CancelledAt,
		&r.CreatedAt,
		&r.WindowDate,
		&r.WindowStartTime,
		&r.WindowEndTime,
		&r.AllowedStartFloor,
		&r.AllowedEndFloor,
	)
	return r, err
}

func (q *Queries) MarkStudentNoShows(ctx context.Context, studentID pgtype.UUID, date time.Time, nowTime time.Time) error {
	const query = `
UPDATE slot_reservations sr
SET status = 'no_show',
    updated_at = NOW()
FROM slot_windows sw
WHERE sw.id = sr.slot_window_id
  AND sr.student_id = $1
  AND sr.status = 'booked'
  AND (
    sw.date < $2::date
    OR (sw.date = $2::date AND sw.end_time <= $3::time)
  )`

	_, err := q.db.Exec(ctx, query, studentID, sqlDate(date), sqlTime(nowTime))
	return err
}

func (q *Queries) MarkReservationCheckedIn(ctx context.Context, reservationID pgtype.UUID, checkedInAt time.Time) error {
	const query = `
UPDATE slot_reservations
SET status = 'checked_in',
    checked_in_at = COALESCE(checked_in_at, $2),
    updated_at = NOW()
WHERE id = $1`

	_, err := q.db.Exec(ctx, query, reservationID, checkedInAt)
	return err
}

func (q *Queries) ListStudentSlotReservations(ctx context.Context, studentID pgtype.UUID, limit, offset int32) ([]SlotReservationWithWindow, error) {
	const query = `
SELECT
  sr.id,
  sr.slot_window_id,
  sr.student_id,
  sr.status::text,
  sr.override_used,
  sr.checked_in_at,
  sr.cancelled_at,
  sr.created_at,
  sw.date,
  sw.start_time,
  sw.end_time,
  sw.allowed_start_floor,
  sw.allowed_end_floor
FROM slot_reservations sr
JOIN slot_windows sw ON sw.id = sr.slot_window_id
WHERE sr.student_id = $1
ORDER BY sw.date DESC, sw.start_time DESC
LIMIT $2 OFFSET $3`

	rows, err := q.db.Query(ctx, query, studentID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SlotReservationWithWindow, 0)
	for rows.Next() {
		var r SlotReservationWithWindow
		if err := rows.Scan(
			&r.ReservationID,
			&r.SlotWindowID,
			&r.StudentID,
			&r.Status,
			&r.OverrideUsed,
			&r.CheckedInAt,
			&r.CancelledAt,
			&r.CreatedAt,
			&r.WindowDate,
			&r.WindowStartTime,
			&r.WindowEndTime,
			&r.AllowedStartFloor,
			&r.AllowedEndFloor,
		); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (q *Queries) CancelStudentSlotReservation(ctx context.Context, reservationID, studentID pgtype.UUID, cancelledAt time.Time) error {
	const query = `
UPDATE slot_reservations
SET status = 'cancelled',
    cancelled_at = COALESCE(cancelled_at, $3),
    updated_at = NOW()
WHERE id = $1
  AND student_id = $2
  AND status = 'booked'`

	cmd, err := q.db.Exec(ctx, query, reservationID, studentID, cancelledAt)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (q *Queries) ListSlotUtilizationByDate(ctx context.Context, date time.Time) ([]SlotUtilizationRow, error) {
	const query = `
SELECT
  sw.id,
  sw.date,
  sw.start_time,
  sw.end_time,
  sw.allowed_start_floor,
  sw.allowed_end_floor,
  sw.capacity_limit,
  COALESCE(COUNT(sr.id) FILTER (WHERE sr.status IN ('booked', 'checked_in')), 0)::bigint AS booked_count,
  COALESCE(COUNT(sr.id) FILTER (WHERE sr.status = 'checked_in'), 0)::bigint AS checked_in_count
FROM slot_windows sw
LEFT JOIN slot_reservations sr ON sr.slot_window_id = sw.id
WHERE sw.date = $1::date
GROUP BY sw.id
ORDER BY sw.start_time ASC`

	rows, err := q.db.Query(ctx, query, sqlDate(date))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SlotUtilizationRow, 0)
	for rows.Next() {
		var r SlotUtilizationRow
		if err := rows.Scan(
			&r.SlotWindowID,
			&r.Date,
			&r.StartTime,
			&r.EndTime,
			&r.AllowedStartFloor,
			&r.AllowedEndFloor,
			&r.CapacityLimit,
			&r.BookedCount,
			&r.CheckedInCount,
		); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (q *Queries) CreateSlotOverride(ctx context.Context, arg CreateSlotOverrideParams) (pgtype.UUID, error) {
	const query = `
INSERT INTO slot_overrides (
  date,
  base_start_floor,
  base_end_floor,
  next_start_floor,
  next_end_floor,
  enabled_by_user_id,
  enabled_until,
  reason,
  is_active
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
RETURNING id`

	var id pgtype.UUID
	err := q.db.QueryRow(ctx, query,
		sqlDate(arg.Date),
		arg.BaseStartFloor,
		arg.BaseEndFloor,
		arg.NextStartFloor,
		arg.NextEndFloor,
		arg.EnabledByUserID,
		arg.EnabledUntil,
		arg.Reason,
	).Scan(&id)
	return id, err
}

func (q *Queries) DisableSlotOverride(ctx context.Context, overrideID pgtype.UUID) error {
	const query = `
UPDATE slot_overrides
SET is_active = FALSE
WHERE id = $1`
	_, err := q.db.Exec(ctx, query, overrideID)
	return err
}
