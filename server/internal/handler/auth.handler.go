package handler

import (
	"Frank2006x/WashOs/internal/auth"
	"Frank2006x/WashOs/internal/dbgen"

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

func (h *Handler) Register(c fiber.Ctx) error {
	type request struct {
		Email    string
		Password string
	}
	var body request

	if err := c.Bind().Body(&body); err != nil {
		return err
	}
	
	if err != nil {
		return fiber.ErrInternalServerError
	}
	user,err:=h.Queries.GetUserByEmail(c.Context(), body.Email)
	if err==nil{
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "User already exists",
		})
	}

	user,err=h.Queries.CreateUser(c.Context(),dbgen.CreateUserParams{
		Email: body.Email,
		Password: string(hashedPassword),
	})
	if err!=nil{
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create user",
			"details": err.Error(),
		})
	}


	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id": user.ID,
		"email": user.Email,
	})

}

func (h *Handler) Logout(c fiber.Ctx) error {
	// In a stateless JWT authentication system, logout is typically handled on the client side by simply deleting the token.
	return c.JSON(fiber.Map{
		"message": "Logged out",
	})
}