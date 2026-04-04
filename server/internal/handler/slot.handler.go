package handler

import (
	"errors"
	"strings"
	"time"

	dbgen "Frank2006x/washos/internal/repository"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func mapSlotDBError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if pgErr.Code == "42P01" || pgErr.Code == "42703" || pgErr.Code == "42883" {
			return fiber.NewError(fiber.StatusConflict, "slot schedule is not configured")
		}
	}
	return fiber.NewError(fiber.StatusInternalServerError, "failed to validate slot booking")
}

func istLocation() *time.Location {
	return time.FixedZone("IST", 5*3600+1800)
}

func istNow() time.Time {
	return time.Now().In(istLocation())
}

func istDate(t time.Time) time.Time {
	t = t.In(istLocation())
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, istLocation())
}

func parseDateOrTodayIST(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return istDate(istNow()), nil
	}
	dt, err := time.ParseInLocation("2006-01-02", raw, istLocation())
	if err != nil {
		return time.Time{}, fiber.NewError(fiber.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	return istDate(dt), nil
}

func buildSlotWindowBounds(slotDate, startTime, endTime time.Time) (time.Time, time.Time) {
	y, m, d := slotDate.In(istLocation()).Date()
	startAt := time.Date(y, m, d, startTime.Hour(), startTime.Minute(), 0, 0, istLocation())
	endAt := time.Date(y, m, d, endTime.Hour(), endTime.Minute(), 0, 0, istLocation())
	return startAt, endAt
}

func (h *Handler) enforceSlotReservationForIntake(c fiber.Ctx, student dbgen.Student, nowIST time.Time) error {
	if !student.FloorNo.Valid {
		return fiber.NewError(fiber.StatusBadRequest, "student floor is required before intake")
	}

	today := istDate(nowIST)
	if err := h.Queries.MarkStudentNoShows(c.Context(), student.ID, today, nowIST); err != nil {
		return mapSlotDBError(err)
	}

	reservation, err := h.Queries.GetStudentActiveReservationForDate(c.Context(), student.ID, today)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusConflict, "no active slot booking found for today")
	}
	if err != nil {
		return mapSlotDBError(err)
	}

	startAt, endAt := buildSlotWindowBounds(reservation.WindowDate, reservation.WindowStartTime, reservation.WindowEndTime)
	if nowIST.Before(startAt) || !nowIST.Before(endAt) {
		return fiber.NewError(fiber.StatusConflict, "current time is outside booked slot window")
	}

	floorNo := student.FloorNo.Int32
	isDirectlyEligible := floorNo >= reservation.AllowedStartFloor && floorNo <= reservation.AllowedEndFloor
	if !isDirectlyEligible {
		overrideOk, oErr := h.Queries.HasActiveOverrideForFloor(c.Context(), today, reservation.AllowedStartFloor, reservation.AllowedEndFloor, floorNo, nowIST)
		if oErr != nil {
			return mapSlotDBError(oErr)
		}
		if !overrideOk {
			return fiber.NewError(fiber.StatusForbidden, "student floor is not eligible for today's slot")
		}
	}

	monthlyIntakes, err := h.Queries.CountStudentMonthlyIntakes(c.Context(), student.ID, nowIST)
	if err != nil {
		return mapSlotDBError(err)
	}
	if monthlyIntakes >= 4 {
		return fiber.NewError(fiber.StatusConflict, "monthly intake quota reached (4)")
	}

	dailyIntakes, err := h.Queries.CountTodayIntakes(c.Context(), today)
	if err != nil {
		return mapSlotDBError(err)
	}
	if dailyIntakes >= 600 {
		return fiber.NewError(fiber.StatusConflict, "daily intake limit reached")
	}

	if reservation.Status != "checked_in" {
		if err := h.Queries.MarkReservationCheckedIn(c.Context(), reservation.ReservationID, nowIST); err != nil {
			return mapSlotDBError(err)
		}
	}

	return nil
}

// GET /api/student/me/slots/available?date=YYYY-MM-DD
func (h *Handler) ListMyAvailableSlots(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}
	if !student.FloorNo.Valid {
		return fiber.NewError(fiber.StatusBadRequest, "set your floor before viewing slots")
	}

	slotDate, err := parseDateOrTodayIST(c.Query("date"))
	if err != nil {
		return err
	}

	nowIST := istNow()
	windows, err := h.Queries.ListEligibleSlotWindowsForStudent(c.Context(), slotDate, student.FloorNo.Int32, nowIST)
	if err != nil {
		return mapSlotDBError(err)
	}

	dayBooked, err := h.Queries.CountActiveReservationsForDate(c.Context(), slotDate)
	if err != nil {
		return mapSlotDBError(err)
	}

	resp := make([]fiber.Map, 0, len(windows))
	for _, w := range windows {
		startAt, endAt := buildSlotWindowBounds(w.Date, w.StartTime, w.EndTime)
		remaining := int64(w.CapacityLimit) - w.BookedCount
		if remaining < 0 {
			remaining = 0
		}
		resp = append(resp, fiber.Map{
			"slot_window_id":        w.ID,
			"date":                  w.Date,
			"start_at":              startAt,
			"end_at":                endAt,
			"allowed_start_floor":   w.AllowedStartFloor,
			"allowed_end_floor":     w.AllowedEndFloor,
			"cycle_part":            w.CyclePart,
			"capacity_limit":        w.CapacityLimit,
			"booked_count":          w.BookedCount,
			"remaining_capacity":    remaining,
			"eligible_via_override": w.EligibleViaOverride,
		})
	}

	return c.JSON(fiber.Map{
		"date":                   slotDate,
		"floor_no":               student.FloorNo.Int32,
		"daily_booking_limit":    600,
		"daily_booked_reservations": dayBooked,
		"slots":                  resp,
	})
}

// POST /api/student/me/slots/book
func (h *Handler) BookMySlot(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}
	if !student.FloorNo.Valid {
		return fiber.NewError(fiber.StatusBadRequest, "set your floor before booking slots")
	}

	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	var body struct {
		SlotWindowID string `json:"slot_window_id"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.SlotWindowID = strings.TrimSpace(body.SlotWindowID)
	if body.SlotWindowID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "slot_window_id is required")
	}

	var slotWindowID pgtype.UUID
	if err := slotWindowID.Scan(body.SlotWindowID); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid slot_window_id")
	}

	nowIST := istNow()
	window, err := h.Queries.GetSlotWindowByID(c.Context(), slotWindowID)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "slot window not found")
	}
	if err != nil {
		return mapSlotDBError(err)
	}

	monthlyIntakes, err := h.Queries.CountStudentMonthlyIntakes(c.Context(), student.ID, nowIST)
	if err != nil {
		return mapSlotDBError(err)
	}
	if monthlyIntakes >= 4 {
		return fiber.NewError(fiber.StatusConflict, "monthly intake quota reached (4)")
	}

	_, activeErr := h.Queries.GetStudentActiveReservationForDate(c.Context(), student.ID, window.Date)
	if activeErr == nil {
		return fiber.NewError(fiber.StatusConflict, "you already have an active slot booking for this date")
	}
	if activeErr != nil && activeErr != pgx.ErrNoRows {
		return mapSlotDBError(activeErr)
	}

	floorNo := student.FloorNo.Int32
	overrideUsed := false
	isDirectlyEligible := floorNo >= window.AllowedStartFloor && floorNo <= window.AllowedEndFloor
	if !isDirectlyEligible {
		overrideOK, oErr := h.Queries.HasActiveOverrideForFloor(c.Context(), window.Date, window.AllowedStartFloor, window.AllowedEndFloor, floorNo, nowIST)
		if oErr != nil {
			return mapSlotDBError(oErr)
		}
		if !overrideOK {
			return fiber.NewError(fiber.StatusForbidden, "your floor is not eligible for this slot")
		}
		overrideUsed = true
	}

	bookedInWindow, err := h.Queries.CountActiveReservationsInWindow(c.Context(), window.ID)
	if err != nil {
		return mapSlotDBError(err)
	}
	if bookedInWindow >= int64(window.CapacityLimit) {
		return fiber.NewError(fiber.StatusConflict, "slot capacity reached")
	}

	dayBooked, err := h.Queries.CountActiveReservationsForDate(c.Context(), window.Date)
	if err != nil {
		return mapSlotDBError(err)
	}
	if dayBooked >= int64(window.DayLimit) {
		return fiber.NewError(fiber.StatusConflict, "daily slot booking limit reached")
	}

	reservation, err := h.Queries.CreateSlotReservation(c.Context(), dbgen.CreateSlotReservationParams{
		StudentID:      student.ID,
		SlotWindowID:   window.ID,
		BookedByUserID: userID,
		OverrideUsed:   overrideUsed,
	})
	if err != nil {
		return mapSlotDBError(err)
	}

	startAt, endAt := buildSlotWindowBounds(window.Date, window.StartTime, window.EndTime)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"reservation_id": reservation.ReservationID,
		"status":         reservation.Status,
		"slot": fiber.Map{
			"slot_window_id":      window.ID,
			"date":                window.Date,
			"start_at":            startAt,
			"end_at":              endAt,
			"allowed_start_floor": window.AllowedStartFloor,
			"allowed_end_floor":   window.AllowedEndFloor,
			"override_used":       overrideUsed,
		},
	})
}

// GET /api/student/me/slots/bookings
func (h *Handler) ListMySlotBookings(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	items, err := h.Queries.ListStudentSlotReservations(c.Context(), student.ID, limit, offset)
	if err != nil {
		return mapSlotDBError(err)
	}

	resp := make([]fiber.Map, 0, len(items))
	for _, it := range items {
		startAt, endAt := buildSlotWindowBounds(it.WindowDate, it.WindowStartTime, it.WindowEndTime)
		resp = append(resp, fiber.Map{
			"reservation_id":      it.ReservationID,
			"slot_window_id":      it.SlotWindowID,
			"status":              it.Status,
			"override_used":       it.OverrideUsed,
			"checked_in_at":       it.CheckedInAt,
			"cancelled_at":        it.CancelledAt,
			"created_at":          it.CreatedAt,
			"date":                it.WindowDate,
			"start_at":            startAt,
			"end_at":              endAt,
			"allowed_start_floor": it.AllowedStartFloor,
			"allowed_end_floor":   it.AllowedEndFloor,
		})
	}

	return c.JSON(fiber.Map{"reservations": resp})
}

// POST /api/student/me/slots/:id/cancel
func (h *Handler) CancelMySlotBooking(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	reservationIDStr := strings.TrimSpace(c.Params("id"))
	if reservationIDStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "reservation id is required")
	}

	var reservationID pgtype.UUID
	if err := reservationID.Scan(reservationIDStr); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid reservation id")
	}

	if err := h.Queries.CancelStudentSlotReservation(c.Context(), reservationID, student.ID, istNow()); err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "active slot booking not found")
	} else if err != nil {
		return mapSlotDBError(err)
	}

	return c.JSON(fiber.Map{"message": "slot booking cancelled"})
}

// GET /api/staff/slots/utilization?date=YYYY-MM-DD
func (h *Handler) StaffSlotUtilization(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	slotDate, err := parseDateOrTodayIST(c.Query("date"))
	if err != nil {
		return err
	}

	items, err := h.Queries.ListSlotUtilizationByDate(c.Context(), slotDate)
	if err != nil {
		return mapSlotDBError(err)
	}

	dailyIntakes, err := h.Queries.CountTodayIntakes(c.Context(), slotDate)
	if err != nil {
		return mapSlotDBError(err)
	}

	resp := make([]fiber.Map, 0, len(items))
	for _, it := range items {
		startAt, endAt := buildSlotWindowBounds(it.Date, it.StartTime, it.EndTime)
		resp = append(resp, fiber.Map{
			"slot_window_id":      it.SlotWindowID,
			"date":                it.Date,
			"start_at":            startAt,
			"end_at":              endAt,
			"allowed_start_floor": it.AllowedStartFloor,
			"allowed_end_floor":   it.AllowedEndFloor,
			"capacity_limit":      it.CapacityLimit,
			"booked_count":        it.BookedCount,
			"checked_in_count":    it.CheckedInCount,
		})
	}

	return c.JSON(fiber.Map{
		"date":               slotDate,
		"daily_intake_limit": 600,
		"daily_intakes":      dailyIntakes,
		"slots":              resp,
	})
}

// POST /api/staff/slots/override
func (h *Handler) CreateStaffSlotOverride(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		Date           string `json:"date"`
		BaseStartFloor int32  `json:"base_start_floor"`
		BaseEndFloor   int32  `json:"base_end_floor"`
		NextStartFloor int32  `json:"next_start_floor"`
		NextEndFloor   int32  `json:"next_end_floor"`
		EnabledUntil   string `json:"enabled_until"`
		Reason         string `json:"reason"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	slotDate, err := parseDateOrTodayIST(body.Date)
	if err != nil {
		return err
	}
	if body.BaseStartFloor > body.BaseEndFloor || body.NextStartFloor > body.NextEndFloor {
		return fiber.NewError(fiber.StatusBadRequest, "invalid floor ranges")
	}

	enabledUntil := time.Date(slotDate.Year(), slotDate.Month(), slotDate.Day(), 23, 59, 59, 0, istLocation())
	if strings.TrimSpace(body.EnabledUntil) != "" {
		t, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(body.EnabledUntil))
		if parseErr != nil {
			return fiber.NewError(fiber.StatusBadRequest, "enabled_until must be RFC3339")
		}
		enabledUntil = t.In(istLocation())
	}

	overrideID, err := h.Queries.CreateSlotOverride(c.Context(), dbgen.CreateSlotOverrideParams{
		Date:            slotDate,
		BaseStartFloor:  body.BaseStartFloor,
		BaseEndFloor:    body.BaseEndFloor,
		NextStartFloor:  body.NextStartFloor,
		NextEndFloor:    body.NextEndFloor,
		EnabledByUserID: actorUserID,
		EnabledUntil:    enabledUntil,
		Reason:          pgtype.Text{String: strings.TrimSpace(body.Reason), Valid: strings.TrimSpace(body.Reason) != ""},
	})
	if err != nil {
		return mapSlotDBError(err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"override_id": overrideID})
}

// DELETE /api/staff/slots/override/:id
func (h *Handler) DisableStaffSlotOverride(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	overrideIDStr := strings.TrimSpace(c.Params("id"))
	if overrideIDStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "override id is required")
	}

	var overrideID pgtype.UUID
	if err := overrideID.Scan(overrideIDStr); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid override id")
	}

	if err := h.Queries.DisableSlotOverride(c.Context(), overrideID); err != nil {
		return mapSlotDBError(err)
	}

	return c.JSON(fiber.Map{"message": "slot override disabled"})
}
