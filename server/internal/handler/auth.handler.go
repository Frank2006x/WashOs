package handler

import (
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

func (h *Handler) Login(c fiber.Ctx) error {
	type request struct {
		Email    string
		Password string
	}

	var body request

	if err := c.Bind().Body(&body); err != nil {
		return err
	}

	user, err := h.Queries.GetUserByEmail(c.Context(), body.Email)
	
	if err != nil {
		return fiber.ErrUnauthorized
	}

	


	token, err := auth.GenerateToken(user.ID.String())
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"token": token,
	})
}



func (h *Handler) Logout(c fiber.Ctx) error {
	// In a stateless JWT authentication system, logout is typically handled on the client side by simply deleting the token.
	return c.JSON(fiber.Map{
		"message": "Logged out",
	})
}