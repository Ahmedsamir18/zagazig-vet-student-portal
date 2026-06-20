# Zagazig Veterinary Medicine College Student Portal

This is a simple student website with:

- credentials-based login
- a student activities page
- a separate student degrees page with 10 semesters
- private student-specific degree records
- Excel/CSV files as the editable data source
- a clickable college logo that returns students to the home page
- default semester subject rows that appear until real grades are added

## Files you will usually edit

### 1. Credentials file

Put student login data in:

```text
data/credentials.xlsx
```

If that file does not exist, the website uses:

```text
data/credentials.csv
```

Required columns:

```text
student_id, name, email, password
```

Optional columns shown in the student header:

```text
seat_number, class, current_semester, academic_year
```

If these optional columns are missing, the site shows `Not set`.

Example:

```text
2024001, Ahmed Hassan, ahmed@example.com, student123
```

### 2. Degrees file

Put all student degrees in:

```text
data/degrees.xlsx
```

If that file does not exist, the website uses:

```text
data/degrees.csv
```

Required columns:

```text
student_id, semester, subject_code, subject_name, credit_hours, score, grade, status, notes
```

The `student_id` connects the grades file to the credentials file. A student only sees rows with their own `student_id`.

### 3. Default semester subjects file

Use this file to control the subjects that should appear in every semester before grades are added:

```text
data/default_subjects.xlsx
```

If that file does not exist, the website uses:

```text
data/default_subjects.csv
```

Required columns:

```text
semester, subject_code, subject_name, credit_hours, score, grade, status, notes
```

How it works:

- every row in `default_subjects.xlsx` appears for every logged-in student
- if `degrees.xlsx` has the same `semester` and `subject_code` for that student, the real grade row replaces the default row
- if `degrees.xlsx` has a subject that is not in the default file, it still appears

This lets you set the normal subjects for each semester once, then only add real student grade rows when they are available.

## Changing Excel column names

If your Excel columns use different names, edit this file:

```text
config/columns.js
```

For example, if your Excel file uses `Student Number` instead of `student_id`, change:

```js
studentId: "student_id"
```

to:

```js
studentId: "Student Number"
```

## How to run locally

Install the required packages once:

```text
npm install
```

Start the website:

```text
npm start
```

Open:

```text
http://localhost:3000
```

Sample login:

```text
Email: ahmed@example.com
Password: student123
```

## How to replace the logo

The interface uses:

```text
public/logo.png
```

Replace that file with another image using the same file name if the college logo changes. The logo is also a home button.

## Pages

After login:

- `/` shows the student activities home page
- `/degrees` shows the semester degrees page
- `/announcements` shows editable announcement placeholders
- `/schedule` shows editable schedule placeholders
- `/exam-instructions` shows editable exam instruction placeholders
- `/student-affairs` shows editable student affairs placeholders
- `/payments` shows editable payment placeholders

The activities cards are placeholders that can be edited later in:

```text
public/index.html
```

## Portal tracker

The home page includes a small handler tracker with:

- online users active in the last 5 minutes
- total logins since the server started
- unique students logged in since the server started
- registered students from the credentials file
- default subject rows
- grade rows

This is a lightweight in-memory tracker. The counts reset when the server restarts.

## Deployment notes

This website needs a Node.js hosting service because login and Excel reading happen on the server.

Good simple choices:

- Render
- Railway
- DigitalOcean App Platform
- a VPS with Node.js

Before public deployment, set this environment variable in your hosting dashboard:

```text
SESSION_SECRET
```

Use a long random value. Also change the sample student data before uploading.

Important: this starter keeps passwords in the Excel file so it is easy to manage. For a real public college system, hashed passwords and administrator controls are strongly recommended.
