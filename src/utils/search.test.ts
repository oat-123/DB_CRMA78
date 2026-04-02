import { describe, expect, it } from "vitest";
import type { StudentRecord } from "../types/student";
import { buildStudentDisplayName, filterStudents, normalizeForSearch } from "./search";

const mockStudent = (overrides: Partial<StudentRecord>): StudentRecord => ({
  sequence: "1",
  studentId: "A001",
  title: "นาย",
  firstName: "สมชาย",
  lastName: "ใจดี",
  nickname: "ชาย",
  searchableName: "somchai",
  hometown: "",
  birthDate: "",
  age: "",
  phoneNumber: "",
  previousSchool: "",
  bloodType: "",
  religion: "",
  physicalTestScore: "",
  ptPullUp: "",
  ptPushUp: "",
  ptSitUp: "",
  ptRun2Miles: "",
  ptSwim100m: "",
  pt2PullUp: "",
  pt2PushUp: "",
  pt2SitUp: "",
  pt2Run2Miles: "",
  pt2Swim100m: "",
  raw: {},
  ...overrides,
});

describe("search utils", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeForSearch("  Ab C  ")).toBe("abc");
  });

  it("builds display name with nickname", () => {
    const student = mockStudent({});
    expect(buildStudentDisplayName(student)).toBe("นาย สมชาย ใจดี (ชาย)");
  });

  it("filters by student id and limits results", () => {
    const students = [
      mockStudent({ studentId: "A001" }),
      mockStudent({ sequence: "2", studentId: "B001", firstName: "ทดสอบ" }),
    ];

    const result = filterStudents(students, "b001", 1);
    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe("B001");
  });
});
