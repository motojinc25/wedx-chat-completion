# 🌺 WeDX Chat Completion

<div align="center">
  <h3>🏝️ <em>Aloha from Hawaii</em> 🏝️</h3>
  <p><strong>The open-core engine powering intelligent conversations</strong></p>

  [![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18+-blue.svg)](https://react.dev/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)

  *Born under the Hawaiian sun, engineered for the world* 🌴
</div>

---

## 🌊 Welcome to WeDX Chat Completion

Like the gentle trade winds of Hawaii, **WeDX Chat Completion** brings effortless conversational AI to your applications. This open-source platform provides OpenAI Chat Completion-compatible APIs with advanced function calling, real-time streaming, and enterprise-grade security.

**WeDX Chat Completion** serves as the open-core foundation that powers **[WeDX Chat Ci](https://wedx.cc)** — our comprehensive commercial AI platform. While this OSS version provides core conversational AI capabilities, WeDX Chat Ci offers enhanced enterprise features, professional support, and managed cloud services.

Developed with the spirit of Hawaiian hospitality, our platform welcomes developers from around the world to build intelligent, interactive experiences.

## ✨ Key Features

### 🤖 **Intelligent Conversations**

- **OpenAI-Compatible API**: Seamless integration with existing Chat Completion workflows
- **Real-time Streaming**: Live response generation with function call detection
- **Microsoft Semantic Kernel**: Advanced AI orchestration with Azure OpenAI
- **Function Calling**: Math, Time, HTTP operations, and extensible MCP plugin support

### 🔒 **Enterprise Security**

- **Microsoft Entra ID**: Enterprise-grade authentication and authorization
- **JWT Token Validation**: Secure API access with automatic token verification
- **Audit Logging**: Comprehensive tracking of user actions and system events
- **Multi-mode Support**: Development, Production, and Demo modes

### 🏗️ **Modern Architecture**

- **Function-First Design**: Domain-driven architecture for scalability
- **Full-Stack TypeScript**: End-to-end type safety
- **PostgreSQL**: Robust database with automatic migrations
- **OpenTelemetry**: Complete observability with traces, logs, and metrics

### 🎨 **Developer Experience**

- **React 18+ Frontend**: Modern UI with Shadcn/UI components
- **FastAPI Backend**: High-performance Python API server
- **Code Quality**: ESLint, Biome, and Ruff for consistent code standards

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+ and uv
- PostgreSQL 13+
- Azure OpenAI Service (for AI features)
- Microsoft Entra ID App Registration (for authentication)

### 🏃‍♂️ Get Running in 5 Minutes

```bash
# 1. Clone the repository
git clone https://github.com/motojinc25/wedx-chat-completion.git
cd wedx-chat-completion

# 2. Install dependencies
cd frontend && pnpm install
cd ../backend && uv sync

# 3. Set up environment variables
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Edit .env files with your configurations

# 4. Initialize database
cd backend && uv run alembic upgrade head

# 5. Start both services
cd frontend && pnpm run dev:full
```

Your services will be running at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 🏗️ Architecture Overview

WeDX Chat Completion follows a **Function-First** architecture, organizing code by business capabilities rather than technical layers.

### Frontend Structure

```
frontend/src/
├── features/                    # Business features
│   ├── administration/          # User & tenant management
│   ├── dashboard/               # Monitoring dashboards
│   ├── data-management/         # Master data & settings
│   ├── observability/           # Logs, traces, metrics
│   └── playground/              # Chat interface
├── shared/                      # Shared components
│   ├── components/ui/           # Shadcn/UI components
│   ├── contexts/                # React contexts
│   ├── hooks/                   # Global hooks
│   └── utils/                   # Utilities & API client
```

### Backend Structure

```
backend/
├── features/                    # Business features
│   ├── administration/          # User management APIs
│   ├── dashboard/               # System monitoring
│   ├── data_management/         # Configuration APIs
│   ├── observability/           # Telemetry endpoints
│   └── playground/              # Chat completion APIs
├── shared/                      # Shared infrastructure
│   ├── auth/                    # Authentication & JIT provisioning
│   ├── database/                # PostgreSQL connection
│   ├── models/                  # SQLAlchemy models
│   └── utils/                   # Common utilities
```

## 🔧 Development Commands

### Frontend Development

```bash
cd frontend

# Development server
pnpm run dev              # Start frontend only
pnpm run dev:full         # Start both frontend & backend

# Build & Quality
pnpm run build           # Production build
pnpm run check           # Lint & format (Biome)
pnpm run test:run        # Run tests once
pnpm run test            # Test watch mode
```

### Backend Development

```bash
cd backend

# Development server
uv run python main.py    # Start backend with logging

# Database
uv run alembic revision --autogenerate -m "Description"
uv run alembic upgrade head

# Quality & Testing
cd frontend && pnpm run check:backend    # Lint & format (Ruff)
cd frontend && pnpm run test:backend     # Run pytest tests
```

## 🌐 API Usage

### Chat Completion Endpoint

```bash
curl -X POST "http://localhost:8000/api/ai/chat/completion" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messages": [
      {"role": "user", "content": "Calculate 15 + 27"}
    ],
    "system_message": "You are a helpful assistant."
  }'
```

### Function Calling Response

```json
{
  "content": "I'll calculate that for you.",
  "function_calls": [
    {
      "name": "Math-Add",
      "arguments": {"value1": 15, "value2": 27},
      "result": 42
    }
  ],
  "finish_reason": "tool_calls",
  "role": "assistant"
}
```

## 🔌 Plugin System

Extend functionality with plugins:

### Core Plugins (Built-in)

- **Math Plugin**: Mathematical calculations
- **Time Plugin**: Current time and date functions
- **HTTP Plugin**: Web requests and interactions

### MCP Plugins (External Tools)

- **Context7 Plugin**: Documentation resolver
- **Custom MCP Plugins**: Extensible external tool integration

## 📊 Observability

Built-in comprehensive monitoring:

- **OpenTelemetry Integration**: Traces, logs, and metrics
- **PostgreSQL Storage**: Direct database storage for telemetry data
- **Semantic Kernel Telemetry**: AI operation monitoring
- **Audit Logging**: Complete user action tracking
- **Performance Metrics**: Response times and resource usage

## 🧪 Testing

### Frontend Testing (Vitest + RTL)

```bash
cd frontend
pnpm run test:run      # Run all tests
pnpm run test:ui       # Interactive test runner
pnpm run test          # Watch mode
```

### Backend Testing (pytest)

```bash
cd frontend
pnpm run test:backend  # Run all backend tests

# Direct pytest (from backend directory)
cd backend && uv run pytest -v
```

## 🤝 Contributing

We welcome contributions with the spirit of Hawaiian aloha!

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow our patterns**: Use Function-First architecture
4. **Test your changes**: Ensure all tests pass
5. **Submit a PR**: Include clear description and tests

### Development Guidelines

- Follow existing code patterns and architecture
- Add tests for new features
- Update documentation as needed
- Use conventional commit messages
- Ensure linting passes (`pnpm run check`)

## 📝 Environment Configuration

### Frontend (.env)

```bash
VITE_APP_MODE=development                    # development/production/demo
VITE_AZURE_CLIENT_ID=your-client-id-here
VITE_AZURE_TENANT_ID=your-tenant-id-here
VITE_REDIRECT_URI=http://localhost:5173
```

### Backend (.env)

```bash
APP_MODE=development                         # development/production/demo
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_API_CLIENT_ID=your-api-client-id-here

# Azure OpenAI (for AI features)
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=admin_db
DB_USER=admin_user
DB_PASSWORD=admin_password
```

## 🏆 Technology Stack

### Frontend

- **React 18+** with TypeScript
- **Next.js** App Router pattern
- **Vite** for lightning-fast builds
- **Tailwind CSS** + **Shadcn/UI**
- **MSAL.js** for Microsoft authentication
- **Vitest** + **React Testing Library**

### Backend

- **FastAPI** for high-performance APIs
- **SQLAlchemy** async ORM + **Alembic** migrations
- **PostgreSQL** for robust data storage
- **Microsoft Semantic Kernel** for AI orchestration
- **OpenTelemetry** for comprehensive observability
- **pytest** for thorough testing

## 🌺 The Hawaiian Connection

Developed with aloha in the beautiful islands of Hawaii, this project embodies the Hawaiian values of:

- **Ohana** (Family): Building a welcoming community of developers
- **Malama** (Care): Thoughtful, sustainable code practices
- **Pono** (Rightness): Ethical AI development and responsible technology
- **Aloha** (Love & Respect): Inclusive, collaborative development culture

Like the diverse ecosystem of Hawaii, our platform brings together various technologies in harmony to create something beautiful and functional.

## 🏖️ License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🤙 Acknowledgments

- **Microsoft** for Semantic Kernel and Azure OpenAI services
- **OpenAI** for inspiring our Chat Completion compatibility
- **The open-source community** for the amazing tools that make this possible
- **Hawaii** for providing the perfect environment to innovate and create

---

<div align="center">
  <h3>🌴 Mahalo for using WeDX Chat Completion! 🌴</h3>
  <p><em>Made with aloha in Hawaii 🏝️</em></p>

  **[⭐ Star us on GitHub](https://github.com/motojinc25/wedx-chat-completion)** • **[🐛 Report Issues](https://github.com/motojinc25/wedx-chat-completion/issues)**
</div>
