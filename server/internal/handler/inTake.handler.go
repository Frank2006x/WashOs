package handler

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"Frank2006x/washos/internal/auth"
	dbgen "Frank2006x/washos/internal/repository"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type scheduleSlot struct {
	Date        string `json:"date"`
	Day         string `json:"day"`
	DropStart   string `json:"drop_start"`
	DropEnd     string `json:"drop_end"`
	PickupStart string `json:"pickup_start"`
	PickupEnd   string `json:"pickup_end"`
	IsToday     bool   `json:"is_today"`
}

func hasStatus(status dbgen.BookingStatus, allowed ...dbgen.BookingStatus) bool {
	for _, a := range allowed {
		if status == a {
			return true
		}
	}
	return false
}

func (h *Handler) logActionRejected(
	c fiber.Ctx,
	bookingID pgtype.UUID,
	bagID pgtype.UUID,
	studentID pgtype.UUID,
	actorUserID pgtype.UUID,
	action string,
	reason string,
	meta map[string]interface{},
) {
	if meta == nil {
		meta = map[string]interface{}{}
	}
	meta["action"] = action
	meta["reason"] = reason
	metaBytes, _ := json.Marshal(meta)

	_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
		BookingID:         bookingID,
		BagID:             bagID,
		StudentID:         studentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeActionRejected,
		Metadata:          metaBytes,
	})
}

func formatHHMM(minutes int) string {
	h := minutes / 60
	m := minutes % 60
	return fmt.Sprintf("%02d:%02d", h, m)
}

func buildWeeklySchedule(block string, now time.Time, days int) []scheduleSlot {
	offsetByBlock := map[string]int{
		"A": 0,
		"B": 15,
		"C": 30,
		"D1": 45,
		"D2": 60,
		"E": 75,
	}
	offset := offsetByBlock[strings.ToUpper(strings.TrimSpace(block))]

	slots := make([]scheduleSlot, 0, days)
	for i := 0; i < days; i++ {
		d := now.AddDate(0, 0, i)
		if d.Weekday() == time.Sunday {
			continue
		}
		slots = append(slots, scheduleSlot{
			Date:        d.Format("2006-01-02"),
			Day:         d.Weekday().String(),
			DropStart:   formatHHMM(7*60 + offset),
			DropEnd:     formatHHMM(9*60 + offset),
			PickupStart: formatHHMM(18*60 + offset),
			PickupEnd:   formatHHMM(21*60 + offset),
			IsToday:     i == 0,
		})
	}

	return slots
}

func (h *Handler) requireStaff(c fiber.Ctx) (dbgen.LaundryStaff, pgtype.UUID, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return dbgen.LaundryStaff{}, pgtype.UUID{}, fiber.ErrUnauthorized
	}

	var pgUserID pgtype.UUID
	if err := pgUserID.Scan(userIDStr); err != nil {
		return dbgen.LaundryStaff{}, pgtype.UUID{}, fiber.ErrUnauthorized
	}

	staff, err := h.Queries.GetLaundryStaffByUserID(c.Context(), pgUserID)
	if err != nil {
		return dbgen.LaundryStaff{}, pgtype.UUID{}, fiber.NewError(fiber.StatusForbidden, "laundry staff profile not found")
	}

	return staff, pgUserID, nil
}

func parseQRClaims(qrCode string) (string, string, int32, error) {
	claims, err := auth.ParseAndValidateQRPayload(qrCode)
	if err != nil {
		return "", "", 0, err
	}

	bagID, ok := claims["bag_id"].(string)
	if !ok || strings.TrimSpace(bagID) == "" {
		return "", "", 0, fmt.Errorf("invalid qr bag_id")
	}

	studentID, ok := claims["student_id"].(string)
	if !ok || strings.TrimSpace(studentID) == "" {
		return "", "", 0, fmt.Errorf("invalid qr student_id")
	}

	versionRaw, ok := claims["version"]
	if !ok {
		return "", "", 0, fmt.Errorf("invalid qr version")
	}

	versionFloat, ok := versionRaw.(float64)
	if !ok || versionFloat <= 0 {
		return "", "", 0, fmt.Errorf("invalid qr version")
	}

	return bagID, studentID, int32(versionFloat), nil
}

func (h *Handler) fetchValidatedBagFromQR(ctx fiber.Ctx, qrCode string) (dbgen.Bag, dbgen.Student, int32, error) {
	bagIDStr, studentIDStr, version, err := parseQRClaims(strings.TrimSpace(qrCode))
	if err != nil {
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusBadRequest, "invalid qr code")
	}

	var bagID pgtype.UUID
	if err := bagID.Scan(bagIDStr); err != nil {
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusBadRequest, "invalid bag id in qr")
	}

	var studentID pgtype.UUID
	if err := studentID.Scan(studentIDStr); err != nil {
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusBadRequest, "invalid student id in qr")
	}

	bag, err := h.Queries.GetBagByID(ctx.Context(), bagID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusNotFound, "bag not found")
		}
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusInternalServerError, "failed to fetch bag")
	}

	if pgUUIDToStr(bag.StudentID) != studentIDStr {
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusConflict, "qr does not belong to this bag")
	}
	if bag.QrVersion != version {
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusConflict, "qr version is outdated")
	}
	if bag.IsRevoked {
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusConflict, "bag qr is revoked")
	}

	student, err := h.Queries.GetStudentByID(ctx.Context(), studentID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusNotFound, "student not found")
		}
		return dbgen.Bag{}, dbgen.Student{}, 0, fiber.NewError(fiber.StatusInternalServerError, "failed to fetch student")
	}

	return bag, student, version, nil
}

// GET /api/schedules/my
func (h *Handler) GetMySchedule(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	block := ""
	if student.Block.Valid {
		block = student.Block.String
	}

	now := time.Now().In(time.FixedZone("IST", 5*3600+1800))
	return c.JSON(fiber.Map{
		"student_id": pgUUIDToStr(student.ID),
		"block":      block,
		"timezone":   "Asia/Kolkata",
		"slots":      buildWeeklySchedule(block, now, 7),
	})
}

// GET /api/bags/qr/:qrCode
func (h *Handler) GetBagByQRPrecheck(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	qrCode := c.Params("qrCode")
	bag, student, version, err := h.fetchValidatedBagFromQR(c, qrCode)
	if err != nil {
		return err
	}

	activeBooking, bookingErr := h.Queries.GetLatestActiveBookingByBagID(c.Context(), bag.ID)
	hasActiveBooking := bookingErr == nil
	if bookingErr != nil && bookingErr != pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to check active booking")
	}

	studentBlock := ""
	if student.Block.Valid {
		studentBlock = student.Block.String
	}

	resp := fiber.Map{
		"valid":      true,
		"bag_id":     pgUUIDToStr(bag.ID),
		"student_id": pgUUIDToStr(student.ID),
		"reg_no":     student.RegNo,
		"name":       student.Name,
		"block":      studentBlock,
		"qr_version": version,
		"can_intake": !hasActiveBooking,
	}
	if hasActiveBooking {
		resp["active_booking"] = fiber.Map{
			"booking_id": pgUUIDToStr(activeBooking.ID),
			"status":     activeBooking.Status,
		}
	}

	return c.JSON(resp)
}

// POST /api/scan/intake
func (h *Handler) IntakeScan(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode string `json:"qr_code"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}

	bag, student, version, err := h.fetchValidatedBagFromQR(c, body.QRCode)
	if err != nil {
		return err
	}

	activeBooking, activeErr := h.Queries.GetLatestActiveBookingByBagID(c.Context(), bag.ID)
	if activeErr == nil {
		if activeBooking.Status == dbgen.BookingStatusDroppedOff {
			metadata, _ := json.Marshal(map[string]interface{}{
				"source":     "scan_intake",
				"qr_version": version,
				"idempotent": true,
			})
			_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
				BookingID:         pgtype.UUID{Bytes: activeBooking.ID.Bytes, Valid: true},
				BagID:             bag.ID,
				StudentID:         student.ID,
				TriggeredByUserID: actorUserID,
				TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
				EventType:         dbgen.WorkflowEventTypeReceived,
				Metadata:          metadata,
			})

			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"message": "intake already recorded",
				"booking": fiber.Map{
					"booking_id": pgUUIDToStr(activeBooking.ID),
					"status":     activeBooking.Status,
				},
			})
		}

		h.logActionRejected(
			c,
			pgtype.UUID{Bytes: activeBooking.ID.Bytes, Valid: true},
			bag.ID,
			student.ID,
			actorUserID,
			"intake_scan",
			"active_booking_not_dropped_off",
			map[string]interface{}{"status": activeBooking.Status},
		)

		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "active booking already exists for this bag",
			"booking": fiber.Map{
				"booking_id": pgUUIDToStr(activeBooking.ID),
				"status":     activeBooking.Status,
			},
		})
	}
	if activeErr != nil && activeErr != pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to check existing booking")
	}

	booking, err := h.Queries.CreateBooking(c.Context(), dbgen.CreateBookingParams{
		StudentID: student.ID,
		BagID:     bag.ID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create booking")
	}

	booking, err = h.Queries.SetBookingDroppedOff(c.Context(), dbgen.SetBookingDroppedOffParams{
		ID:              booking.ID,
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking dropped_off")
	}

	metadata, _ := json.Marshal(map[string]interface{}{
		"source":     "scan_intake",
		"qr_version": version,
	})
	_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             bag.ID,
		StudentID:         student.ID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeReceived,
		Metadata:          metadata,
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "bag intake recorded",
		"booking": fiber.Map{
			"booking_id": pgUUIDToStr(booking.ID),
			"status":     booking.Status,
			"bag_id":     pgUUIDToStr(bag.ID),
			"student_id": pgUUIDToStr(student.ID),
			"reg_no":     student.RegNo,
			"name":       student.Name,
		},
	})
}

// POST /api/scan/wash-complete
func (h *Handler) WashCompleteScan(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode string `json:"qr_code"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}

	bag, student, version, err := h.fetchValidatedBagFromQR(c, body.QRCode)
	if err != nil {
		return err
	}

	booking, err := h.Queries.GetLatestActiveBookingByBagID(c.Context(), bag.ID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "no active booking found for this bag")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch active booking")
	}

	switch {
	case hasStatus(booking.Status, dbgen.BookingStatusDroppedOff, dbgen.BookingStatusWashing):
		booking, err = h.Queries.SetBookingWashDone(c.Context(), dbgen.SetBookingWashDoneParams{
			ID:              booking.ID,
			LastActorUserID: actorUserID,
		})
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking wash_done")
		}

		metadata, _ := json.Marshal(map[string]interface{}{
			"source":     "scan_wash_complete",
			"qr_version": version,
		})
		_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
			BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			BagID:             bag.ID,
			StudentID:         student.ID,
			TriggeredByUserID: actorUserID,
			TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
			EventType:         dbgen.WorkflowEventTypeWashFinished,
			Metadata:          metadata,
		})

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "bag marked wash_done",
			"booking": booking,
		})

	case hasStatus(booking.Status, dbgen.BookingStatusWashDone, dbgen.BookingStatusDrying, dbgen.BookingStatusDryDone):
		metadata, _ := json.Marshal(map[string]interface{}{
			"source":     "scan_wash_complete",
			"idempotent": true,
			"status":     booking.Status,
		})
		_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
			BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			BagID:             bag.ID,
			StudentID:         student.ID,
			TriggeredByUserID: actorUserID,
			TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
			EventType:         dbgen.WorkflowEventTypeWashFinished,
			Metadata:          metadata,
		})

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "booking already marked as washed",
			"booking": booking,
		})

	case hasStatus(booking.Status, dbgen.BookingStatusReadyForPickup, dbgen.BookingStatusCollected):
		h.logActionRejected(
			c,
			pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			bag.ID,
			student.ID,
			actorUserID,
			"wash_complete_scan",
			"booking_past_wash_stage",
			map[string]interface{}{"status": booking.Status},
		)
		return fiber.NewError(fiber.StatusConflict, "booking already past wash completion stage")

	default:
		h.logActionRejected(
			c,
			pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			bag.ID,
			student.ID,
			actorUserID,
			"wash_complete_scan",
			"booking_not_washable",
			map[string]interface{}{"status": booking.Status},
		)
		return fiber.NewError(fiber.StatusConflict, "booking is not in a washable stage")
	}
}

func parsePagination(c fiber.Ctx) (int32, int32, error) {
	limit := int32(20)
	offset := int32(0)

	if c.Query("limit") != "" {
		parsed, err := strconv.Atoi(c.Query("limit"))
		if err != nil || parsed <= 0 || parsed > 100 {
			return 0, 0, fiber.NewError(fiber.StatusBadRequest, "limit must be between 1 and 100")
		}
		limit = int32(parsed)
	}

	if c.Query("offset") != "" {
		parsed, err := strconv.Atoi(c.Query("offset"))
		if err != nil || parsed < 0 {
			return 0, 0, fiber.NewError(fiber.StatusBadRequest, "offset must be >= 0")
		}
		offset = int32(parsed)
	}

	return limit, offset, nil
}

func currentUserIDFromCtx(c fiber.Ctx) (pgtype.UUID, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || strings.TrimSpace(userIDStr) == "" {
		return pgtype.UUID{}, fiber.ErrUnauthorized
	}

	var userID pgtype.UUID
	if err := userID.Scan(strings.TrimSpace(userIDStr)); err != nil {
		return pgtype.UUID{}, fiber.ErrUnauthorized
	}

	return userID, nil
}

// GET /api/bookings/processing
func (h *Handler) ListProcessingBookings(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	bookings, err := h.Queries.ListProcessingBookings(c.Context(), dbgen.ListProcessingBookingsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list processing bookings")
	}
	if bookings == nil {
		bookings = []dbgen.Booking{}
	}

	return c.JSON(fiber.Map{"bookings": bookings})
}

// GET /api/bookings/ready
func (h *Handler) ListReadyBookings(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	bookings, err := h.Queries.ListReadyBookings(c.Context(), dbgen.ListReadyBookingsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list ready bookings")
	}
	if bookings == nil {
		bookings = []dbgen.Booking{}
	}

	return c.JSON(fiber.Map{"bookings": bookings})
}

// GET /api/bookings/my/active
func (h *Handler) GetMyActiveBooking(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	booking, err := h.Queries.GetLatestActiveBookingByStudentID(c.Context(), student.ID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return c.JSON(fiber.Map{"booking": nil})
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get active booking")
	}

	return c.JSON(fiber.Map{"booking": booking})
}

// GET /api/bookings/:id
func (h *Handler) GetBookingDetails(c fiber.Ctx) error {
	bookingIDStr := strings.TrimSpace(c.Params("id"))
	if bookingIDStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "booking id is required")
	}

	var bookingID pgtype.UUID
	if err := bookingID.Scan(bookingIDStr); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid booking id")
	}

	booking, err := h.Queries.GetBookingByID(c.Context(), bookingID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "booking not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch booking")
	}

	if _, _, err := h.requireStaff(c); err == nil {
		return c.JSON(fiber.Map{"booking": booking})
	}

	student, err := h.requireStudent(c)
	if err != nil {
		return fiber.NewError(fiber.StatusForbidden, "not allowed to access this booking")
	}

	if pgUUIDToStr(booking.StudentID) != pgUUIDToStr(student.ID) {
		return fiber.NewError(fiber.StatusForbidden, "not allowed to access this booking")
	}

	return c.JSON(fiber.Map{"booking": booking})
}

// POST /api/scan/pickup-verify
func (h *Handler) PickupVerifyScan(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}
	actorUserID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode string `json:"qr_code"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}

	bag, _, _, err := h.fetchValidatedBagFromQR(c, body.QRCode)
	if err != nil {
		return err
	}

	if pgUUIDToStr(bag.StudentID) != pgUUIDToStr(student.ID) {
		return fiber.NewError(fiber.StatusForbidden, "bag does not belong to the authenticated student")
	}

	booking, err := h.Queries.GetLatestActiveBookingByBagID(c.Context(), bag.ID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "no active booking found for this bag")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch active booking")
	}

	if booking.Status != dbgen.BookingStatusReadyForPickup {
		h.logActionRejected(
			c,
			pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			bag.ID,
			student.ID,
			actorUserID,
			"pickup_verify_scan",
			"booking_not_ready_for_pickup",
			map[string]interface{}{"status": booking.Status},
		)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":          "booking is not ready for pickup",
			"current_status": booking.Status,
			"booking_id":     pgUUIDToStr(booking.ID),
		})
	}

	metadata, _ := json.Marshal(map[string]interface{}{
		"action":   "pickup_verify_scan",
		"verified": true,
	})
	_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             booking.BagID,
		StudentID:         booking.StudentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
		EventType:         dbgen.WorkflowEventTypeActionRejected,
		Metadata:          metadata,
	})

	return c.JSON(fiber.Map{
		"verified": true,
		"booking":  booking,
	})
}

// POST /api/bookings/:id/collect
func (h *Handler) CollectBooking(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	actorUserID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	bookingIDStr := strings.TrimSpace(c.Params("id"))
	if bookingIDStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "booking id is required")
	}

	var bookingID pgtype.UUID
	if err := bookingID.Scan(bookingIDStr); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid booking id")
	}

	booking, err := h.Queries.GetBookingByID(c.Context(), bookingID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "booking not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch booking")
	}

	if pgUUIDToStr(booking.StudentID) != pgUUIDToStr(student.ID) {
		return fiber.NewError(fiber.StatusForbidden, "not allowed to collect this booking")
	}

	if booking.Status == dbgen.BookingStatusCollected {
		metadata, _ := json.Marshal(map[string]interface{}{
			"action":     "collect_booking",
			"idempotent": true,
		})
		_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
			BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			BagID:             booking.BagID,
			StudentID:         booking.StudentID,
			TriggeredByUserID: actorUserID,
			TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
			EventType:         dbgen.WorkflowEventTypeCollected,
			Metadata:          metadata,
		})

		return c.JSON(fiber.Map{
			"message": "booking already collected",
			"booking": booking,
		})
	}

	if booking.Status != dbgen.BookingStatusReadyForPickup {
		h.logActionRejected(
			c,
			pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			booking.BagID,
			booking.StudentID,
			actorUserID,
			"collect_booking",
			"booking_not_ready_for_pickup",
			map[string]interface{}{"status": booking.Status},
		)

		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":          "booking is not ready for pickup",
			"current_status": booking.Status,
		})
	}

	booking, err = h.Queries.SetBookingCollected(c.Context(), dbgen.SetBookingCollectedParams{
		ID:              booking.ID,
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking collected")
	}

	metadata, _ := json.Marshal(map[string]interface{}{
		"source": "student_collect",
	})
	_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             booking.BagID,
		StudentID:         booking.StudentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
		EventType:         dbgen.WorkflowEventTypeCollected,
		Metadata:          metadata,
	})

	return c.JSON(fiber.Map{
		"message": "booking collected",
		"booking": booking,
	})
}

// GET /api/notifications/my/unread
func (h *Handler) ListMyUnreadNotifications(c fiber.Ctx) error {
	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	notifications, err := h.Queries.ListUnreadNotificationsByUser(c.Context(), dbgen.ListUnreadNotificationsByUserParams{
		RecipientUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list unread notifications")
	}
	if notifications == nil {
		notifications = []dbgen.Notification{}
	}

	return c.JSON(fiber.Map{"notifications": notifications})
}

// PATCH /api/notifications/:id/read
func (h *Handler) MarkMyNotificationRead(c fiber.Ctx) error {
	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	notificationIDStr := strings.TrimSpace(c.Params("id"))
	if notificationIDStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "notification id is required")
	}

	var notificationID pgtype.UUID
	if err := notificationID.Scan(notificationIDStr); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid notification id")
	}

	notification, err := h.Queries.MarkNotificationRead(c.Context(), dbgen.MarkNotificationReadParams{
		ID:              notificationID,
		RecipientUserID: userID,
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "notification not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark notification as read")
	}

	return c.JSON(fiber.Map{"notification": notification})
}

// GET /api/admin/bookings/overview (optional)
func (h *Handler) AdminBookingsOverview(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	rows, err := h.Queries.CountBookingsOverview(c.Context())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to build bookings overview")
	}

	overview := make(map[string]int64, len(rows))
	for _, row := range rows {
		overview[string(row.Status)] = row.Total
	}

	return c.JSON(fiber.Map{"overview": overview})
}

// GET /api/warden/bookings/block/:blockId (optional)
func (h *Handler) WardenBookingsByBlock(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	blockID := strings.TrimSpace(c.Params("blockId"))
	if blockID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "blockId is required")
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	bookings, err := h.Queries.ListBookingsByBlock(c.Context(), dbgen.ListBookingsByBlockParams{
		Upper:  blockID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list bookings by block")
	}
	if bookings == nil {
		bookings = []dbgen.Booking{}
	}

	return c.JSON(fiber.Map{
		"block":    strings.ToUpper(blockID),
		"bookings": bookings,
	})
}
