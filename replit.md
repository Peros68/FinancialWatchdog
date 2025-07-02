# FinAlert - Financial Markets Alert and Watchlist Application

## Overview

FinAlert is a modern web application for managing stock alerts and watchlists in financial markets. The application provides a clean, dark-themed interface for searching stocks, viewing detailed charts, managing watchlists, and setting price alerts. It uses the Finnhub API for real-time financial data and implements a responsive design suitable for both desktop and mobile devices.

## System Architecture

The application follows a full-stack architecture with clear separation between frontend and backend components:

- **Frontend**: React-based SPA using Vite as the build tool
- **Backend**: Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Node.js production environment with static file serving

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom configuration for development and production
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Custom component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme and CSS variables
- **Charts**: Recharts for financial data visualization

### Backend Architecture
- **Server**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Storage**: Dual implementation with in-memory storage for development and PostgreSQL for production
- **API Integration**: Finnhub.io for financial data (search, quotes, profiles, chart data)
- **Session Management**: Prepared for PostgreSQL session storage

### Data Storage Solutions
- **Primary Database**: PostgreSQL for persistent data storage (enabled)
- **Schema Management**: Drizzle Kit for database migrations and schema synchronization
- **Connection**: Neon serverless PostgreSQL driver for cloud database connectivity
- **Storage Implementation**: DatabaseStorage class for PostgreSQL persistence

### Authentication and Authorization
- **User Management**: Basic user schema with username/password authentication
- **Session Handling**: Configured for connect-pg-simple session storage
- **Authorization**: User-scoped data access for watchlists and alerts

### External Service Integrations
- **Financial Data Provider**: Finnhub.io API
  - Stock search functionality
  - Real-time quotes and price data
  - Company profiles and market information
  - Historical chart data with multiple timeframes
- **API Key Management**: Environment variable configuration with fallback defaults

## Data Flow

1. **Stock Search**: User inputs search query → debounced API call → Finnhub search endpoint → filtered results display
2. **Stock Details**: Stock selection → parallel API calls for quote and profile data → chart data fetching → comprehensive stock view
3. **Watchlist Management**: User creates/manages watchlists → database persistence → real-time UI updates
4. **Alert System**: User sets price alerts → database storage → prepared for notification system integration

## External Dependencies

### Production Dependencies
- **UI Framework**: React ecosystem with Radix UI components
- **Database**: Drizzle ORM, PostgreSQL drivers, and Neon serverless
- **API Client**: Native fetch with custom request wrapper
- **Utilities**: Date-fns for date manipulation, Zod for schema validation
- **Charts**: Recharts for financial data visualization

### Development Dependencies
- **Build Tools**: Vite with React plugin and TypeScript support
- **Code Quality**: ESBuild for production bundling
- **Replit Integration**: Custom plugins for development environment

## Deployment Strategy

### Development Environment
- **Hot Module Replacement**: Vite development server with HMR
- **API Proxy**: Integrated Express server serving both API and static files
- **Environment Variables**: VITE_ prefix for client-side variables
- **Database**: Flexible storage backend (memory or PostgreSQL)

### Production Environment
- **Build Process**: Vite production build with optimized assets
- **Server Bundle**: ESBuild compilation for Node.js deployment
- **Static Files**: Express static file serving from dist/public
- **Database**: PostgreSQL with connection pooling via Neon
- **Environment**: Production-specific configuration and error handling

### Key Architectural Decisions

1. **Dual Storage Implementation**: Provides flexibility for development (in-memory) and production (PostgreSQL) environments
2. **API Abstraction**: Custom API client wrapper enables consistent error handling and request management
3. **Component Architecture**: Modular UI components with clear separation of concerns
4. **Dark Theme First**: CSS custom properties enable consistent theming across all components
5. **Debounced Search**: 500ms debounce reduces API calls and improves user experience
6. **Real-time Updates**: TanStack Query provides optimistic updates and cache management

## Changelog

```
Changelog:
- July 02, 2025. Initial setup
- July 02, 2025. Configured PostgreSQL database for persistent watchlist storage
- July 02, 2025. Enhanced chart interface with advanced toolbar, indicators, and timeframes
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```