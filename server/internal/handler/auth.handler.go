package handler

import (
	"Frank2006x/washos/internal/auth"
<<<<<<< HEAD
	"fmt"
=======
	"strings"
>>>>>>> d717255de7cbf333cba991d9de581fba59498d1e

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

<<<<<<< HEAD
	fmt.Printf("Login Debug: Login successful for user '%s'\n", body.Email)

	// Generate JWT token
	token, err := auth.GenerateToken(user.ID.String())
=======
	accessToken, refreshToken, err := auth.GenerateTokenPair(user.ID.String())
>>>>>>> d717255de7cbf333cba991d9de581fba59498d1e
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

<<<<<<< HEAD
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
=======
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"token":         accessToken,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *Handler) Refresh(c fiber.Ctx) error {
	type request struct {
		RefreshToken string `json:"refresh_token"`
	}

	var body request
	if err := c.Bind().Body(&body); err != nil {
		return err
	}

	body.RefreshToken = strings.TrimSpace(body.RefreshToken)
	if body.RefreshToken == "" {
		return fiber.NewError(fiber.StatusBadRequest, "refresh_token is required")
	}

	userID, err := auth.ParseAndValidateRefreshToken(body.RefreshToken)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	accessToken, refreshToken, err := auth.GenerateTokenPair(userID)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"token":         accessToken,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
>>>>>>> d717255de7cbf333cba991d9de581fba59498d1e
	})
}

func (h *Handler) Logout(c fiber.Ctx) error {
	// In a stateless JWT authentication system, logout is typically handled on the client side by simply deleting the token.
	return c.JSON(fiber.Map{
		"message": "Logged out successfully",
	})
}
