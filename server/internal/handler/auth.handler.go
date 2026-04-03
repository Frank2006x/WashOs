package handler

import (
	"Frank2006x/washos/internal/auth"
	"fmt"

	dbgen "Frank2006x/washos/internal/repository"

	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	Queries *dbgen.Queries
}

func NewHandler(q *dbgen.Queries) *Handler {
	return &Handler{Queries: q}
}

type LoginResponse struct {
	Token   string      `json:"token"`
	User    dbgen.User  `json:"user"`
	Profile interface{} `json:"profile,omitempty"`
}

func (h *Handler) Login(c fiber.Ctx) error {
	type request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var body request

	if err := c.Bind().Body(&body); err != nil {
		fmt.Printf("Login Debug: Failed to bind body: %v\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	fmt.Printf("Login Debug: Received login request for email: '%s'\n", body.Email)

	// Get user by email
	user, err := h.Queries.GetUserByEmail(c.Context(), body.Email)
	if err != nil {
		fmt.Printf("Login Debug: User not found in DB for email '%s'. Error: %v\n", body.Email, err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
		})
	}

	fmt.Printf("Login Debug: User found. Comparing passwords. DB:'%s' vs Input:'%s'\n", user.Password, body.Password)

	// Check password (plain text for now - in production use bcrypt)
	if user.Password != body.Password {
		fmt.Printf("Login Debug: Password mismatch for user '%s'\n", body.Email)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
		})
	}

	fmt.Printf("Login Debug: Login successful for user '%s'\n", body.Email)

	// Generate JWT token
	token, err := auth.GenerateToken(user.ID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

	// Get user profile based on role
	var profile interface{}
	switch user.Role {
	case dbgen.UserRoleStudent:
		student, err := h.Queries.GetStudentByUserID(c.Context(), user.ID)
		if err == nil {
			profile = student
		}
	case dbgen.UserRoleWarden:
		warden, err := h.Queries.GetWardenByUserID(c.Context(), user.ID)
		if err == nil {
			profile = warden
		}
	case dbgen.UserRoleStaff:
		staff, err := h.Queries.GetLaundryStaffByUserID(c.Context(), user.ID)
		if err == nil {
			profile = staff
		}
	}

	// Remove password from response
	user.Password = ""

	return c.Status(fiber.StatusOK).JSON(LoginResponse{
		Token:   token,
		User:    user,
		Profile: profile,
	})
}

func (h *Handler) Logout(c fiber.Ctx) error {
	// In a stateless JWT authentication system, logout is typically handled on the client side by simply deleting the token.
	return c.JSON(fiber.Map{
		"message": "Logged out successfully",
	})
}
