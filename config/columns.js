module.exports = {
  collegeName: "Zagazig Veterinary Medicine College",

  files: {
    credentials: "data/credentials.xlsx",
    credentialsFallback: "data/credentials.csv",
    degrees: "data/degrees.xlsx",
    degreesFallback: "data/degrees.csv",
    defaultSubjects: "data/default_subjects.xlsx",
    defaultSubjectsFallback: "data/default_subjects.csv"
  },

  credentialsColumns: {
    studentId: "student_id",
    name: "name",
    email: "email",
    password: "password",
    seatNumber: "seat_number",
    className: "class",
    currentSemester: "current_semester",
    academicYear: "academic_year"
  },

  degreesColumns: {
    studentId: "student_id",
    semester: "semester",
    subjectCode: "subject_code",
    subjectName: "subject_name",
    creditHours: "credit_hours",
    score: "score",
    grade: "grade",
    status: "status",
    notes: "notes"
  },

  defaultSubjectColumns: {
    semester: "semester",
    subjectCode: "subject_code",
    subjectName: "subject_name",
    creditHours: "credit_hours",
    score: "score",
    grade: "grade",
    status: "status",
    notes: "notes"
  }
};
