import { describe, expect, it } from "vitest";
import { mapRawRowToStudent, parseStudentCsv, trimToHeader } from "./studentService";

describe("studentService", () => {
  it("trims csv text to expected header", () => {
    const input = "meta,meta\n1,2,3\nลำดับที่,ชื่อ,นามสกุล\n1,สมชาย,ใจดี";
    const result = trimToHeader(input);
    expect(result.startsWith("ลำดับที่,ชื่อ,นามสกุล")).toBe(true);
  });

  it("maps raw row to normalized student fields", () => {
    const row = {
      ลำดับที่: " 1 ",
      "รหัส นตท.": " 123 ",
      ชื่อ: " สมชาย ",
      นามสกุล: " ใจดี ",
    };
    const student = mapRawRowToStudent(row);
    expect(student.sequence).toBe("1");
    expect(student.studentId).toBe("123");
    expect(student.firstName).toBe("สมชาย");
    expect(student.lastName).toBe("ใจดี");
  });

  it("parses csv and filters out rows without sequence", async () => {
    const csv = "ลำดับที่,ชื่อ,นามสกุล\n1,เอ,บี\n,ซี,ดี";
    const result = await parseStudentCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toBe("เอ");
  });
});
