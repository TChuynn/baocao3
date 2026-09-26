# Event Management System with AI

A full-stack demo application for event management with AI features for notifications, feedback summarization, and chatbot Q&A.

## Stack

- Node.js + Express
- SQLite
- JWT authentication
- Vanilla HTML/CSS/JS frontend

## Features

- Role-based access for Admin, Event Organizer, Check-in staff, and Guest
- Event, schedule, speaker, ticket, registration, feedback, FAQ, and revenue management
- AI mock endpoints for notification generation, feedback summarization, and chatbot answers
- Responsive demo UI for core screens

## AI Skills in this project

This project contains three AI skills implemented as mock backend endpoints and UI actions:

1. Notification Generator
   - Route: POST /api/ai/generate-notification
   - Behavior: Creates a polished event message based on the selected notification type and event context.
   - Implemented in: src/controllers/aiController.js

2. Feedback Summarizer
   - Route: POST /api/ai/summarize-feedback
   - Behavior: Aggregates event feedback into grouped insight categories such as content quality, time management, and venue experience.
   - Implemented in: src/controllers/aiController.js

3. Chatbot FAQ Assistant
   - Route: POST /api/ai/chatbot
   - Behavior: Answers event-related questions using FAQ matching and fallback event knowledge.
   - Implemented in: src/controllers/aiController.js

## Run locally

1. Install dependencies:
   npm install
2. Copy environment file:
   cp .env.example .env
3. Start the app:
   npm start
4. Open the browser at http://localhost:3000

## Default accounts

- Admin: admin / 123456
- Organizer: organizer / 123456
- Check-in: staff / 123456

## API examples

- POST /api/auth/login
- GET /api/events
- POST /api/ai/generate-notification
- POST /api/ai/summarize-feedback
- POST /api/ai/chatbot
