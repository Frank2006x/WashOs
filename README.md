# WashOS
🚀 **Smart. Structured. Seamless Laundry.**

## Overview
Managing laundry in high-density hostel environments is often a chaotic process characterized by long wait times, misplaced items, and machine availability conflicts. **WashOS** is a smart management system designed specifically for hostel ecosystems. It bridges the gap between students and laundry staff using QR-based tracking, intelligent slot scheduling, and real-time activity logging, ensuring a transparent and efficient laundry experience for everyone.

---

## ⚡ Key Features

*   **🔍 QR-Based Bag Tracking:** A standardized 3-stage scanning flow (Drop-off → Processing → Ready) ensuring every item is accounted for.
*   **📅 Slot-Based Scheduling:** Advanced booking system to prevent overcrowding and ensure predictable laundry times.
*   **🏢 Floor-Wise Allocation:** Strategic slot distribution based on hostel floors with **Peak Flexibility**—opening unbooked slots to all floors after 12:00 PM.
*   **🪵 Machine Logging:** Precision tracking of machine usage, including specific machine IDs and time-slot mapping.
*   **🔔 Real-Time Notifications:** Instant alerts via push notifications when laundry status changes or items are ready for pickup.
*   **📦 Lost & Found Support:** Dedicated module for reporting and tracking misplaced laundry items.
*   **🖼️ Image-Based Matching (Conceptual):** Future-ready AI vision concept to verify bag contents and reduce identity errors.
*   **🔒 IoT-Based Lock Mechanism (Future):** Planned integration with smart lockers and machine locks for automated secure collection.

---

## 🔄 How It Works

1.  **Schedule:** Student selects an available slot via the WashOS app.
2.  **Drop-off:** Student drops off the bag; Staff scans the unique **Bag QR** to mark it as `Dropped Off`.
3.  **Process:** Staff assigns the bag to a washer/dryer. The system logs the **Machine ID** and start time.
4.  **Ready:** Once drying is complete, staff scans the bag to mark it `Ready for Pickup` and assigns a storage **Row Number**.
5.  **Collect:** Student receives a notification, presents their identity, and staff performs the final scan-out.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React Native (Expo) |
| **Backend** | Go (Fiber Framework) |
| **Database** | PostgreSQL + sqlc |
| **Auth** | JWT (Role-Based Access Control) |

---

## 📦 Installation & Setup

### Backend (Go Server)
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   go mod download
   ```
3. Setup environment variables (Create `.env` based on `.env.example`).
4. Run the server:
   ```bash
   go run cmd/api/main.go
   ```

### Frontend (Expo Client)
1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies using **pnpm**:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dlx expo start
   ```

---

## 📖 Usage

### For Students
*   **Dashboard:** View current booking status and machine availability.
*   **Booking:** Reserve slots based on your floor's schedule.
*   **Identity:** Present your persistent QR code for all transactions.

### For Laundry Staff
*   **Scanner:** Use the built-in scanner to transition bags through the lifecycle.
*   **Queue:** Manage active washing and drying runs across all machines.
*   **Notification:** Trigger ready alerts with one tap after processing.

---

## 🔮 Future Scope
*   **AI Vision:** Implementation of image-based verification for bag contents during drop-off.
*   **Smart Lockers:** Integration with IoT-enabled lockers for 24/7 secure laundry collection.
*   **Analytics:** Detailed reporting for hostel wardens on machine utilization and staff efficiency.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

---
*Developed for the SIH 2025 Solve-a-thon.*
