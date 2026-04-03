package router

import (
	"Frank2006x/washos/internal/auth"
	"Frank2006x/washos/internal/handler"

	"github.com/gofiber/fiber/v3"
)

func SetupAuthRoutes(app *fiber.App, h *handler.Handler) {
	apiGroup := app.Group("/api")
	authGroup := apiGroup.Group("/auth")

	// V1 role-specific signin endpoints.
	authGroup.Post("/student/signup", h.StudentSignUp)
	authGroup.Post("/staff/signup", h.StaffSignUp)
	authGroup.Post("/student/signin", h.StudentSignIn)
	authGroup.Post("/staff/signin", h.StaffSignIn)

	// Backward-compatible alias for existing clients.
	authGroup.Post("/login", h.Login)

	authGroup.Post("/refresh", h.Refresh)
	authGroup.Post("/logout", auth.AuthMiddleware, h.Logout)
}
