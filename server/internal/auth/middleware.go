package auth

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(c fiber.Ctx) error {
	authHeader := c.Get("Authorization")

	if authHeader == "" {
		return fiber.ErrUnauthorized
	}

	tokenStr := strings.Split(authHeader, " ")
	if len(tokenStr) != 2 {
		return fiber.ErrUnauthorized
	}

	token, err := jwt.Parse(tokenStr[1], func(t *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		return fiber.ErrUnauthorized
	}

	claims := token.Claims.(jwt.MapClaims)

	
	c.Locals("user_id", claims["user_id"])

	return c.Next()
}