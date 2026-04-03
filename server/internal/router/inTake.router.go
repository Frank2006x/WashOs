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
	scanGroup.Post("/wash-start", h.WashStartScan)
	scanGroup.Post("/wash-finish", h.WashFinishScan)
	scanGroup.Post("/wash-complete", h.WashCompleteScan)
	scanGroup.Post("/dry-start", h.DryStartScan)
	scanGroup.Post("/dry-finish", h.DryFinishScan)
	scanGroup.Post("/ready", h.ReadyScan)
	scanGroup.Post("/pickup-verify", h.PickupVerifyScan)

	machineGroup := apiGroup.Group("/machines", auth.AuthMiddleware)
	machineGroup.Get("", h.ListMachines)

	bookingGroup := apiGroup.Group("/bookings", auth.AuthMiddleware)
	bookingGroup.Get("/processing", h.ListProcessingBookings)
	bookingGroup.Get("/ready", h.ListReadyBookings)
	bookingGroup.Get("/my", h.ListMyBookings)
	bookingGroup.Get("/my/active", h.GetMyActiveBooking)
	bookingGroup.Post("/:id/collect", h.CollectBooking)
	bookingGroup.Post("/:id/wash-complete", h.MarkBookingWashComplete)
	bookingGroup.Post("/:id/ready", h.MarkBookingReady)
	bookingGroup.Get("/:id/events", h.GetBookingEvents)
	bookingGroup.Get("/:id", h.GetBookingDetails)

	notificationGroup := apiGroup.Group("/notifications", auth.AuthMiddleware)
	notificationGroup.Get("/my", h.ListMyNotifications)
	notificationGroup.Get("/my/unread", h.ListMyUnreadNotifications)
	notificationGroup.Patch("/:id/read", h.MarkMyNotificationRead)
}
