# University Management System (UMS)

A lightweight and responsive University Management System built with HTML, CSS, JavaScript, and powered by Supabase.

## Features

## User Roles & Capabilities

The system supports **3 distinct user types**, each with dedicated dashboard views and permissions:

1. **Admin**:
   - Manage all users: filter by role (Admin, Teacher, Student), switch user roles instantly, or remove accounts.
   - Manage classes and course records; assign teachers to classes.
   - Enroll students into classes.
   - Publish, edit, and delete campus-wide announcements.
   - Configure university settings (university name, passing score, maximum score).
   - View analytics dashboard with role breakdowns, grade statistics, and export CSV reports.

2. **Teacher**:
   - View assigned classes and student enrollments.
   - Input and update student grades and custom remarks.
   - Access student academic performance records.
   - View university announcements and generate class reports.

3. **Student**:
   - View enrolled classes and weekly class schedule (room, time, day).
   - View grades, remarks, and pass/fail status in real-time.
   - Read campus announcements.
   - View and edit student profile.

### Registration & Role Assignment
- When signing up, users can select their **Account Type** (`Student`, `Teacher`, or `Admin`).
- Administrators can also switch any user's role on the fly directly in the **Manage Users** dashboard.

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
