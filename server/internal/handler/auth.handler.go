package handler

import (
	"Frank2006x/washos/internal/auth"
	"strings"

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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Get user by email
	user, err := h.Queries.GetUserByEmail(c.Context(), body.Email)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
		})
	}

	// Check password (plain text for now - in production use bcrypt)
	if user.Password != body.Password {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
		})
	}

	accessToken, refreshToken, err := auth.GenerateTokenPair(user.ID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

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
	})
}

func (h *Handler) Logout(c fiber.Ctx) error {
	// In a stateless JWT authentication system, logout is typically handled on the client side by simply deleting the token.
	return c.JSON(fiber.Map{
		"message": "Logged out successfully",
	})
}
