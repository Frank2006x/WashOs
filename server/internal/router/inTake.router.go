package router

import (
	"Frank2006x/washos/internal/auth"
	"Frank2006x/washos/internal/handler"

	"github.com/gofiber/fiber/v3"
)

func SetupPhase2Routes(app *fiber.App, h *handler.Handler) {
	apiGroup := app.Group("/api")

	scheduleGroup := apiGroup.Group("/schedules", auth.AuthMiddleware)
	scheduleGroup.Get("/my", h.GetMySchedule)

	bagGroup := apiGroup.Group("/bags", auth.AuthMiddleware)
	bagGroup.Get("/qr/:qrCode", h.GetBagByQRPrecheck)

	scanGroup := apiGroup.Group("/scan", auth.AuthMiddleware)
	scanGroup.Post("/intake", h.IntakeScan)
	scanGroup.Post("/wash-complete", h.WashCompleteScan)
	scanGroup.Post("/pickup-verify", h.PickupVerifyScan)

	bookingGroup := apiGroup.Group("/bookings", auth.AuthMiddleware)
	bookingGroup.Get("/processing", h.ListProcessingBookings)
	bookingGroup.Get("/ready", h.ListReadyBookings)
	bookingGroup.Get("/my/active", h.GetMyActiveBooking)
	bookingGroup.Post("/:id/collect", h.CollectBooking)
	bookingGroup.Get("/:id", h.GetBookingDetails)

	notificationGroup := apiGroup.Group("/notifications", auth.AuthMiddleware)
	notificationGroup.Get("/my/unread", h.ListMyUnreadNotifications)
	notificationGroup.Patch("/:id/read", h.MarkMyNotificationRead)

	adminGroup := apiGroup.Group("/admin", auth.AuthMiddleware)
	adminGroup.Get("/bookings/overview", h.AdminBookingsOverview)

	wardenGroup := apiGroup.Group("/warden", auth.AuthMiddleware)
	wardenGroup.Get("/bookings/block/:blockId", h.WardenBookingsByBlock)
}
