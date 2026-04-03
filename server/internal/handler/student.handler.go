package handler

import (
	"fmt"
	"time"

	"Frank2006x/washos/internal/auth"
	dbgen "Frank2006x/washos/internal/repository"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5/pgtype"
)

// BagResponse is returned to the client for all bag/QR endpoints.
type BagResponse struct {
	BagID         string  `json:"bag_id"`
	StudentID     string  `json:"student_id"`
	RegNo         string  `json:"reg_no"`
	Name          string  `json:"name"`
	Block         *string `json:"block,omitempty"`
	QRVersion     int32   `json:"qr_version"`
	QRPayload     string  `json:"qr_payload"` // JSON string to encode into a QR image on client
	IsRevoked     bool    `json:"is_revoked"`
	LastRotatedAt *string `json:"last_rotated_at,omitempty"`
}

func pgUUIDToStr(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	b := u.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// buildQRPayload constructs the tamper-evident JSON string that the client
// encodes into the visible QR image. Built server-side to prevent forgery.
func buildQRPayload(bag dbgen.Bag, student dbgen.Student) string {
	block := ""
	if student.Block.Valid {
		block = student.Block.String
	}
	payload := map[string]interface{}{
		"bag_id":     pgUUIDToStr(bag.ID),
		"student_id": pgUUIDToStr(bag.StudentID),
		"reg_no":     student.RegNo,
		"block":      block,
		"version":    bag.QrVersion,
		"iat":        time.Now().Unix(),
	}
	
	// Create a cryptographic JWT signature so nobody can manually forge a QR containing a bumped version number 
	signedPayload, _ := auth.GenerateQRPayload(payload)
	return signedPayload
}

func (h *Handler) buildBagResponse(bag dbgen.Bag, student dbgen.Student) BagResponse {
	resp := BagResponse{
		BagID:     pgUUIDToStr(bag.ID),
		StudentID: pgUUIDToStr(bag.StudentID),
		RegNo:     student.RegNo,
		Name:      student.Name,
		QRVersion: bag.QrVersion,
		IsRevoked: bag.IsRevoked,
		QRPayload: buildQRPayload(bag, student),
	}
	if student.Block.Valid {
		b := student.Block.String
		resp.Block = &b
	}
	if bag.LastRotatedAt.Valid {
		t := bag.LastRotatedAt.Time.UTC().Format(time.RFC3339)
		resp.LastRotatedAt = &t
	}
	return resp
}

// requireStudent resolves and validates that the JWT user is a student.
// Returns the student row or an error fiber response.
func (h *Handler) requireStudent(c fiber.Ctx) (dbgen.Student, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return dbgen.Student{}, fiber.ErrUnauthorized
	}

	var pgUserID pgtype.UUID
	if err := pgUserID.Scan(userIDStr); err != nil {
		return dbgen.Student{}, fiber.ErrUnauthorized
	}

	// Resolve student profile (includes role check — only students have a students row)
	student, err := h.Queries.GetStudentByUserID(c.Context(), pgUserID)
	if err != nil {
		return dbgen.Student{}, fiber.NewError(fiber.StatusForbidden, "student profile not found")
	}

	return student, nil
}

// GET /api/student/me/bag
// Returns the bag only if it already exists — returns 404 if not yet generated.
func (h *Handler) GetMyBag(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	bag, err := h.Queries.GetStudentBagByStudentID(c.Context(), student.ID)
	if err != nil {
		// No bag yet — client should show "Generate QR" button
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"bag": nil})
	}

	return c.JSON(h.buildBagResponse(bag, student))
}

// POST /api/student/me/bag/init
// Idempotent: creates the bag if it doesn't exist; safe to call again.
func (h *Handler) InitMyBag(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	bag, err := h.Queries.InitStudentBag(c.Context(), student.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to generate QR")
	}

	// Log bag_initialized workflow event (best-effort)
	userIDStr, _ := c.Locals("user_id").(string)
	var pgUserID pgtype.UUID
	_ = pgUserID.Scan(userIDStr)
	_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
		BagID:             bag.ID,
		StudentID:         student.ID,
		TriggeredByUserID: pgUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
		EventType:         dbgen.WorkflowEventTypeBagInitialized,
		Metadata:          []byte(`{}`),
	})

	return c.Status(fiber.StatusCreated).JSON(h.buildBagResponse(bag, student))
}

// POST /api/student/me/bag/rotate
// Rotates the QR version. Rate-limited to once per 60 s.
func (h *Handler) RotateMyBag(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	// Ensure bag exists
	currentBag, err := h.Queries.GetStudentBagByStudentID(c.Context(), student.ID)
	if err != nil {
		currentBag, err = h.Queries.InitStudentBag(c.Context(), student.ID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to init bag")
		}
	}

	// Rate limit: 60 s between rotations
	if currentBag.LastRotatedAt.Valid {
		elapsed := time.Since(currentBag.LastRotatedAt.Time)
		if elapsed < 60*time.Second {
			remaining := int(60 - elapsed.Seconds())
			return fiber.NewError(fiber.StatusTooManyRequests,
				fmt.Sprintf("please wait %ds before rotating again", remaining))
		}
	}

	bag, err := h.Queries.RotateStudentBagQR(c.Context(), student.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to rotate QR")
	}

	// Log the workflow event (best-effort, don't fail the request if it errors)
	userIDStr, _ := c.Locals("user_id").(string)
	var pgUserID pgtype.UUID
	_ = pgUserID.Scan(userIDStr)

	_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
		BagID:             bag.ID,
		StudentID:         student.ID,
		TriggeredByUserID: pgUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: dbgen.UserRoleStudent, Valid: true},
		EventType:         dbgen.WorkflowEventTypeQrRotated,
		Metadata:          []byte(`{}`),
	})

	return c.JSON(h.buildBagResponse(bag, student))
}

// PATCH /api/student/me/block
// Sets or updates the student's hostel block.
// Body: { "block": "A" }
func (h *Handler) UpdateMyBlock(c fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return fiber.ErrUnauthorized
	}

	var pgUserID pgtype.UUID
	if err := pgUserID.Scan(userIDStr); err != nil {
		return fiber.ErrUnauthorized
	}

	var body struct {
		Block string `json:"block"`
	}
	if err := c.Bind().JSON(&body); err != nil || body.Block == "" {
		return fiber.NewError(fiber.StatusBadRequest, "block is required")
	}

	allowed := map[string]bool{
		"A": true, "B": true, "C": true,
		"D1": true, "D2": true, "E": true,
	}
	if !allowed[body.Block] {
		return fiber.NewError(fiber.StatusBadRequest, "invalid block — must be one of A, B, C, D1, D2, E")
	}

	student, err := h.Queries.UpdateStudentBlock(c.Context(), pgUserID, body.Block)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update block")
	}

	return c.JSON(student)
}
