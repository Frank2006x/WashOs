package handler

import (
	"strings"

	"Frank2006x/washos/internal/auth"
	dbgen "Frank2006x/washos/internal/repository"

	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	Queries *dbgen.Queries
}

func NewHandler(q *dbgen.Queries) *Handler {
	return &Handler{Queries: q}
}

type AuthResponse struct {
	Token        string      `json:"token"`
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         dbgen.User  `json:"user"`
	Profile      interface{} `json:"profile,omitempty"`
}

func sanitizeUser(user dbgen.User) dbgen.User {
	user.Password = ""
	return user
}

func (h *Handler) buildAuthResponse(c fiber.Ctx, user dbgen.User, accessToken, refreshToken string) (AuthResponse, error) {
	var profile interface{}
	switch user.Role {
	case dbgen.UserRoleStudent:
		student, err := h.Queries.GetStudentByUserID(c.Context(), user.ID)
		if err == nil {
			profile = student
		}
	case dbgen.UserRoleLaundryStaff:
		staff, err := h.Queries.GetLaundryStaffByUserID(c.Context(), user.ID)
		if err == nil {
			profile = staff
		}
	}

	return AuthResponse{
		Token:        accessToken,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         sanitizeUser(user),
		Profile:      profile,
	}, nil
}

func (h *Handler) StudentSignIn(c fiber.Ctx) error {
	type request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var body request
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Email == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "email and password are required"})
	}

	user, err := h.Queries.GetUserByEmail(c.Context(), body.Email)
	if err != nil || user.Role != dbgen.UserRoleStudent {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if !auth.VerifyPassword(user.Password, body.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	accessToken, refreshToken, err := auth.GenerateTokenPair(user.ID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	response, err := h.buildAuthResponse(c, user, accessToken, refreshToken)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to build response"})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func (h *Handler) StudentSignUp(c fiber.Ctx) error {
	type request struct {
		Name     string `json:"name"`
		RegNo    string `json:"reg_no"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var body request
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	body.Name = strings.TrimSpace(body.Name)
	body.RegNo = strings.TrimSpace(strings.ToUpper(body.RegNo))
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))

	if body.Name == "" || body.RegNo == "" || body.Email == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, reg_no, email, and password are required"})
	}

	hashedPassword, err := auth.HashPassword(body.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to secure password"})
	}

	user, err := h.Queries.CreateUser(c.Context(), dbgen.CreateUserParams{
		Email:    body.Email,
		Password: hashedPassword,
		Role:     dbgen.UserRoleStudent,
	})
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Unable to create student user"})
	}

	_, err = h.Queries.CreateStudent(c.Context(), dbgen.CreateStudentParams{
		UserID: user.ID,
		RegNo:  body.RegNo,
		Name:   body.Name,
	})
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Unable to create student profile"})
	}

	user.Password = ""
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Student account created",
		"user":    user,
	})
}

func (h *Handler) StaffSignIn(c fiber.Ctx) error {
	type request struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}

	var body request
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	body.Phone = strings.TrimSpace(body.Phone)
	if body.Phone == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "phone and password are required"})
	}

	user, err := h.Queries.GetLaundryStaffUserByPhone(c.Context(), body.Phone)
	if err != nil || user.Role != dbgen.UserRoleLaundryStaff {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if !auth.VerifyPassword(user.Password, body.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	accessToken, refreshToken, err := auth.GenerateTokenPair(user.ID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	response, err := h.buildAuthResponse(c, user, accessToken, refreshToken)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to build response"})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func (h *Handler) StaffSignUp(c fiber.Ctx) error {
	type request struct {
		Name     string `json:"name"`
		Phone    string `json:"phone"`
		Password string `json:"password"`
		Email    string `json:"email,omitempty"`
	}

	var body request
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	body.Name = strings.TrimSpace(body.Name)
	body.Phone = strings.TrimSpace(body.Phone)
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))

	if body.Name == "" || body.Phone == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, phone, and password are required"})
	}

	service, err := h.Queries.GetFirstLaundryService(c.Context())
	if err != nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "No laundry service configured"})
	}

	email := body.Email
	if email == "" {
		email = strings.ReplaceAll(body.Phone, "+", "") + "@staff.washos.local"
	}

	hashedPassword, err := auth.HashPassword(body.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to secure password"})
	}

	user, err := h.Queries.CreateUser(c.Context(), dbgen.CreateUserParams{
		Email:    email,
		Password: hashedPassword,
		Role:     dbgen.UserRoleLaundryStaff,
	})
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Unable to create staff user"})
	}

	_, err = h.Queries.CreateLaundryStaff(c.Context(), dbgen.CreateLaundryStaffParams{
		UserID:           user.ID,
		Name:             body.Name,
		Phone:            body.Phone,
		LaundryServiceID: service.ID,
	})
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Unable to create staff profile"})
	}

	user.Password = ""
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Laundry staff account created",
		"user":    user,
	})
}

// Login is kept as a backward-compatible alias to student signin.
func (h *Handler) Login(c fiber.Ctx) error {
	return h.StudentSignIn(c)
}

// Login is kept as a backward-compatible alias to student signin.


func (h *Handler) Refresh(c fiber.Ctx) error {
	type request struct {
		RefreshToken string `json:"refresh_token"`
	}

	var body request
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	body.RefreshToken = strings.TrimSpace(body.RefreshToken)
	if body.RefreshToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "refresh_token is required"})
	}

	userID, err := auth.ParseAndValidateRefreshToken(body.RefreshToken)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid refresh token"})
	}

	accessToken, refreshToken, err := auth.GenerateTokenPair(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"token":         accessToken,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *Handler) Logout(c fiber.Ctx) error {
	type request struct {
		RefreshToken string `json:"refresh_token"`
	}

	var body request
	_ = c.Bind().Body(&body)

	authHeader := strings.TrimSpace(c.Get("Authorization"))
	if authHeader != "" {
		parts := strings.Fields(authHeader)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			_ = auth.RevokeToken(parts[1])
		}
	}

	if strings.TrimSpace(body.RefreshToken) != "" {
		_ = auth.RevokeToken(strings.TrimSpace(body.RefreshToken))
	}

	return c.JSON(fiber.Map{"message": "Logged out successfully"})
}
