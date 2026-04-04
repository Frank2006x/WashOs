package router

import (
	"Frank2006x/washos/internal/auth"
	"Frank2006x/washos/internal/handler"

	"github.com/gofiber/fiber/v3"
)

func SetupStudentRoutes(app *fiber.App, h *handler.Handler) {
	apiGroup := app.Group("/api")

	// All student routes require a valid access token.
	// Role enforcement is done inside each handler via requireStudent()
	// which checks GetStudentByUserID — non-students will get 403.
	studentGroup := apiGroup.Group("/student/me", auth.AuthMiddleware)

	studentGroup.Get("/bag", h.GetMyBag)
	studentGroup.Post("/bag/init", h.InitMyBag)
	studentGroup.Post("/bag/rotate", h.RotateMyBag)
	studentGroup.Patch("/block", h.UpdateMyBlock)
	studentGroup.Get("/location", h.GetMyResidence)
	studentGroup.Patch("/location", h.UpdateMyResidence)
	studentGroup.Get("/slots/available", h.ListMyAvailableSlots)
	studentGroup.Post("/slots/book", h.BookMySlot)
	studentGroup.Get("/slots/bookings", h.ListMySlotBookings)
	studentGroup.Post("/slots/:id/cancel", h.CancelMySlotBooking)
}
