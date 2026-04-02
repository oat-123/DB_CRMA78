import type { StudentRecord } from "../types/student";

export const normalizeForSearch = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, "");

export const buildStudentDisplayName = (student: StudentRecord): string => {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const nickname = student.nickname && student.nickname !== "-" ? ` (${student.nickname})` : "";
  const title = student.title ? `${student.title} ` : "";
  return `${title}${fullName}${nickname}`.trim();
};

export const filterStudents = (
  students: StudentRecord[],
  query: string,
  maxResults = 50,
): StudentRecord[] => {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (!normalizedQuery) return students;

  return students
    .filter((student) => {
      const fullName = normalizeForSearch(`${student.firstName}${student.lastName}`);
      const studentId = student.studentId.toLowerCase();
      const nickname = student.nickname.toLowerCase();
      const searchableName = normalizeForSearch(student.searchableName);
      return (
        fullName.includes(normalizedQuery) ||
        studentId.includes(normalizedQuery) ||
        nickname.includes(normalizedQuery) ||
        searchableName.includes(normalizedQuery)
      );
    })
    .slice(0, maxResults);
};
