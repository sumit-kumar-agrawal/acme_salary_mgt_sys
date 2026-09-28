# Salary Management System

## Business Objective

Build a web application to manage salary information for approximately 10,000 employees across multiple countries and provide salary analytics for HR.

## Technology Stack

- Backend: Ruby on Rails REST API
- Frontend: React with Bootstrap
- Database: MySql
- Backend tests: RSpec
- Frontend tests: React Testing Library
- E2E tests: Playwright
- Redis and Sidekiq: Only if justified by requirements

## Scope

- Employee management
- Salary records and salary history
- Search, filters and pagination
- Salary analytics and reports
- Single HR Manager user

## Explicitly Out of Scope

- Payroll processing and salary disbursement
- Tax and statutory calculations
- Banking, accounting and HRMS integrations
- Advanced RBAC and approval workflows
- LLM, chatbot, embeddings and RAG
- Microservices and complex distributed architecture
- Multi-region deployment and advanced DR

Do not implement excluded features unless requirements are explicitly changed and approved.

## Business Rules

- Store salary amount and currency separately.
- Never sum different currencies as if they were equal.
- Preserve salary history when salary changes.
- Use effective dates for salary records.
- Use synthetic data for development and demos.
- Do not expose sensitive salary information unnecessarily.

## Engineering Rules

@.claude/rules/backend.md
@.claude/rules/frontend.md
@.claude/rules/security.md
@.claude/rules/testing.md

## Workflow

1. Read docs/requirements.md before implementation.
2. Propose an implementation plan before major changes.
3. Implement in small, reviewable steps.
4. Run relevant tests after changes.
5. Update documentation when design decisions change.
6. Do not silently change scope or assumptions.
