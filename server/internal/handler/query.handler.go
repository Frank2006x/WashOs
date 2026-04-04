package handler

import (
	"errors"
	"encoding/json"
	"net/url"
	"strconv"
	"strings"

	dbgen "Frank2006x/washos/internal/repository"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func mapQueryDBError(err error, fallback string) error {
	var pgErr *pgconn.PgError
	if !errorAs(err, &pgErr) {
		return fiber.NewError(fiber.StatusInternalServerError, fallback)
	}

	switch pgErr.Code {
	case "42P01":
		return fiber.NewError(fiber.StatusInternalServerError, "database schema is outdated: queries table is missing")
	case "42704":
		return fiber.NewError(fiber.StatusInternalServerError, "database schema is outdated: required enum/type is missing")
	case "23503":
		return fiber.NewError(fiber.StatusConflict, "related booking/student/user row not found")
	case "23514":
		return fiber.NewError(fiber.StatusBadRequest, "query payload failed validation constraints")
	case "22P02":
		return fiber.NewError(fiber.StatusBadRequest, "invalid value format in request")
	default:
		return fiber.NewError(fiber.StatusInternalServerError, fallback)
	}
}

func errorAs(err error, target interface{}) bool {
	// Keep a local wrapper so this file avoids adding broad utility dependencies.
	return errors.As(err, target)
}

func parseUUIDParam(c fiber.Ctx, key string, label string) (pgtype.UUID, error) {
	value := strings.TrimSpace(c.Params(key))
	if value == "" {
		return pgtype.UUID{}, fiber.NewError(fiber.StatusBadRequest, label+" is required")
	}

	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, fiber.NewError(fiber.StatusBadRequest, "invalid "+label)
	}

	return id, nil
}

func validateRatingPtr(v *int, field string) error {
	if v == nil {
		return nil
	}
	if *v < 1 || *v > 5 {
		return fiber.NewError(fiber.StatusBadRequest, field+" must be between 1 and 5")
	}
	return nil
}

func toPGInt4(v *int) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*v), Valid: true}
}

func mergeRating(existing pgtype.Int4, incoming *int) pgtype.Int4 {
	if incoming == nil {
		return existing
	}
	return pgtype.Int4{Int32: int32(*incoming), Valid: true}
}

func validateImageURL(raw string) (pgtype.Text, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return pgtype.Text{}, nil
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return pgtype.Text{}, fiber.NewError(fiber.StatusBadRequest, "image_url must be a valid URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return pgtype.Text{}, fiber.NewError(fiber.StatusBadRequest, "image_url must start with http or https")
	}
	if parsed.Host == "" {
		return pgtype.Text{}, fiber.NewError(fiber.StatusBadRequest, "image_url host is required")
	}

	return pgtype.Text{String: trimmed, Valid: true}, nil
}

func resolveQueryImage(c fiber.Ctx, imageURLRaw string, imageFileProvided bool) (pgtype.Text, error) {
	imageURLRaw = strings.TrimSpace(imageURLRaw)

	if imageURLRaw == "" && !imageFileProvided {
		return pgtype.Text{}, fiber.NewError(fiber.StatusBadRequest, "image_url or image file is required")
	}
	if imageURLRaw != "" && imageFileProvided {
		return pgtype.Text{}, fiber.NewError(fiber.StatusBadRequest, "provide either image_url or image file, not both")
	}

	if imageFileProvided {
		fileHeader, err := c.FormFile("image")
		if err != nil {
			return pgtype.Text{}, fiber.NewError(fiber.StatusBadRequest, "image file is required")
		}

		uploadedURL, err := uploadImageFileToCloudinary(c.Context(), fileHeader)
		if err != nil {
			return pgtype.Text{}, err
		}
		return validateImageURL(uploadedURL)
	}

	return validateImageURL(imageURLRaw)
}

func parseOptionalRating(raw string, field string) (*int, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, field+" must be an integer")
	}
	value := parsed
	return &value, nil
}

func (h *Handler) createQueryWorkflowEvent(
	c fiber.Ctx,
	query dbgen.Query,
	actorUserID pgtype.UUID,
	actorRole dbgen.UserRole,
	eventType dbgen.WorkflowEventType,
	extra map[string]interface{},
) {
	booking, err := h.Queries.GetBookingByID(c.Context(), query.BookingID)
	if err != nil {
		return
	}

	if extra == nil {
		extra = map[string]interface{}{}
	}
	extra["query_id"] = pgUUIDToStr(query.ID)

	metadata, _ := json.Marshal(extra)
	_, _ = h.Queries.CreateWorkflowEvent(c.Context(), dbgen.CreateWorkflowEventParams{
		BookingID:         pgtype.UUID{Bytes: booking.ID.Bytes, Valid: true},
		BagID:             booking.BagID,
		StudentID:         booking.StudentID,
		TriggeredByUserID: actorUserID,
		TriggeredRole:     dbgen.NullUserRole{UserRole: actorRole, Valid: true},
		EventType:         eventType,
		Metadata:          metadata,
	})
}

func (h *Handler) notifyQueryUpdate(c fiber.Ctx, query dbgen.Query, title, message string, payload map[string]interface{}) {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payload["query_id"] = pgUUIDToStr(query.ID)
	payload["query_status"] = query.Status

	payloadBytes, _ := json.Marshal(payload)
	_, _ = h.Queries.CreateNotification(c.Context(), dbgen.CreateNotificationParams{
		RecipientUserID: query.RaisedByUserID,
		BookingID:       query.BookingID,
		Title:           title,
		Message:         message,
		Payload:         payloadBytes,
	})
}

// POST /api/student/queries
func (h *Handler) RaiseStudentQuery(c fiber.Ctx) error {
	student, err := h.requireStudent(c)
	if err != nil {
		return err
	}

	actorUserID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	var body struct {
		BookingID      string `json:"booking_id"`
		Title          string `json:"title"`
		Description    string `json:"description"`
		ImageURL       string `json:"image_url"`
		ServiceRating  *int   `json:"service_rating"`
		HandlingRating *int   `json:"handling_rating"`
	}

	contentType := strings.ToLower(c.Get("Content-Type"))
	imageFileProvided := false
	if strings.HasPrefix(contentType, "multipart/form-data") {
		body.BookingID = c.FormValue("booking_id")
		body.Title = c.FormValue("title")
		body.Description = c.FormValue("description")
		body.ImageURL = c.FormValue("image_url")

		serviceRating, err := parseOptionalRating(c.FormValue("service_rating"), "service_rating")
		if err != nil {
			return err
		}
		handlingRating, err := parseOptionalRating(c.FormValue("handling_rating"), "handling_rating")
		if err != nil {
			return err
		}
		body.ServiceRating = serviceRating
		body.HandlingRating = handlingRating

		if fileHeader, err := c.FormFile("image"); err == nil && fileHeader != nil {
			imageFileProvided = true
		}
	} else {
		if err := c.Bind().Body(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
		}
	}

	body.Title = strings.TrimSpace(body.Title)
	body.Description = strings.TrimSpace(body.Description)
	body.BookingID = strings.TrimSpace(body.BookingID)

	if body.BookingID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "booking_id is required")
	}
	if len(body.Title) < 5 || len(body.Title) > 200 {
		return fiber.NewError(fiber.StatusBadRequest, "title must be 5 to 200 characters")
	}
	if len(body.Description) < 10 || len(body.Description) > 5000 {
		return fiber.NewError(fiber.StatusBadRequest, "description must be 10 to 5000 characters")
	}
	if err := validateRatingPtr(body.ServiceRating, "service_rating"); err != nil {
		return err
	}
	if err := validateRatingPtr(body.HandlingRating, "handling_rating"); err != nil {
		return err
	}

	imageURL, err := resolveQueryImage(c, body.ImageURL, imageFileProvided)
	if err != nil {
		return err
	}

	var bookingID pgtype.UUID
	if err := bookingID.Scan(body.BookingID); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid booking_id")
	}

	booking, err := h.Queries.GetBookingByID(c.Context(), bookingID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "booking not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch booking")
	}

	if pgUUIDToStr(booking.StudentID) != pgUUIDToStr(student.ID) {
		return fiber.NewError(fiber.StatusForbidden, "booking does not belong to this student")
	}

	query, err := h.Queries.RaiseQuery(c.Context(), dbgen.RaiseQueryParams{
		BookingID:      booking.ID,
		StudentID:      student.ID,
		RaisedByUserID: actorUserID,
		Title:          body.Title,
		Description:    body.Description,
		ImageUrl:       imageURL,
		ServiceRating:  toPGInt4(body.ServiceRating),
		HandlingRating: toPGInt4(body.HandlingRating),
	})
	if err != nil {
		return mapQueryDBError(err, "failed to raise query")
	}

	h.createQueryWorkflowEvent(c, query, actorUserID, dbgen.UserRoleStudent, dbgen.WorkflowEventTypeQueryRaised, map[string]interface{}{
		"source": "student_raise_query",
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"query": query})
}

// GET /api/student/queries
func (h *Handler) ListMyQueries(c fiber.Ctx) error {
	if _, err := h.requireStudent(c); err != nil {
		return err
	}

	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	queries, err := h.Queries.ListQueriesByRaisedByUser(c.Context(), dbgen.ListQueriesByRaisedByUserParams{
		RaisedByUserID: userID,
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list queries")
	}
	if queries == nil {
		queries = []dbgen.Query{}
	}

	return c.JSON(fiber.Map{"queries": queries})
}

// GET /api/student/queries/:id
func (h *Handler) GetMyQuery(c fiber.Ctx) error {
	if _, err := h.requireStudent(c); err != nil {
		return err
	}

	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	queryID, err := parseUUIDParam(c, "id", "query id")
	if err != nil {
		return err
	}

	query, err := h.Queries.GetStudentQueryByID(c.Context(), dbgen.GetStudentQueryByIDParams{
		ID:             queryID,
		RaisedByUserID: userID,
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "query not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query")
	}

	replies, err := h.Queries.ListQueryRepliesByQueryID(c.Context(), query.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query replies")
	}
	if replies == nil {
		replies = []dbgen.QueryReply{}
	}

	return c.JSON(fiber.Map{"query": query, "replies": replies})
}

// PATCH /api/student/queries/:id/rating
func (h *Handler) UpdateMyQueryRating(c fiber.Ctx) error {
	if _, err := h.requireStudent(c); err != nil {
		return err
	}

	userID, err := currentUserIDFromCtx(c)
	if err != nil {
		return err
	}

	queryID, err := parseUUIDParam(c, "id", "query id")
	if err != nil {
		return err
	}

	var body struct {
		ServiceRating  *int `json:"service_rating"`
		HandlingRating *int `json:"handling_rating"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if body.ServiceRating == nil && body.HandlingRating == nil {
		return fiber.NewError(fiber.StatusBadRequest, "at least one rating field is required")
	}
	if err := validateRatingPtr(body.ServiceRating, "service_rating"); err != nil {
		return err
	}
	if err := validateRatingPtr(body.HandlingRating, "handling_rating"); err != nil {
		return err
	}

	current, err := h.Queries.GetStudentQueryByID(c.Context(), dbgen.GetStudentQueryByIDParams{
		ID:             queryID,
		RaisedByUserID: userID,
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "query not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query")
	}
	if current.Status == dbgen.QueryStatusClosed {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "cannot update ratings for a closed query"})
	}

	updated, err := h.Queries.UpdateStudentQueryRatings(c.Context(), dbgen.UpdateStudentQueryRatingsParams{
		ID:             current.ID,
		RaisedByUserID: userID,
		ServiceRating:  mergeRating(current.ServiceRating, body.ServiceRating),
		HandlingRating: mergeRating(current.HandlingRating, body.HandlingRating),
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update query ratings")
	}

	return c.JSON(fiber.Map{"query": updated})
}

// GET /api/staff/queries
func (h *Handler) ListStaffQueries(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	limit, offset, err := parsePagination(c)
	if err != nil {
		return err
	}

	queries, err := h.Queries.ListStaffQueries(c.Context(), dbgen.ListStaffQueriesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list staff queries")
	}
	if queries == nil {
		queries = []dbgen.Query{}
	}

	return c.JSON(fiber.Map{"queries": queries})
}

// GET /api/staff/queries/:id
func (h *Handler) GetStaffQuery(c fiber.Ctx) error {
	if _, _, err := h.requireStaff(c); err != nil {
		return err
	}

	queryID, err := parseUUIDParam(c, "id", "query id")
	if err != nil {
		return err
	}

	query, err := h.Queries.GetQueryByID(c.Context(), queryID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "query not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query")
	}

	replies, err := h.Queries.ListQueryRepliesByQueryID(c.Context(), query.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query replies")
	}
	if replies == nil {
		replies = []dbgen.QueryReply{}
	}

	return c.JSON(fiber.Map{"query": query, "replies": replies})
}

// POST /api/staff/queries/:id/acknowledge
func (h *Handler) AcknowledgeQuery(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	queryID, err := parseUUIDParam(c, "id", "query id")
	if err != nil {
		return err
	}

	query, err := h.Queries.GetQueryByID(c.Context(), queryID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "query not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query")
	}

	if query.Status == dbgen.QueryStatusAcknowledged {
		return c.JSON(fiber.Map{"message": "query already acknowledged", "query": query})
	}
	if query.Status == dbgen.QueryStatusResolved || query.Status == dbgen.QueryStatusClosed {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "cannot acknowledge a resolved or closed query"})
	}

	query, err = h.Queries.SetQueryAcknowledged(c.Context(), dbgen.SetQueryAcknowledgedParams{
		ID:                  query.ID,
		AssignedStaffUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to acknowledge query")
	}

	h.createQueryWorkflowEvent(c, query, actorUserID, dbgen.UserRoleLaundryStaff, dbgen.WorkflowEventTypeQueryAcknowledged, map[string]interface{}{
		"source": "staff_acknowledge_query",
	})
	h.notifyQueryUpdate(c, query, "Query Acknowledged", "Your query has been acknowledged by the laundry team.", nil)

	return c.JSON(fiber.Map{"message": "query acknowledged", "query": query})
}

// POST /api/staff/queries/:id/reply
func (h *Handler) ReplyQuery(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	queryID, err := parseUUIDParam(c, "id", "query id")
	if err != nil {
		return err
	}

	var body struct {
		Message string `json:"message"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	body.Message = strings.TrimSpace(body.Message)
	if body.Message == "" {
		return fiber.NewError(fiber.StatusBadRequest, "message is required")
	}

	query, err := h.Queries.GetQueryByID(c.Context(), queryID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "query not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query")
	}

	if query.Status == dbgen.QueryStatusClosed {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "cannot reply to a closed query"})
	}

	if query.Status == dbgen.QueryStatusOpen {
		query, err = h.Queries.SetQueryAcknowledged(c.Context(), dbgen.SetQueryAcknowledgedParams{
			ID:                  query.ID,
			AssignedStaffUserID: actorUserID,
		})
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to acknowledge query")
		}
	}

	reply, err := h.Queries.CreateQueryReply(c.Context(), dbgen.CreateQueryReplyParams{
		QueryID:         query.ID,
		RepliedByUserID: actorUserID,
		Message:         body.Message,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to save reply")
	}

	h.createQueryWorkflowEvent(c, query, actorUserID, dbgen.UserRoleLaundryStaff, dbgen.WorkflowEventTypeQueryReplied, map[string]interface{}{
		"source": "staff_reply_query",
	})
	h.notifyQueryUpdate(c, query, "Query Reply Received", "Laundry staff has replied to your query.", map[string]interface{}{
		"reply_id": pgUUIDToStr(reply.ID),
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"query": query, "reply": reply})
}

// POST /api/staff/queries/:id/resolve
func (h *Handler) ResolveQuery(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	queryID, err := parseUUIDParam(c, "id", "query id")
	if err != nil {
		return err
	}

	query, err := h.Queries.GetQueryByID(c.Context(), queryID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "query not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query")
	}

	if query.Status == dbgen.QueryStatusClosed {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "cannot resolve a closed query"})
	}
	if query.Status == dbgen.QueryStatusResolved {
		return c.JSON(fiber.Map{"message": "query already resolved", "query": query})
	}

	query, err = h.Queries.SetQueryResolved(c.Context(), dbgen.SetQueryResolvedParams{
		ID:                  query.ID,
		AssignedStaffUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to resolve query")
	}

	h.createQueryWorkflowEvent(c, query, actorUserID, dbgen.UserRoleLaundryStaff, dbgen.WorkflowEventTypeQueryResolved, map[string]interface{}{
		"source": "staff_resolve_query",
	})
	h.notifyQueryUpdate(c, query, "Query Resolved", "Your query has been marked as resolved.", nil)

	return c.JSON(fiber.Map{"message": "query resolved", "query": query})
}

// POST /api/staff/queries/:id/close
func (h *Handler) CloseQuery(c fiber.Ctx) error {
	_, actorUserID, err := h.requireStaff(c)
	if err != nil {
		return err
	}

	queryID, err := parseUUIDParam(c, "id", "query id")
	if err != nil {
		return err
	}

	query, err := h.Queries.GetQueryByID(c.Context(), queryID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "query not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch query")
	}

	if query.Status == dbgen.QueryStatusClosed {
		return c.JSON(fiber.Map{"message": "query already closed", "query": query})
	}
	if query.Status != dbgen.QueryStatusResolved {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "query must be resolved before closing"})
	}

	query, err = h.Queries.SetQueryClosed(c.Context(), dbgen.SetQueryClosedParams{
		ID:                  query.ID,
		AssignedStaffUserID: actorUserID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to close query")
	}

	h.createQueryWorkflowEvent(c, query, actorUserID, dbgen.UserRoleLaundryStaff, dbgen.WorkflowEventTypeQueryClosed, map[string]interface{}{
		"source": "staff_close_query",
	})
	h.notifyQueryUpdate(c, query, "Query Closed", "Your query has been closed.", nil)

	return c.JSON(fiber.Map{"message": "query closed", "query": query})
}
