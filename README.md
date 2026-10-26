# University Management System (UMS)

A lightweight and responsive University Management System built with HTML, CSS, JavaScript, and powered by Supabase.

## Features

- **Role-Based Access Control**:
  - **Admin**: Manage users, assign roles, create and manage classes, enroll students, post announcements, configure system settings, view reports, and export CSV.
  - **Teacher**: View assigned classes, input and update student grades, view student performance.
  - **Student**: View enrolled classes, check schedules, view grades and remarks, read university announcements.
- **Modern UI**: Clean glassmorphism styling, responsive layout, fluid micro-interactions.
- **Supabase Backend**: Authentication, PostgreSQL database with Row Level Security (RLS), and real-time triggers.

## Project Structure

```text
├── index.html     # Main user interface & app container
├── style.css      # Custom styling & glassmorphism theme
├── app.js         # Core application logic & Supabase integration
├── schema.sql     # Database schema, triggers, and RLS policies
└── README.md      # Project documentation
```

## Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rizitabarangao10/University-Management-System.git
   cd University-Management-System
   ```

2. **Configure Database (Supabase):**
   - Create a project on [Supabase](https://supabase.com).
   - Go to the **SQL Editor** in your Supabase dashboard.
   - Copy and paste the contents of `schema.sql` and run the query.

3. **Configure API Keys:**
   - In your Supabase dashboard, go to **Project Settings** > **API**.
   - Copy your **Project URL** and **anon public key**.
   - Open `app.js` and update the constants:
     ```javascript
     const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
     const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
     ```

4. **Run the Application:**
   - Simply open `index.html` in your web browser, or use a local development server like Live Server or `npx serve`.

5. **Create Admin User:**
   - Sign up a new account via the registration form in the app.
   - In your Supabase SQL Editor, run:
     ```sql
     update profiles set role = 'admin' where email = 'your-email@example.com';
     ```
