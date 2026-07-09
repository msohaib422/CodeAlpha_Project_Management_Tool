# 📋 Project Management Tool

A real-time, full-stack collaborative project management platform built on the **MERN stack**. It enables teams to organize work into projects, assign and track tasks, discuss progress in-context, and stay updated instantly through live notifications — all from a single, unified dashboard.

![Build](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge)
![Issues](https://img.shields.io/badge/Issues-0%20Open-blue?style=for-the-badge)
![Contributions](https://img.shields.io/badge/Contributions-Welcome-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#️-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Usage](#-usage)
- [Screenshots](#-screenshots)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

## ⭐ Overview

Modern teams often lose valuable time juggling scattered spreadsheets, outdated task boards, and disconnected chat threads just to figure out what's actually going on with a project. **Project Management Tool** solves this by giving teams one central, real-time workspace to plan, assign, discuss, and track work.

Projects act as containers for related work. Inside each project, teams can create tasks, leave comments directly on those tasks, invite members securely, and watch status changes update live — no manual refreshing required, thanks to WebSocket-powered real-time sync.

---

## ✨ Key Features

- 🗂️ **Project Workspaces** — Organize work into distinct project boards, each with its own tasks, members, and activity history.
- ✅ **Task Management** — Create, assign, update, and track tasks through a detailed task modal supporting status changes, due dates, and ownership.
- 💬 **In-Task Comments** — Discuss work directly inside the relevant task instead of switching to external chat apps.
- 🔔 **Real-Time Notifications** — Get instantly notified of new task assignments, comments, and project updates via a live notification system.
- 👥 **Secure Invitations** — Invite teammates to a project through a controlled, invitation-based access flow.
- 🔐 **JWT Authentication** — Secure login and registration with token-based authentication and protected routes.
- 🌓 **Light/Dark Theme** — Switch between light and dark mode for a comfortable viewing experience.
- 📜 **Activity Logging** — Track project and task history through an activity log for full transparency.
- 📱 **Responsive Dashboard** — Clean, component-based UI built with React and Vite for a fast, responsive experience across devices.

---

## 🛠️ Tech Stack

### Frontend (`/client`)
| Technology | Purpose |
|---|---|
| **React** | Component-based UI library for building the dashboard interface |
| **Vite** | Fast development server and build tool |
| **React Router DOM** | Client-side routing and protected route handling |
| **Axios** | HTTP client for communicating with the backend REST API |
| **Socket.io Client** | Real-time, bi-directional communication with the server |
| **Lucide React** | Lightweight, modern icon set |
| **Oxlint** | High-performance linter for code quality |

### Backend (`/server`)
| Technology | Purpose |
|---|---|
| **Node.js / Express** | REST API server and routing |
| **MongoDB / Mongoose** | Database and schema modeling for users, projects, tasks, comments, notifications, and invitations |
| **JWT (jsonwebtoken)** | Authentication and route protection |
| **Socket.io** | Real-time event broadcasting to connected clients |
| **Multer (or equivalent)** | File/asset upload handling |

---

## 🏗️ Architecture

The application follows a decoupled client-server architecture, with the Express API serving data over REST and Socket.io handling live updates.

```
┌────────────────────────────────────────────────────────┐
│                     React Client                        │
│   (Context Providers, Pages, Components, Socket.io)      │
└───────────┬───────────────────────────────▲─────────────┘
            │                               │
    RESTful │ Requests (Axios)              │ Real-time Events
            │                               │ (Socket.io)
┌───────────▼───────────────────────────────┴─────────────┐
│                     Express API                          │
│      (Routes → Controllers → Middleware)                 │
└───────────────────────────┬──────────────────────────────┘
                             │ Mongoose ODM
┌────────────────────────────▼─────────────────────────────┐
│                      MongoDB Database                     │
│         (Users, Projects, Tasks, Comments, etc.)           │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
CodeAlpha_Project_Management_Tool/
├── server/                          # Backend (Express + MongoDB)
│   ├── config/
│   │   └── db.js                    # Database connection setup
│   ├── controllers/
│   │   ├── authController.js        # Login / registration logic
│   │   ├── commentController.js     # Comment create / delete logic
│   │   ├── invitationController.js  # Project invite handling
│   │   ├── notificationController.js
│   │   ├── projectController.js     # Project CRUD logic
│   │   ├── taskController.js        # Task CRUD logic
│   │   └── userController.js        # User profile logic
│   ├── middleware/
│   │   ├── authMiddleware.js        # JWT route protection
│   │   └── errorMiddleware.js       # Centralized error handling
│   ├── models/
│   │   ├── ActivityLog.js
│   │   ├── Comment.js
│   │   ├── Notification.js
│   │   ├── Project.js
│   │   ├── ProjectInvitation.js
│   │   ├── Task.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── commentRoutes.js
│   │   ├── invitationRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── projectRoutes.js
│   │   ├── taskRoutes.js
│   │   └── userRoutes.js
│   ├── utils/
│   │   ├── generateToken.js         # JWT token generator
│   │   └── upload.js                # File upload utility
│   ├── seed.js                      # Database seeder script
│   └── server.js                    # App entry point
│
└── client/                          # Frontend (React + Vite)
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── components/
    │   │   ├── Modal.jsx
    │   │   ├── Navbar.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   ├── Sidebar.jsx
    │   │   ├── TaskDetailsModal.jsx
    │   │   └── ToastContainer.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   ├── NotificationContext.jsx
    │   │   └── ThemeContext.jsx
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Projects.jsx
    │   │   ├── ProjectDetails.jsx
    │   │   ├── Notifications.jsx
    │   │   ├── Profile.jsx
    │   │   ├── Settings.jsx
    │   │   ├── UserManagement.jsx
    │   │   └── NotFound.jsx
    │   ├── services/
    │   │   ├── api.js               # Axios instance
    │   │   └── socket.js            # Socket.io client instance
    │   ├── App.jsx
    │   └── main.jsx
    └── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher recommended)
- **MongoDB** (local instance or MongoDB Atlas connection string)
- **npm** (comes with Node.js)

### 1. Clone the Repository

```bash
git clone https://github.com/msohaib422/CodeAlpha_Project_Management_Tool.git
cd CodeAlpha_Project_Management_Tool
```

### 2. Set Up the Backend

```bash
cd server

# Install dependencies
npm install

# Create a .env file (see Environment Variables section below)

# (Optional) Seed the database with sample data
node seed.js

# Start the backend server
npm start
```

By default, the API will run on `http://localhost:5000` (or the port defined in your `.env` file).

### 3. Set Up the Frontend

Open a new terminal window:

```bash
cd client

# Install dependencies
npm install

# Start the development server
npm run dev
```

The client will be available at `http://localhost:5173`.

---

## 🔑 Environment Variables

Create a `.env` file inside the `server/` directory with the following variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
```

> ⚠️ Never commit your `.env` file. Make sure it is listed in `.gitignore`.

---

## 🔧 Usage

1. **Register / Login** — Create an account at `/register` or sign in at `/login`.
2. **Dashboard** — View a summary of your active projects and recent notifications.
3. **Create a Project** — Set up a new project workspace from the `/projects` page.
4. **Manage Tasks** — Open a project to create, assign, and update tasks via the `TaskDetailsModal`.
5. **Collaborate** — Invite teammates to your project and discuss tasks using in-context comments.
6. **Stay Updated** — Receive real-time notifications for assignments, comments, and status changes.

---

## 📸 Screenshots

> Add screenshots or a demo GIF of the dashboard, task board, and notification panel here to give visitors a quick visual preview of the app.

```
docs/screenshots/dashboard.png
docs/screenshots/task-board.png
docs/screenshots/notifications.png
```

---

## 🗺️ Roadmap

- [ ] File attachments on tasks
- [ ] Kanban-style drag-and-drop board view
- [ ] Task due-date reminders via email
- [ ] Analytics dashboard for project progress
- [ ] Mobile-responsive UI improvements
- [ ] Unit and integration test coverage

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. **Fork** the repository
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and test them locally
4. **Lint your code**
   ```bash
   npm run lint
   ```
5. **Commit your changes**
   ```bash
   git commit -m "Add: your feature description"
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** describing your changes

### Guidelines
- Follow the existing code style and naming conventions
- Keep commits focused and descriptive
- Update documentation when functionality changes
- Test your changes before submitting a PR

---

## 📝 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Muhammad Sohaib**
MERN Stack Developer | CodeAlpha Internship Project

- GitHub: [@msohaib422](https://github.com/msohaib422)

---

<p align="center">⭐ If you found this project useful, consider giving it a star!</p>
