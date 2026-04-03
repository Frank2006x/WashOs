package auth

import (
	"strings"

	"github.com/gofiber/fiber/v3"
)

func AuthMiddleware(c fiber.Ctx) error {
	authHeader := c.Get("Authorization")

	if authHeader == "" {
		return fiber.ErrUnauthorized
	}

	parts := strings.Fields(authHeader)
	if len(parts) != 2 {
		return fiber.ErrUnauthorized
	}

	userID, err := ParseAndValidateAccessToken(parts[1])
	if err != nil {
		return fiber.ErrUnauthorized
	}

	c.Locals("user_id", userID)

	return c.Next()
}