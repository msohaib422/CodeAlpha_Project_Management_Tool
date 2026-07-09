<h1 align="center"> Project Management Tool </h1>
<p align="center"> A real-time, highly collaborative work management system designed to coordinate workspace tasks, streamline team communications, and synchronize development progress. </p>

<p align="center">
  <img alt="Build" src="https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge">
  <img alt="Issues" src="https://img.shields.io/badge/Issues-0%20Open-blue?style=for-the-badge">
  <img alt="Contributions" src="https://img.shields.io/badge/Contributions-Welcome-orange?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge">
</p>
<!-- 
  **Note:** These are static placeholder badges. Replace them with your project's actual badges.
  You can generate your own at https://shields.io
-->

## 📌 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack & Architecture](#-tech-stack--architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Contributing](#-contributing)
- [License](#-license)

---

## ⭐ Overview

Project Management Tool is a dynamic workspace platform built to empower teams with immediate visual tracking of complex processes, assigning operational tasks, and fostering synchronous communication.

> Modern development projects struggle with communication fragmentation, stale task boards, and unorganized notification loops. Teams lose hours cross-referencing spreadsheets and chat logs to find current project priorities, resulting in missed delivery targets and alignment bottlenecks.

This system provides a unified solution to work planning and tracking. By grouping operations under discrete project boards, users can generate tasks, write immediate feedback comments, manage membership invitations, and view status changes instantaneously. Its lightweight footprint maintains active, real-time channels using dynamic web-sockets, so update lists stay current without tedious manual refreshes.

---

## ✨ Key Features

The workspace architecture translates technical performance into clear, user-focused benefits:

*   🚀 **Centralized Board Dashboard**: Visualize team progress across multiple initiatives from a high-level command view. Get real-time summaries of task volumes and ongoing operations.
*   👥 **Collaborative Task Ownership**: Create, assign, and customize granular task cards. Utilize the comprehensive `TaskDetailsModal` to inspect milestones, update workflows, and adjust dates in real time.
*   💬 **In-Context Discussion Threads**: Stop context-switching to external communication tools. Post comments directly inside task records to coordinate solutions exactly where work happens.
*   🔔 **Dynamic Notification Engine**: Keep team members completely aligned. An intelligent notification system alerts users to new assignments, workspace mentions, and project status modifications via the dedicated `NotificationContext` provider.
*   🔒 **Secure Project Gateways**: Coordinate secure collaborations. Manage project access through invitation-only credentials handled by dedicated backend controller logics.
*   🌓 **Personalized Workspace Theme**: Adjust your development environment to comfortable viewing standards with rapid light/dark mode context toggling.
*   🛡️ **Role-Guided Navigation**: Protect sensitive system actions. Guard configuration panels and user access privileges using robust tokenized middleware routes.

---

## 🛠️ Tech Stack & Architecture

The application implements a decoupled client-server pattern. The Express API delivers resources safely through RESTful interfaces, while the React-Vite client creates highly responsive user layouts.

### Verified Technology Stack

| Technology | Purpose | Why it was Chosen |
| :--- | :--- | :--- |
| **React** | Frontend Component Engine | Built on a component-based model to manage high-frequency page renders and rapid state synchronizations smoothly. |
| **Express** | Backend API Framework | Provides lightweight, performant routing systems to manage server endpoints, invitations, and assets efficiently. |
| **React Router DOM** | Client Routing Routing | Coordinates declarative client routes, enforcing strict page transitions and authenticated layout guards. |
| **Axios** | HTTP Communications | Facilitates asynchronous communication with backend routes, providing clean interceptors for security headers. |
| **Socket.io Client** | Real-time Communication | Powers continuous server connection loops to update user dashboards instantly when project modifications occur. |
| **Lucide React** | Visual Asset Interface | Equips the layout with modern, accessible, and lightweight vector icons. |
| **Vite** | Frontend Development Bundler | Provides blazing-fast hot-reloads and lightning-quick compilation to maintain developer productivity. |
| **Oxlint** | High-performance Code Linter | Keeps files compliant with clean code standards, mitigating programming errors before build compilations. |

### Architectural Concept
```
   ┌────────────────────────────────────────────────────────┐
   │                     React Client                       │
   │   (Context Managers, Page Components, Socket.io)       │
   └───────────┬───────────────────────────────▲────────────┘
               │                               │
       RESTful │ Requests (Axios)              │ Real-time Events
               │                               │ (WebSockets)
   ┌───────────▼───────────────────────────────┴────────────┐
   │                     Express API                        │
   │     (Routes, Controllers, Custom Middlewares)          │
   └───────────────────────────┬────────────────────────────┘
                               │ Database Connections
   ┌───────────────────────────▼────────────────────────────┐
   │                    Database Client                     │
   │               (Models, db Config Helpers)              │
   └────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

The project maintains a clean separation of concerns, separating client views from backend model operations.

```
📁 msohaib422-CodeAlpha_Project_Management_Tool-1ee093e/
├── 📁 server/                              # Backend server source directories
│   ├── 📁 config/                          # Connection configuration files
│   │   └── 📄 db.js                        # System database config helper
│   ├── 📁 controllers/                     # Application API controllers
│   │   ├── 📄 authController.js            # User sign-in and authorization controller
│   │   ├── 📄 commentController.js         # Comment posting and deletion actions
│   │   ├── 📄 invitationController.js      # Project invite creation and verification controller
│   │   ├── 📄 notificationController.js    # Notification tracking controller
│   │   ├── 📄 projectController.js         # Main workspace project coordination controller
│   │   ├── 📄 taskController.js            # Work item task creation and alteration controller
│   │   └── 📄 userController.js            # User profile management controller
│   ├── 📁 middleware/                      # Endpoint protection utilities
│   │   ├── 📄 authMiddleware.js            # User authentication route validator
│   │   └── 📄 errorMiddleware.js           # API wide unified error response formatter
│   ├── 📁 models/                          # Database logical structure schemas
│   │   ├── 📄 ActivityLog.js               # Activity history logger schema
│   │   ├── 📄 Comment.js                   # Interactive task feedback schema
│   │   ├── 📄 Notification.js              # Active workspace notifications schema
│   │   ├── 📄 Project.js                   # Project entity schema
│   │   ├── 📄 ProjectInvitation.js         # Workspace joining authorization schema
│   │   ├── 📄 Task.js                      # Task card functional fields schema
│   │   └── 📄 User.js                      # Registered user profile schema
│   ├── 📁 routes/                          # API routing gateways
│   │   ├── 📄 authRoutes.js                # Core authentication routing
│   │   ├── 📄 commentRoutes.js             # User comments interface mapping
│   │   ├── 📄 invitationRoutes.js          # Shared board invitations routing
│   │   ├── 📄 notificationRoutes.js        # User alert dashboard actions routing
│   │   ├── 📄 projectRoutes.js             # Target project workspace control routing
│   │   ├── 📄 taskRoutes.js                # Task creation and tracking routing
│   │   └── 📄 userRoutes.js                # User profiles management routing
│   ├── 📁 utils/                           # Core utilities
│   │   ├── 📄 generateToken.js             # Authorization JWT generator helper
│   │   └── 📄 upload.js                    # File upload asset processor utility
│   ├── 📄 .env                             # Environment configuration parameters
│   ├── 📄 package-lock.json                # Server library dependency lockfile
│   ├── 📄 package.json                     # Server runtime settings file
│   ├── 📄 seed.js                          # Sandbox database seeder tool
│   └── 📄 server.js                        # Master API entry points runtime
└── 📁 client/                              # Frontend client directories
    ├── 📁 public/                          # Uncompiled static assets
    │   ├── 📄 favicon.svg                  # Browser address tab graphic icon
    │   └── 📄 icons.svg                    # Vector visual layout icons
    ├── 📁 src/                             # Component design systems
    │   ├── 📁 assets/                      # Application media references
    │   │   ├── 📄 hero.png                 # Login dashboard hero visual graphic
    │   │   ├── 📄 react.svg                # Frontend library graphical asset
    │   │   └── 📄 vite.svg                 # Build platform visual logo
    │   ├── 📁 components/                  # Common interface elements
    │   │   ├── 📄 layout.css               # Shared layout alignment definitions
    │   │   ├── 📄 Modal.jsx                # Universal display overlay template
    │   │   ├── 📄 Navbar.jsx               # Navigation structure element
    │   │   ├── 📄 ProtectedRoute.jsx       # Auth route access validator component
    │   │   ├── 📄 Sidebar.jsx              # Navigation dashboard side panel
    │   │   ├── 📄 TaskDetailsModal.jsx     # Detail editor modal interface
    │   │   └── 📄 ToastContainer.jsx       # Flash messaging popup system
    │   ├── 📁 context/                     # Global data managers
    │   │   ├── 📄 AuthContext.jsx          # Security state interface
    │   │   ├── 📄 NotificationContext.jsx  # Notification stream context
    │   │   └── 📄 ThemeContext.jsx         # Global light-dark configuration
    │   ├── 📁 pages/                       # Complete dashboard layouts
    │   │   ├── 📄 board.css                # Interactive work boards style layout
    │   │   ├── 📄 Dashboard.jsx            # Core analytic system view
    │   │   ├── 📄 Login.jsx                # User dashboard login gate
    │   │   ├── 📄 NotFound.jsx             # 404 deadlink fallback template
    │   │   ├── 📄 Notifications.jsx        # Historical alerts stream drawer
    │   │   ├── 📄 ProjectDetails.jsx       # Specific project workspace board
    │   │   ├── 📄 Projects.jsx             # Combined dynamic projects deck
    │   │   ├── 📄 Profile.jsx              # Core user options adjustments
    │   │   ├── 📄 Register.jsx             # User signup registration layout
    │   │   ├── 📄 Settings.jsx             # System customization modules
    │   │   └── 📄 UserManagement.jsx       # Administrative control view
    │   ├── 📁 services/                    # Server connection adapters
    │   │   ├── 📄 api.js                   # Unified Axios API interface instances
    │   │   └── 📄 socket.js                # Core WebSocket interface integration
    │   ├── 📄 App.css                      # Global aesthetic visual system
    │   ├── 📄 index.css                    # Tailwind baseline style controls
    │   ├── 📄 App.jsx                      # System routing and page wrapper
    │   └── 📄 main.jsx                     # Execution entry point react file
    ├── 📄 .gitignore                       # Client git management block list
    ├── 📄 .oxlintrc.json                   # Client code checking config file
    ├── 📄 README.md                        # Readme guidance handbook
    ├── 📄 package-lock.json                # Front dependencies lockfile
    ├── 📄 package.json                     # Frontend scripts and requirements
    └── 📄 vite.config.js                   # Vite performance configuration
```

---

## 🚀 Getting Started

Ensure your development workspace has Node.js installed to execute the server configurations and client dependencies.

### 1. Repository Setup
```bash
# Clone the repository
git clone <repository-url>
cd msohaib422-CodeAlpha_Project_Management_Tool-1ee093e
```

### 2. Configure Backend Server
Navigate to the server directory, install library dependencies, and populate the project schema models if required:
```bash
cd server

# Install the required Node.js libraries
npm install

# (Optional) Seed the database with mock test data
node seed.js

# Launch the Express backend system
npm start
```

### 3. Configure Frontend Client
Launch a separate terminal terminal path, head to the frontend client directories, and boot up the development build environment:
```bash
cd client

# Install frontend UI dependencies
npm install

# Launch local hot-reload server
npm run dev
```
Navigate to your local browser workspace using the network port configuration provided by Vite (typically `http://localhost:5173`).

---

## 🔧 Usage

Once both client and server setups are active, use the app to coordinate and manage workspace projects.

### Standard User Flow

1. **Authentication**: Access the authentication interface at `/register` to create a profile, or secure validation credentials at `/login`.
2. **Dashboard Overview**: Check project progress, view real-time alerts, and navigate using the responsive `Sidebar`.
3. **Workspace Control**: Go to `/projects` to inspect operational boards or set up new tasks.
4. **Task Modification**: Click any workspace task card to open the `TaskDetailsModal` window. Update task stages, assign roles, and add comments.

### Integrated Application API Endpoints

The API acts as a communication bridge between server controllers and frontend services. The base application utilizes optimized routes, such as:

*   `GET /` - Confirms backend connection state and system availability.
*   `GET io` - Configures continuous web socket message loops to process real-time events.

---

## 🤝 Contributing

We welcome contributions to improve Project Management Tool! Your input helps make this project better for everyone.

### How to Contribute

1. **Fork the repository** - Click the 'Fork' button at the top right of this page
2. **Create a feature branch** 
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** - Improve code, documentation, or features
4. **Test thoroughly** - Ensure all functionality works as expected
   ```bash
   # Run project checking rules
   npm run lint
   ```
5. **Commit your changes** - Write clear, descriptive commit messages
   ```bash
   git commit -m 'Add: Amazing new feature that does X'
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request** - Submit your changes for review

### Development Guidelines

- ✅ Follow the existing code style and conventions
- 📝 Add comments for complex logic and algorithms
- 🧪 Write tests for new features and bug fixes
- 📚 Update documentation for any changed functionality
- 🔄 Ensure backward compatibility when possible
- 🎯 Keep commits focused and atomic

### Ideas for Contributions

We're looking for help with:

- 🐛 **Bug Fixes:** Report and fix bugs
- ✨ **New Features:** Implement requested features from issues
- 📖 **Documentation:** Improve README, add tutorials, create examples
- 🎨 **UI/UX:** Enhance user interface and experience
- ⚡ **Performance:** Optimize code and improve efficiency
- 🌐 **Internationalization:** Add multi-language support
- 🧪 **Testing:** Increase test coverage
- ♿ **Accessibility:** Make the project more accessible

### Code Review Process

- All submissions require review before merging
- Maintainers will provide constructive feedback
- Changes may be requested before approval
- Once approved, your PR will be merged and you'll be credited

### Questions?

Feel free to open an issue for any questions or concerns. We're here to help!

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for complete details.

### What this means:

- ✅ **Commercial use:** You can use this project commercially
- ✅ **Modification:** You can modify the code
- ✅ **Distribution:** You can distribute this software
- ✅ **Private use:** You can use this project privately
- ⚠️ **Liability:** The software is provided "as is", without warranty
- ⚠️ **Trademark:** This license does not grant trademark rights

---

<p align="center">Made with ❤️ by the Project Management Tool Team</p>
<p align="center">
  <a href="#">⬆️ Back to Top</a>
</p>