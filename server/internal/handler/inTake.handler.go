package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
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

	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         bookingID,
		BagID:             bagID,
		StudentID:         studentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeActionRejected,
		Metadata:          metaBytes,
	}, "action_rejected")
}

func (h *Handler) createWorkflowEventWithLog(c fiber.Ctx, params dbgen.CreateWorkflowEventParams, source string) {
	if _, err := h.Queries.CreateWorkflowEvent(c.Context(), params); err != nil {
		log.Printf(
			"create workflow event failed: source=%s event_type=%s booking_id=%s bag_id=%s student_id=%s err=%v",
			source,
			params.EventType,
			pgUUIDToStr(params.BookingID),
			pgUUIDToStr(params.BagID),
			pgUUIDToStr(params.StudentID),
			err,
		)
	}
}

func parseJSONBytes(raw []byte) map[string]interface{} {
	if len(raw) == 0 {
		return map[string]interface{}{}
	}

	decoded := map[string]interface{}{}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return map[string]interface{}{"raw": string(raw)}
	}
	return decoded
}

func notificationResponse(n dbgen.Notification) fiber.Map {
	return fiber.Map{
		"id":                n.ID,
		"recipient_user_id": n.RecipientUserID,
		"booking_id":        n.BookingID,
		"title":             n.Title,
		"message":           n.Message,
		"payload":           parseJSONBytes(n.Payload),
		"is_read":           n.IsRead,
		"read_at":           n.ReadAt,
		"sent_at":           n.SentAt,
		"created_at":        n.CreatedAt,
	}
}

func (h *Handler) sendExpoPush(token, title, message string, data map[string]interface{}) {
	token = strings.TrimSpace(token)
	if token == "" || !strings.HasPrefix(token, "ExponentPushToken[") {
		return
	}

	payload := map[string]interface{}{
		"to":    token,
		"title": title,
		"body":  message,
		"sound": "default",
		"data":  data,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("push payload marshal failed: token=%s err=%v", token, err)
		return
	}

	pushURL := strings.TrimSpace(os.Getenv("EXPO_PUSH_API_URL"))
	if pushURL == "" {
		pushURL = "https://exp.host/--/api/v2/push/send"
	}

	resp, err := http.Post(pushURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("push send failed: token=%s err=%v", token, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("push send non-2xx: token=%s status=%d", token, resp.StatusCode)
	}
}

func (h *Handler) dispatchReadyNotification(c fiber.Ctx, booking dbgen.Booking, rowNo string, source string) {
	student, sErr := h.Queries.GetStudentByID(c.Context(), booking.StudentID)
	if sErr != nil {
		log.Printf("[DEBUG] READY_NOTIF: student lookup failed for studentID=%s bookingID=%s: %v", pgUUIDToStr(booking.StudentID), pgUUIDToStr(booking.ID), sErr)
		return
	}

	payloadMap := map[string]interface{}{
		"booking_id": pgUUIDToStr(booking.ID),
		"status":     string(booking.Status),
		"row_no":     rowNo,
	}
	payload, _ := json.Marshal(payloadMap)

	log.Printf("[DEBUG] READY_NOTIF: Creating notification for userID=%s bookingID=%s payload=%s", pgUUIDToStr(student.UserID), pgUUIDToStr(booking.ID), string(payload))

	_, nErr := h.Queries.CreateNotification(c.Context(), dbgen.CreateNotificationParams{
		RecipientUserID: student.UserID,
		BookingID:       pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		Title:           "Laundry Ready for Pickup",
		Message:         "Your laundry is ready for pickup.",
		Payload:         payload,
	})
	if nErr != nil {
		log.Printf("[DEBUG] READY_NOTIF: CreateNotification failed: %v", nErr)
		return
	}
	log.Printf("[DEBUG] READY_NOTIF: Notification created successfully for bookingID=%s", pgUUIDToStr(booking.ID))

	pushTokens, pErr := h.Queries.ListActivePushTokensByUser(c.Context(), student.UserID)
	if pErr != nil {
		log.Printf("list push tokens failed: source=%s booking=%s student_user=%s err=%v", source, pgUUIDToStr(booking.ID), pgUUIDToStr(student.UserID), pErr)
		return
	}

	for _, pushToken := range pushTokens {
		h.sendExpoPush(pushToken.Token, "Laundry Ready for Pickup", "Your laundry is ready for pickup.", payloadMap)
	}
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
			h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
				BookingID:         pgtype.UUID{Bytes: activeBooking.ID.Bytes, Valid: true},
				BagID:             bag.ID,
				StudentID:         student.ID,
				TriggeredByUserID: actorUserID,
				TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
				EventType:         dbgen.WorkflowEventTypeReceived,
				Metadata:          metadata,
			}, "intake_scan_idempotent")

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

	if err := h.enforceSlotReservationForIntake(c, student, istNow()); err != nil {
		return err
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
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             bag.ID,
		StudentID:         student.ID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeReceived,
		Metadata:          metadata,
	}, "intake_scan")

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
		h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
			BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			BagID:             bag.ID,
			StudentID:         student.ID,
			TriggeredByUserID: actorUserID,
			TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
			EventType:         dbgen.WorkflowEventTypeWashFinished,
			Metadata:          metadata,
		}, "wash_complete_scan")

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
		h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
			BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			BagID:             bag.ID,
			StudentID:         student.ID,
			TriggeredByUserID: actorUserID,
			TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
			EventType:         dbgen.WorkflowEventTypeWashFinished,
			Metadata:          metadata,
		}, "wash_complete_scan_idempotent")

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

func (h *Handler) resolveMachineForStaff(c fiber.Ctx, staff dbgen.LaundryStaff, machineIDStr string, expectedType dbgen.MachineType) (dbgen.Machine, error) {
	machineIDStr = strings.TrimSpace(machineIDStr)
	if machineIDStr == "" {
		return dbgen.Machine{}, fiber.NewError(fiber.StatusBadRequest, "machine_id is required")
	}

	var machineID pgtype.UUID
	if err := machineID.Scan(machineIDStr); err != nil {
		return dbgen.Machine{}, fiber.NewError(fiber.StatusBadRequest, "invalid machine id")
	}

	machine, err := h.Queries.GetMachineByID(c.Context(), machineID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return dbgen.Machine{}, fiber.NewError(fiber.StatusNotFound, "machine not found")
		}
		return dbgen.Machine{}, fiber.NewError(fiber.StatusInternalServerError, "failed to fetch machine")
	}

	if !machine.IsActive {
		return dbgen.Machine{}, fiber.NewError(fiber.StatusConflict, "machine is not active")
	}

	if machine.MachineType != expectedType {
		return dbgen.Machine{}, fiber.NewError(fiber.StatusBadRequest, "machine type does not match selected phase")
	}

	if pgUUIDToStr(machine.LaundryServiceID) != pgUUIDToStr(staff.LaundryServiceID) {
		return dbgen.Machine{}, fiber.NewError(fiber.StatusForbidden, "machine does not belong to your laundry service")
	}

	return machine, nil
}

// GET /api/machines?type=washer|dryer
func (h *Handler) ListMachines(c fiber.Ctx) error {
	staff, _, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	typeStr := strings.ToLower(strings.TrimSpace(c.Query("type")))
	var machineType dbgen.MachineType
	switch typeStr {
	case "washer":
		machineType = dbgen.MachineTypeWasher
	case "dryer":
		machineType = dbgen.MachineTypeDryer
	default:
		return fiber.NewError(fiber.StatusBadRequest, "type must be washer or dryer")
	}

	machines, err := h.Queries.ListMachinesByType(c.Context(), machineType)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list machines")
	}

	filtered := make([]dbgen.Machine, 0, len(machines))
	for _, m := range machines {
		if pgUUIDToStr(m.LaundryServiceID) == pgUUIDToStr(staff.LaundryServiceID) {
			filtered = append(filtered, m)
		}
	}

	return c.JSON(fiber.Map{"machines": filtered})
}

// POST /api/scan/wash-start
func (h *Handler) WashStartScan(c fiber.Ctx) error {
	staff, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode   string `json:"qr_code"`
		MachineID string `json:"machine_id"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}

	machine, err := h.resolveMachineForStaff(c, staff, body.MachineID, dbgen.MachineTypeWasher)
	if err != nil {
		return err
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

	if booking.Status != dbgen.BookingStatusDroppedOff {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking must be dropped_off before wash start", "booking": booking})
	}

	if _, runErr := h.Queries.GetRunningMachineRunByMachineID(c.Context(), machine.ID); runErr == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "selected machine is busy"})
	} else if runErr != pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to check machine availability")
	}

	booking, err = h.Queries.SetBookingWashing(c.Context(), dbgen.SetBookingWashingParams{
		ID:              booking.ID,
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking washing")
	}

	_, err = h.Queries.CreateMachineRun(c.Context(), dbgen.CreateMachineRunParams{
		BookingID:        booking.ID,
		BagID:            bag.ID,
		MachineID:        machine.ID,
		MachineType:      dbgen.MachineTypeWasher,
		StartedByUserID:  pgtype.UUID{Bytes: actorUserID.Bytes, Valid: true},
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create wash machine run")
	}

	metadata, _ := json.Marshal(map[string]interface{}{"source": "scan_wash_start", "qr_version": version, "machine_code": machine.Code})
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             bag.ID,
		StudentID:         student.ID,
		MachineID:         pgtype.UUID{Bytes: machine.ID.Bytes, Valid: true},
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeWashStarted,
		Metadata:          metadata,
	}, "wash_start_scan")

	return c.JSON(fiber.Map{"message": "wash started", "booking": booking, "machine": machine})
}

// POST /api/scan/wash-finish
func (h *Handler) WashFinishScan(c fiber.Ctx) error {
	staff, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode    string `json:"qr_code"`
		MachineID string `json:"machine_id"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}

	machine, err := h.resolveMachineForStaff(c, staff, body.MachineID, dbgen.MachineTypeWasher)
	if err != nil {
		return err
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

	if booking.Status != dbgen.BookingStatusWashing {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking must be washing before wash finish", "booking": booking})
	}

	run, runErr := h.Queries.GetRunningMachineRunByMachineID(c.Context(), machine.ID)
	if runErr == pgx.ErrNoRows {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "no running wash found on selected machine"})
	}
	if runErr != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch running machine run")
	}

	if pgUUIDToStr(run.BookingID) != pgUUIDToStr(booking.ID) || pgUUIDToStr(run.BagID) != pgUUIDToStr(bag.ID) || run.MachineType != dbgen.MachineTypeWasher {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "selected machine is not running this bag wash"})
	}

	_, err = h.Queries.FinishMachineRun(c.Context(), dbgen.FinishMachineRunParams{
		ID:            run.ID,
		EndedByUserID: pgtype.UUID{Bytes: actorUserID.Bytes, Valid: true},
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to finish wash machine run")
	}

	booking, err = h.Queries.SetBookingWashDone(c.Context(), dbgen.SetBookingWashDoneParams{
		ID:              booking.ID,
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking wash_done")
	}

	metadata, _ := json.Marshal(map[string]interface{}{"source": "scan_wash_finish", "qr_version": version, "machine_code": machine.Code})
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             bag.ID,
		StudentID:         student.ID,
		MachineID:         pgtype.UUID{Bytes: machine.ID.Bytes, Valid: true},
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeWashFinished,
		Metadata:          metadata,
	}, "wash_finish_scan")

	return c.JSON(fiber.Map{"message": "wash finished", "booking": booking, "machine": machine})
}

// POST /api/scan/dry-start
func (h *Handler) DryStartScan(c fiber.Ctx) error {
	staff, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode    string `json:"qr_code"`
		MachineID string `json:"machine_id"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}

	machine, err := h.resolveMachineForStaff(c, staff, body.MachineID, dbgen.MachineTypeDryer)
	if err != nil {
		return err
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

	if booking.Status != dbgen.BookingStatusWashDone {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking must be wash_done before dry start", "booking": booking})
	}

	if _, runErr := h.Queries.GetRunningMachineRunByMachineID(c.Context(), machine.ID); runErr == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "selected machine is busy"})
	} else if runErr != pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to check machine availability")
	}

	booking, err = h.Queries.SetBookingDrying(c.Context(), dbgen.SetBookingDryingParams{
		ID:              booking.ID,
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking drying")
	}

	_, err = h.Queries.CreateMachineRun(c.Context(), dbgen.CreateMachineRunParams{
		BookingID:       booking.ID,
		BagID:           bag.ID,
		MachineID:       machine.ID,
		MachineType:     dbgen.MachineTypeDryer,
		StartedByUserID: pgtype.UUID{Bytes: actorUserID.Bytes, Valid: true},
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create dry machine run")
	}

	metadata, _ := json.Marshal(map[string]interface{}{"source": "scan_dry_start", "qr_version": version, "machine_code": machine.Code})
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             bag.ID,
		StudentID:         student.ID,
		MachineID:         pgtype.UUID{Bytes: machine.ID.Bytes, Valid: true},
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeDryStarted,
		Metadata:          metadata,
	}, "dry_start_scan")

	return c.JSON(fiber.Map{"message": "dry started", "booking": booking, "machine": machine})
}

// POST /api/scan/dry-finish
func (h *Handler) DryFinishScan(c fiber.Ctx) error {
	staff, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode    string `json:"qr_code"`
		MachineID string `json:"machine_id"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}

	machine, err := h.resolveMachineForStaff(c, staff, body.MachineID, dbgen.MachineTypeDryer)
	if err != nil {
		return err
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

	if booking.Status != dbgen.BookingStatusDrying {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking must be drying before dry finish", "booking": booking})
	}

	run, runErr := h.Queries.GetRunningMachineRunByMachineID(c.Context(), machine.ID)
	if runErr == pgx.ErrNoRows {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "no running dry found on selected machine"})
	}
	if runErr != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch running machine run")
	}

	if pgUUIDToStr(run.BookingID) != pgUUIDToStr(booking.ID) || pgUUIDToStr(run.BagID) != pgUUIDToStr(bag.ID) || run.MachineType != dbgen.MachineTypeDryer {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "selected machine is not running this bag dry cycle"})
	}

	_, err = h.Queries.FinishMachineRun(c.Context(), dbgen.FinishMachineRunParams{
		ID:            run.ID,
		EndedByUserID: pgtype.UUID{Bytes: actorUserID.Bytes, Valid: true},
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to finish dry machine run")
	}

	booking, err = h.Queries.SetBookingDryDone(c.Context(), dbgen.SetBookingDryDoneParams{
		ID:              booking.ID,
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking dry_done")
	}

	metadata, _ := json.Marshal(map[string]interface{}{"source": "scan_dry_finish", "qr_version": version, "machine_code": machine.Code})
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             bag.ID,
		StudentID:         student.ID,
		MachineID:         pgtype.UUID{Bytes: machine.ID.Bytes, Valid: true},
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeDryFinished,
		Metadata:          metadata,
	}, "dry_finish_scan")

	return c.JSON(fiber.Map{"message": "dry finished", "booking": booking, "machine": machine})
}

// POST /api/scan/ready
func (h *Handler) ReadyScan(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	var body struct {
		QRCode string `json:"qr_code"`
		RowNo  string `json:"row_no"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.QRCode = strings.TrimSpace(body.QRCode)
	body.RowNo = strings.TrimSpace(body.RowNo)
	if body.QRCode == "" {
		return fiber.NewError(fiber.StatusBadRequest, "qr_code is required")
	}
	if body.RowNo == "" {
		return fiber.NewError(fiber.StatusBadRequest, "row_no is required")
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

	if booking.Status != dbgen.BookingStatusDryDone {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking must be dry_done before ready scan", "booking": booking})
	}

	booking, err = h.Queries.SetBookingReady(c.Context(), dbgen.SetBookingReadyParams{
		ID:              booking.ID,
		RowNo:           pgtype.Text{String: body.RowNo, Valid: true},
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking ready")
	}

	metadata, _ := json.Marshal(map[string]interface{}{"source": "scan_ready", "qr_version": version, "row_no": body.RowNo})
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             bag.ID,
		StudentID:         student.ID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeMarkedReady,
		Metadata:          metadata,
	}, "ready_scan")

	h.dispatchReadyNotification(c, booking, body.RowNo, "ready_scan")

	return c.JSON(fiber.Map{"message": "booking marked ready_for_pickup", "booking": booking})
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

// GET /api/bookings/my
func (h *Handler) ListMyBookings(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	bookings, err := h.Queries.GetStudentBookings(c.Context(), dbgen.GetStudentBookingsParams{
		StudentID: student.ID,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list student bookings")
	}
	if bookings == nil {
		bookings = []dbgen.Booking{}
	}

	return c.JSON(fiber.Map{"bookings": bookings})
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

// GET /api/bookings/:id/events
func (h *Handler) GetBookingEvents(c fiber.Ctx) error {
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

	if _, _, err := h.requireStaff(c); err != nil {
		student, sErr := h.requireStudent(c)
		if sErr != nil {
			return fiber.NewError(fiber.StatusForbidden, "not allowed to access this booking")
		}
		if pgUUIDToStr(booking.StudentID) != pgUUIDToStr(student.ID) {
			return fiber.NewError(fiber.StatusForbidden, "not allowed to access this booking")
		}
	}

	events, err := h.Queries.GetBookingWorkflowEvents(c.Context(), bookingID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch booking events")
	}
	if events == nil {
		events = []dbgen.WorkflowEvent{}
	}

	eventResponses := make([]fiber.Map, 0, len(events))
	for _, ev := range events {
		metadata := map[string]interface{}{}
		if len(ev.Metadata) > 0 {
			if err := json.Unmarshal(ev.Metadata, &metadata); err != nil {
				metadata = map[string]interface{}{"raw": string(ev.Metadata)}
			}
		}

		eventResponses = append(eventResponses, fiber.Map{
			"id":                   ev.ID,
			"booking_id":           ev.BookingID,
			"bag_id":               ev.BagID,
			"student_id":           ev.StudentID,
			"machine_id":           ev.MachineID,
			"triggered_by_user_id": ev.TriggeredByUserID,
			"triggered_role":       ev.TriggeredRole,
			"event_type":           ev.EventType,
			"metadata":             metadata,
			"created_at":           ev.CreatedAt,
		})
	}

	return c.JSON(fiber.Map{"events": eventResponses})
}

// POST /api/bookings/:id/wash-complete
func (h *Handler) MarkBookingWashComplete(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
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

	switch booking.Status {
	case dbgen.BookingStatusDroppedOff, dbgen.BookingStatusWashing:
		booking, err = h.Queries.SetBookingWashDone(c.Context(), dbgen.SetBookingWashDoneParams{
			ID:              booking.ID,
			LastActorUserID: actorUserID,
		})
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking wash_done")
		}

		metadata, _ := json.Marshal(map[string]interface{}{"source": "booking_action"})
		h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
			BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			BagID:             booking.BagID,
			StudentID:         booking.StudentID,
			TriggeredByUserID: actorUserID,
			TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
			EventType:         dbgen.WorkflowEventTypeWashFinished,
			Metadata:          metadata,
		}, "mark_booking_wash_complete")

		return c.JSON(fiber.Map{"message": "booking marked wash_done", "booking": booking})
	case dbgen.BookingStatusWashDone, dbgen.BookingStatusDrying, dbgen.BookingStatusDryDone, dbgen.BookingStatusReadyForPickup, dbgen.BookingStatusCollected:
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking already past wash completion stage", "booking": booking})
	default:
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking is not in washable stage", "booking": booking})
	}
}

// POST /api/bookings/:id/ready
func (h *Handler) MarkBookingReady(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
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

	var body struct {
		RowNo string `json:"row_no"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.RowNo = strings.TrimSpace(body.RowNo)
	if body.RowNo == "" {
		return fiber.NewError(fiber.StatusBadRequest, "row_no is required")
	}

	booking, err := h.Queries.GetBookingByID(c.Context(), bookingID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "booking not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch booking")
	}

	if booking.Status != dbgen.BookingStatusWashDone && booking.Status != dbgen.BookingStatusDryDone {
		if booking.Status == dbgen.BookingStatusReadyForPickup {
			return c.JSON(fiber.Map{"message": "booking already ready", "booking": booking})
		}
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "booking must be wash_done or dry_done before marking ready", "booking": booking})
	}

	booking, err = h.Queries.SetBookingReady(c.Context(), dbgen.SetBookingReadyParams{
		ID:              booking.ID,
		RowNo:           pgtype.Text{String: body.RowNo, Valid: true},
		LastActorUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark booking ready")
	}

	metadata, _ := json.Marshal(map[string]interface{}{"source": "booking_action", "row_no": body.RowNo})
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             booking.BagID,
		StudentID:         booking.StudentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleLaundryStaff, Valid: true},
		EventType:         dbgen.WorkflowEventTypeMarkedReady,
		Metadata:          metadata,
	}, "mark_booking_ready")

	h.dispatchReadyNotification(c, booking, body.RowNo, "mark_booking_ready")

	return c.JSON(fiber.Map{"message": "booking marked ready_for_pickup", "booking": booking})
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
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             booking.BagID,
		StudentID:         booking.StudentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
		EventType:         dbgen.WorkflowEventTypeActionRejected,
		Metadata:          metadata,
	}, "pickup_verify_scan")

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
		h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
			BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
			BagID:             booking.BagID,
			StudentID:         booking.StudentID,
			TriggeredByUserID: actorUserID,
			TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
			EventType:         dbgen.WorkflowEventTypeCollected,
			Metadata:          metadata,
		}, "collect_booking_idempotent")

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
	h.createWorkflowEventWithLog(c, dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             booking.BagID,
		StudentID:         booking.StudentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
		EventType:         dbgen.WorkflowEventTypeCollected,
		Metadata:          metadata,
	}, "collect_booking")

	return c.JSON(fiber.Map{
		"message": "booking collected",
		"booking": booking,
	})
}

// GET /api/notifications/my/unread
func (h *Handler) ListMyNotifications(c fiber.Ctx) error {
	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	notifications, err := h.Queries.ListNotificationsByUser(c.Context(), dbgen.ListNotificationsByUserParams{
		RecipientUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list notifications")
	}
	if notifications == nil {
		notifications = []dbgen.Notification{}
	}

	response := make([]fiber.Map, 0, len(notifications))
	for _, n := range notifications {
		response = append(response, notificationResponse(n))
	}

	return c.JSON(fiber.Map{"notifications": response})
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

	response := make([]fiber.Map, 0, len(notifications))
	for _, n := range notifications {
		response = append(response, notificationResponse(n))
	}

	return c.JSON(fiber.Map{"notifications": response})
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

	return c.JSON(fiber.Map{"notification": notificationResponse(notification)})
}

// POST /api/notifications/push-token
func (h *Handler) RegisterMyPushToken(c fiber.Ctx) error {
	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	var body struct {
		Token      string `json:"token"`
		Platform   string `json:"platform"`
		DeviceName string `json:"device_name"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	body.Token = strings.TrimSpace(body.Token)
	body.Platform = strings.ToLower(strings.TrimSpace(body.Platform))
	body.DeviceName = strings.TrimSpace(body.DeviceName)

	if body.Token == "" {
		return fiber.NewError(fiber.StatusBadRequest, "token is required")
	}
	if body.Platform != "ios" && body.Platform != "android" && body.Platform != "web" {
		return fiber.NewError(fiber.StatusBadRequest, "platform must be ios, android, or web")
	}

	pushToken, err := h.Queries.UpsertPushToken(c.Context(), dbgen.UpsertPushTokenParams{
		UserID:     userID,
		Token:      body.Token,
		Platform:   body.Platform,
		DeviceName: pgtype.Text{String: body.DeviceName, Valid: body.DeviceName != ""},
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to register push token")
	}

	return c.JSON(fiber.Map{"push_token": pushToken})
}

// DELETE /api/notifications/push-token
func (h *Handler) DeactivateMyPushToken(c fiber.Ctx) error {
	var body struct {
		Token string `json:"token"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.Token = strings.TrimSpace(body.Token)
	if body.Token == "" {
		return fiber.NewError(fiber.StatusBadRequest, "token is required")
	}

	if err := h.Queries.DeactivatePushToken(c.Context(), body.Token); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to deactivate push token")
	}

	return c.JSON(fiber.Map{"message": "push token deactivated"})
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
