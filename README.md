# TestBox Clone - Demo Data Generator for Salesforce & People.ai

A platform for generating realistic synthetic sales data using AI and injecting it directly into Salesforce environments. Built to create compelling demo environments for Salesforce and People.ai integrations.

## Features

- **AI-Powered Data Generation**: Uses GPT-4 to create realistic emails, call transcripts, and CRM records
- **Direct Salesforce Integration**: Inject data via REST/Bulk API into production orgs or sandboxes
- **Multi-User Support**: Each user can create isolated demo datasets
- **PII-Free Data**: All generated data is fictional and safe for demos
- **Template System**: Pre-built templates for different industries and scenarios
- **Background Processing**: Job queue for handling large data generation tasks

## Tech Stack

- **Backend**: NestJS (Node.js)
- **Frontend**: Next.js 14 with App Router
- **Database**: PostgreSQL
- **Queue**: BullMQ with Redis
- **AI**: OpenAI GPT-4
- **Styling**: Tailwind CSS

## Project Structure

```
├── apps/
│   ├── api/                 # NestJS backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/        # JWT authentication
│   │       │   ├── users/       # User management
│   │       │   ├── environments/# Salesforce org management
│   │       │   ├── templates/   # Data generation templates
│   │       │   ├── generator/   # AI data generation
│   │       │   ├── salesforce/  # Salesforce API integration
│   │       │   ├── datasets/    # Generated datasets
│   │       │   └── jobs/        # Background job processing
│   │       └── config/
│   └── web/                 # Next.js frontend
│       └── src/
│           ├── app/             # App router pages
│           ├── components/      # React components
│           ├── hooks/           # Custom hooks
│           ├── lib/             # Utilities
│           └── stores/          # Zustand stores
├── packages/
│   └── shared/              # Shared types and constants
├── docker/                  # Docker configuration
└── scripts/                 # Setup scripts
```

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- OpenAI API key
- Salesforce Connected App credentials

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd PeopleI.AI_TB_Clone
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=testbox_clone

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-32-byte-hex-key

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Salesforce Connected App
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_CALLBACK_URL=http://localhost:3000/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```

### 3. Start Infrastructure (Docker)

```bash
# Start PostgreSQL and Redis
npm run docker:dev
```

### 4. Run the Application

```bash
# Development mode (runs both API and Web)
npm run dev
```

- API: http://localhost:3001
- Web: http://localhost:3000
- API Docs: http://localhost:3001/api/docs

## Salesforce Setup

### Create a Connected App

1. Go to Salesforce Setup > App Manager
2. Click "New Connected App"
3. Configure:
   - Enable OAuth Settings
   - Callback URL: `http://localhost:3000/salesforce/callback`
   - OAuth Scopes: `api`, `refresh_token`
4. Save and copy Client ID and Secret

### Required Permissions

The connected app user needs:
- API Enabled permission
- Modify All Data (for creating records)
- View All Data (for querying)

## Usage

### 1. Create Account

Register at http://localhost:3000/register

### 2. Connect Salesforce

1. Go to Dashboard > Environments
2. Click "Add Environment"
3. Enter a name and click "Connect to Salesforce"
4. Authorize the connected app

### 3. Generate Data

1. Go to Dashboard > Generate Data
2. Select a template (e.g., "Technology Sales")
3. Choose your Salesforce environment (optional)
4. Configure record counts
5. Click "Generate Data"

### 4. Inject into Salesforce

1. View the generated dataset
2. Click "Inject to Salesforce"
3. Monitor progress
4. View records in Salesforce

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Environments
- `GET /api/environments` - List environments
- `POST /api/environments` - Create environment
- `GET /api/environments/:id/auth-url` - Get Salesforce OAuth URL
- `POST /api/environments/:id/callback` - Handle OAuth callback

### Templates
- `GET /api/templates` - List templates
- `GET /api/templates/:id` - Get template details

### Generator
- `POST /api/generate` - Start generation job
- `GET /api/generate/:datasetId/status` - Get job status
- `POST /api/generate/:datasetId/inject` - Inject into Salesforce

### Datasets
- `GET /api/datasets` - List datasets
- `GET /api/datasets/:id` - Get dataset details
- `GET /api/datasets/:id/records` - Get generated records
- `DELETE /api/datasets/:id` - Delete dataset
- `POST /api/datasets/:id/cleanup` - Remove from Salesforce

## Docker Deployment

### Production

```bash
# Build and start all services
docker-compose -f docker/docker-compose.yml up -d
```

### Development

```bash
# Start only infrastructure
docker-compose -f docker/docker-compose.dev.yml up -d
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_HOST` | PostgreSQL host | Yes |
| `DATABASE_PORT` | PostgreSQL port | Yes |
| `DATABASE_USERNAME` | PostgreSQL username | Yes |
| `DATABASE_PASSWORD` | PostgreSQL password | Yes |
| `DATABASE_NAME` | PostgreSQL database name | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PORT` | Redis port | Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes |
| `ENCRYPTION_KEY` | AES-256 encryption key (32 bytes hex) | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `SALESFORCE_CLIENT_ID` | Salesforce Connected App ID | Yes |
| `SALESFORCE_CLIENT_SECRET` | Salesforce Connected App Secret | Yes |
| `SALESFORCE_CALLBACK_URL` | OAuth callback URL | Yes |
| `SALESFORCE_LOGIN_URL` | Salesforce login URL | No |

## Development

### Running Tests

```bash
npm run test
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Architecture Notes

### Data Generation Pipeline

1. User selects template and configures record counts
2. Job is queued in BullMQ
3. Generator service builds prompts and calls GPT-4
4. Generated data is transformed to Salesforce format
5. Records are stored in database with local IDs
6. Injection job pushes data to Salesforce via API
7. Local IDs are mapped to Salesforce IDs for relationships

### Relationship Handling

Records are created in dependency order:
1. Account (parent)
2. Contact (child of Account)
3. Opportunity (child of Account)
4. Task/Event (linked to Contact and Opportunity)

The object mapper service handles translating local IDs to Salesforce IDs during injection.

## License

MIT
