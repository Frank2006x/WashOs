<div align="center">

  <img src="/assets/logo.png" alt="WashOS Logo" width="120" height="120" />

  # WashOS
  ### 🚀 Smart Laundry Coordination System for Modern Hostels

  [![Build Status](https://img.shields.io/badge/Build-v1.0.0--beta-blueviolet?style=for-the-badge&logo=github)](https://github.com/vignesh/Solve-a-thon)
  [![Tech Stack](https://img.shields.io/badge/Stack-Go%20%7C%20Fiber%20%7C%20Postgres%20%7C%20Expo-007ACC?style=for-the-badge)](https://github.com/vignesh/Solve-a-thon)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

  **Ensuring transparency, accountability, and efficiency in campus laundry cycles.**

</div>

---

## 📖 Overview

### The Problem
Traditional hostel laundry systems suffer from manual entry errors, misplaced clothing bags, long queues, and poor communication between students and staff. "Who took my bag?" and "Is my laundry ready yet?" are questions that define the daily struggle of campus living.

### The Solution: WashOS
WashOS is a **production-grade laundry workflow engine** that replaces chaos with clarity. By combining secure QR identities with automated status tracking and real-time notifications, WashOS provides a seamless end-to-end management layer for hostel facilities.

### Why It Matters
- **Scalability:** Handles thousands of bags across multiple blocks easily.
- **Accountability:** Every status change is logged with a timestamp and responsible actor.
- **Efficiency:** Reduces idle machine time and prevents pickup bottlenecks.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🔍 QR-Based Tracking** | A robust 3-stage scanning system (Drop → Process → Ready) for full lifecycle visibility. |
| **📅 Slot-Based Scheduling** | Intelligent load balancing to prevent simultaneous drop-off peaks. |
| **🏢 Floor-Wise Flexibility** | Smart scheduling with a **±1 day window** to accommodate academic deadlines and personal needs. |
| **🪵 Machine-Level Logging** | Records precise machine IDs and time-slot usage for maintenance and audit. |
| **📦 Lost & Found System** | Integrated image-to-contact mapping for quick resolution of misplaced items. |
| **🖼️ AI Similarity Matching** | Conceptual feature using vision models to verify bag contents during cycles. |
| **🔒 IoT-Based Lock** | Future integration for smart lockers preventing incorrect bag placement. |
| **📍 Digital Laundry Shelf** | Automated row/shelf assignments for organized, stress-free pickups. |

---

## 🏗️ System Architecture

WashOS is built on a **State Machine Architecture** that enforces strict lifecycle transitions.

### 🎭 Core Roles
- **Student:** Manages their persistent QR identity, books slots, and tracks real-time progress.
- **Staff:** Executes the workflow via quick scans, manages machine occupancy, and triggers ready alerts.

### 🔄 Lifecycle Workflow
`Created` → `Dropped Off` → `Washing` → `Wash Done` → `Drying` → `Dry Done` → `Ready for Pickup` (Row Assigned) → `Collected`

---

## 🛠️ Tech Stack

### 📱 Frontend
- **Framework:** React Native (Expo)
- **Language:** TypeScript
- **State Management:** React Context API
- **Styling:** NativeWind (Tailwind CSS)

### ⚙️ Backend
- **Framework:** Go (Fiber)
- **Database:** PostgreSQL + sqlc (Type-safe SQL)
- **API Pattern:** RESTful with JWT Auth

### 🔧 Tools & Libraries
- **Scanner:** Expo Camera / BarcodeScanner
- **Notifications:** Expo Push Services
- **Schema:** sqlc-generated type-safe models

---

## 🚀 Installation & Setup

### 📱 Client Setup (Expo)
```bash
# Navigate to client
cd client

# Install dependencies
pnpm install

# Start the Expo development server
npx expo start
```

### ⚙️ Server Setup (Go)
```bash
# Navigate to server
cd server

# Download dependencies
go mod download

# Run the API server
go run cmd/api/main.go
```

---

## 📸 Screens & Demo

| Dashboard | QR Scanner | Staff Panel |
| :---: | :---: | :---: |
| <img src="/assets/screens/dashboard_placeholder.png" width="200" /> | <img src="/assets/screens/scanner_placeholder.png" width="200" /> | <img src="/assets/screens/staff_panel_placeholder.png" width="200" /> |
| *Real-time timeline* | *Instant bag validation* | *Queue management* |

---

## 🔮 Future Scope

- **🛠️ IoT Machine Integration:** Hardware locks on machines that only open for assigned bags.
- **🔄 Round-Robin Assignment:** Automated machine load balancing to extend hardware lifespan.
- **📊 Admin Analytics:** Detailed heatmaps of laundry traffic for hostel wardens.
- **🤖 Autonomous Sort:** Fully robotic sorting integration (Conceptual V3).

---

## 🤝 Contribution

We welcome contributions from the community!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---
<div align="center">
  <sub>Developed for the <b>SIH 2025 Solve-a-thon</b>. Build with ❤️ by the WashOS Team.</sub>
</div>
