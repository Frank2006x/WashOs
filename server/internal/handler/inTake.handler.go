package handler

import (
	"encoding/json"
	"fmt"
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
