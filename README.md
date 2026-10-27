# ProctorrX — Online Assessment & Coding Platform

**ProctorrX** is a full-stack online assessment platform designed to support secure examinations, coding assessments, and test management. It brings the frontend and backend into a single monorepository, making development, maintenance, and collaboration easier.

The platform combines assessment management, student and administrator interfaces, coding workflows, and AI-assisted capabilities in one application.

**Repository:** [patilmrugesh/ProctorrX](https://github.com/patilmrugesh/ProctorrX)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Security Considerations](#security-considerations)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [Author](#author)

## Overview

Online assessments need more than a question-and-answer interface. They require reliable assessment management, controlled exam sessions, code evaluation, and tools that help administrators monitor and manage the examination process.

ProctorrX aims to bring these capabilities together through a full-stack application with a React-based frontend and a Spring Boot backend.

The project is organized as a monorepo, keeping the frontend and backend in one repository while maintaining their separate development workflows.

## Key Features

### Assessment Management
- Manage questions and test cases.
- Support assessment-related administrative workflows.
- Organize exam and coding-assessment functionality.
- Provide separate interfaces for students and administrators.

### Online Examination Experience
- Dedicated exam interface for students.
- Camera-related functionality for examination monitoring.
- Token-based workflows for controlled or live assessment sessions.
- Support for managing examination access and participation.

### Coding Assessment
- Coding interface for programming-based assessments.
- Test-case-based code verification.
- Execution support for programming languages such as C/C++ and Python, depending on the configured execution environment.
- Docker-based execution infrastructure for supported code-running workflows.

### AI-Assisted Capabilities
- Integration points for Groq and Google Gemini APIs.
- Support for AI-powered functionality configured by the application.
- API credentials managed through environment-based configuration.

### Full-Stack Architecture
- React frontend and Spring Boot REST backend.
- PostgreSQL for persistent data storage.
- Maven-based backend dependency management.
- A unified repository for easier development and maintenance.

> Feature availability depends on the current implementation and configuration of the respective modules.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript |
| Backend | Java, Spring Boot |
| Build Tool | Maven |
| Database | PostgreSQL |
| ORM | Hibernate / Spring Data JPA |
| Code Execution | Docker-based execution workflows |
| AI Integrations | Groq API, Google Gemini API |
| Version Control | Git and GitHub |

## Architecture

ProctorrX follows a client-server architecture.

```text
                 ┌────────────────────────┐
                 │       Student          │
                 │     Administrator      │
                 └───────────┬────────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │     React Frontend     │
                 │  User Interface / UI   │
                 └───────────┬────────────┘
                             │ HTTP / REST
                             ▼
                 ┌────────────────────────┐
                 │    Spring Boot API     │
                 │ Business Logic / Auth   │
                 └──────┬───────────┬─────┘
                        │           │
               ┌────────▼────┐  ┌───▼────────────────┐
               │ PostgreSQL  │  │ AI / Code Execution│
               │  Database   │  │ Integrations       │
               └─────────────┘  └────────────────────┘
```

### Component Responsibilities

- **Frontend:** Provides the student and administrator interfaces, examination screens, and coding workflows.
- **Backend:** Handles API requests, application logic, assessment operations, and database interaction.
- **Database:** Stores persistent application data using PostgreSQL.
- **AI integrations:** Connect to configured AI providers for supported features.
- **Code execution:** Supports configured programming-language execution and test-case evaluation workflows.

## Project Structure

```text
ProctorrX/
├── backend/
│   └── backend/
│       ├── src/
│       │   ├── main/
│       │   └── test/
│       ├── pom.xml
│       └── ...
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── README.md
└── .gitignore
```

The backend source is shown with its nested directory because the repository may retain the original backend project layout. Adjust the paths if the extracted monorepo has a different structure.

## Prerequisites

Install the following tools before running the project:

- **Git** — for cloning the repository.
- **Java JDK 21** — for the Spring Boot backend.
- **Maven** — or use the project's Maven Wrapper if available.
- **Node.js and npm** — for the React frontend.
- **PostgreSQL** — for database storage.
- **Docker** — if you intend to run the Docker-based code execution functionality.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/patilmrugesh/ProctorrX.git
cd ProctorrX
```

### 2. Configure PostgreSQL

Create a PostgreSQL database for the application. The current backend configuration uses the database name `proctorx_db` and the default PostgreSQL port `5432`.

For example:

```sql
CREATE DATABASE proctorx_db;
```

Configure your local database username and password using the backend's environment configuration.

### 3. Configure backend environment variables

Set the database connection details and the API keys required by the features you intend to use.

Do not commit credentials or API keys to Git.

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

### 5. Start the frontend

```bash
npm run dev
```

Use the local URL printed by Vite in the terminal.

### 6. Start the backend

Open a second terminal and navigate to the actual backend directory containing `pom.xml`.

If the project is located at `backend/backend/`:

```bash
cd backend/backend
```

Run the application using the Maven Wrapper if available:

```bash
./mvnw spring-boot:run
```

Alternatively, if Maven is installed:

```bash
mvn spring-boot:run
```

The backend is configured to use port `8080` unless overridden by application configuration.

**Note:** The frontend and backend must be configured to communicate with the correct local API address.

## Environment Configuration

Keep sensitive values outside source control. The following are examples of the configuration categories required; use the exact property names expected by your backend.

| Configuration | Purpose |
|---|---|
| Database URL | PostgreSQL connection |
| Database username | Database authentication |
| Database password | Database authentication |
| `GROQ_API_KEY` | Groq API access |
| `GEMINI_API_KEY` | Google Gemini API access, if enabled |
| Server port | Backend HTTP port |
| Frontend API URL | Backend address used by the frontend |

Example environment-variable configuration:

```bash
export GROQ_API_KEY="your_groq_api_key"
export GEMINI_API_KEY="your_gemini_api_key"
```

Configure the PostgreSQL connection using the application's supported environment variables or Spring Boot properties.

The names above illustrate a configuration convention. Verify that your application maps these environment variables to the properties it actually reads.

## Running the Application

For local development, run the frontend and backend in separate terminal sessions.

| Service | Default Port |
|---|---:|
| React / Vite frontend | `5173` |
| Spring Boot backend | `8080` |
| PostgreSQL | `5432` |

These are expected local development ports; verify the frontend and backend configuration if your setup uses different values.

## Security Considerations

- Never commit API keys, database passwords, access tokens, or other secrets.
- Use environment variables or a local, Git-ignored configuration file for sensitive values.
- Keep database credentials separate from application source code.
- Execute untrusted code only through an appropriately isolated execution environment.
- Validate and authorize requests on the backend rather than relying solely on frontend controls.
- Obtain appropriate user consent before accessing camera or other sensitive device capabilities.
- Rotate any API keys that have accidentally been committed or exposed.

## Future Improvements

Potential areas for further development include:

- Automated backend and frontend testing.
- CI/CD pipelines for reliable builds and deployments.
- Enhanced monitoring and observability.
- Improved code-execution isolation and resource limits.
- More comprehensive API documentation.
- Expanded examination analytics and reporting.

## Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Commit your changes with a descriptive message:

   ```bash
   git commit -m "feat: describe your change"
   ```

4. Push your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

5. Open a pull request describing the changes.

## Author

**Mrugesh Patil**

- GitHub: [@patilmrugesh](https://github.com/patilmrugesh)
- Project Repository: [ProctorrX](https://github.com/patilmrugesh/ProctorrX)

---

If you find this project useful, consider giving the repository a star.

**Built to make online assessments and coding evaluations more manageable, structured, and reliable.**
