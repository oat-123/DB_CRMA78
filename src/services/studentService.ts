import Papa from "papaparse";
import type { StudentRecord } from "../types/student";

export interface StudentUpdateRequest {
  sourceCsvUrl: string;
  studentKey: string;
  raw: Record<string, string>;
}

const REQUIRED_HEADER = "ลำดับที่";

const getCellValue = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
};

const normalizeName = (value: string): string => value.toLowerCase().replace(/\s+/g, "");

export const trimToAnyHeader = (csvText: string, possibleHeaders: string[]): string => {
  let earliestIndex = -1;

  for (const header of possibleHeaders) {
    const index = csvText.indexOf(header);
    if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
      earliestIndex = index;
    }
  }

  if (earliestIndex === -1) return csvText;
  
  const lastNewlineIndex = csvText.lastIndexOf("\n", earliestIndex);
  return lastNewlineIndex === -1 ? csvText : csvText.substring(lastNewlineIndex + 1);
};

export const trimToHeader = (csvText: string): string => {
  return trimToAnyHeader(csvText, [REQUIRED_HEADER]);
};

export const mapRawRowToStudent = (row: Record<string, unknown>): StudentRecord => {
  const raw = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = typeof value === "string" ? value.trim() : "";
    return acc;
  }, {});

  return {
    sequence: getCellValue(row, "ลำดับที่"),
    studentId: getCellValue(row, "รหัส นตท."),
    title: getCellValue(row, "คำนำหน้า"),
    firstName: getCellValue(row, "ชื่อ"),
    lastName: getCellValue(row, "นามสกุล"),
    nickname: getCellValue(row, "ชื่อเล่น"),
    searchableName: getCellValue(row, "ชื่อค้นหา"),
    hometown: getCellValue(row, "ภูมิลำเนาเดิม"),
    birthDate: getCellValue(row, "วัน/เดือน/ปีเกิด"),
    age: getCellValue(row, "อายุ"),
    phoneNumber: getCellValue(row, "หมายเลขโทรศัพท์"),
    previousSchool: getCellValue(row, "สถานศึกษาก่อนเข้า รร.ตท."),
    bloodType: getCellValue(row, "กรุ๊บเลือด"),
    religion: getCellValue(row, "ศาสนา"),
    physicalTestScore: getCellValue(row, "คะแนนเทสร่างกาย"),
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
    raw,
    sheetData: {
      "ข้อมูลหลัก (Rawdata)": raw,
    },
  };
};

const extractSheetId = (sheetUrl: string): string | null => {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([^/]+)/);
  return match ? match[1] : null;
};

const buildPtTestUrl = (sheetUrl: string): string | null => {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) return null;
  // Use explicit gid instead of sheet name for more reliable fetching
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=104977054`;
};

const getFirstNonEmpty = (row: Record<string, string>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim() !== "") return value.trim();
  }
  return "";
};

const getMetricByAttempt = (
  row: Record<string, string>,
  terms: string[],
  attempt: 1 | 2,
): string => {
  const termSet = terms.map((term) => term.toLowerCase());
  const attempt2Markers = ["ครั้งที่ 2", "คร้้งที่ 2", "_1", ".1", " 2"];

  const matches = Object.entries(row).filter(([key, value]) => {
    if (!value || value.trim() === "") return false;
    const lowerKey = key.toLowerCase();
    return termSet.every((term) => lowerKey.includes(term));
  });

  if (matches.length === 0) return "";
  if (attempt === 1) {
    const firstAttempt = matches.find(([key]) =>
      attempt2Markers.every((marker) => !key.toLowerCase().includes(marker)),
    );
    return (firstAttempt?.[1] ?? matches[0][1] ?? "").trim();
  }

  const secondAttempt = matches.find(([key]) =>
    attempt2Markers.some((marker) => key.toLowerCase().includes(marker)),
  );
  return (secondAttempt?.[1] ?? matches[1]?.[1] ?? "").trim();
};

const parseSimpleCsvRows = (csvText: string): Promise<Record<string, string>[]> =>
  new Promise((resolve, reject) => {
    // Trim to a generic known secondary header or primary header to skip merged row titles
    const trimmed = trimToAnyHeader(csvText, ["ชื่อค้นหา", "ลำดับที่", "ลำดับ", "เลขบัตร ปชช", "เบอร์"]);
    Papa.parse<Record<string, unknown>>(trimmed, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row) =>
          Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = typeof value === "string" ? value.trim() : "";
            return acc;
          }, {}),
        );
        resolve(rows);
      },
      error: (error: Error) => reject(error),
    });
  });

export const parseStudentCsv = (csvText: string): Promise<StudentRecord[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(trimToHeader(csvText), {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const students = results.data
          .map((row) => mapRawRowToStudent(row))
          .filter((row) => row.sequence !== "");
        resolve(students);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });

const buildSheetByNameUrl = (sheetUrl: string, sheetName: string): string | null => {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) return null;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
};

export const fetchStudents = async (csvUrl: string): Promise<StudentRecord[]> => {
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const csvText = await response.text();
  const students = await parseStudentCsv(csvText);
  let mergedStudents = students;

  const ptUrl = import.meta.env.VITE_PTTEST_CSV_URL ?? buildPtTestUrl(csvUrl);
  if (ptUrl) {
    try {
      const ptResponse = await fetch(ptUrl);
      if (ptResponse.ok) {
        const ptCsv = await ptResponse.text();
        const ptRows = await parseSimpleCsvRows(ptCsv);
        
        const ptRawMap = new Map<string, Record<string, string>>();

        const ptMap = new Map<
          string,
          {
            pullUp: string;
            pushUp: string;
            sitUp: string;
            run2Miles: string;
            swim100m: string;
            pullUp2: string;
            pushUp2: string;
            sitUp2: string;
            run2Miles2: string;
            swim100m2: string;
          }
        >();
        ptRows.forEach((row) => {
          const nameKey = normalizeName(
            getFirstNonEmpty(row, ["ชื่อค้นหา"]) ||
              `${getFirstNonEmpty(row, ["ชื่อ"])}${getFirstNonEmpty(row, ["นามสกุล"])}`,
          );
          if (!nameKey) return;

          ptMap.set(nameKey, {
            pullUp: getMetricByAttempt(row, ["ดึงข้อ"], 1),
            pushUp: getMetricByAttempt(row, ["ดันพื้น"], 1),
            sitUp: getMetricByAttempt(row, ["ลุกนั่ง"], 1),
            run2Miles: getMetricByAttempt(row, ["วิ่ง", "2", "ไมล์"], 1),
            swim100m: getMetricByAttempt(row, ["ว่ายน้ำ", "100"], 1),
            pullUp2: getMetricByAttempt(row, ["ดึงข้อ"], 2),
            pushUp2: getMetricByAttempt(row, ["ดันพื้น"], 2),
            sitUp2: getMetricByAttempt(row, ["ลุกนั่ง"], 2),
            run2Miles2: getMetricByAttempt(row, ["วิ่ง", "2", "ไมล์"], 2),
            swim100m2: getMetricByAttempt(row, ["ว่ายน้ำ", "100"], 2),
          });
          
          ptRawMap.set(nameKey, row);
        });

        mergedStudents = mergedStudents.map((student) => {
          const key = normalizeName(student.searchableName || `${student.firstName}${student.lastName}`);
          const ptScore = ptMap.get(key);
          if (!ptScore) return student;
          const summary = [ptScore.pullUp, ptScore.pushUp, ptScore.sitUp, ptScore.run2Miles, ptScore.swim100m]
            .filter((value) => value !== "")
            .join(" | ");
          return {
            ...student,
            physicalTestScore: summary,
            ptPullUp: ptScore.pullUp,
            ptPushUp: ptScore.pushUp,
            ptSitUp: ptScore.sitUp,
            ptRun2Miles: ptScore.run2Miles,
            ptSwim100m: ptScore.swim100m,
            pt2PullUp: ptScore.pullUp2,
            pt2PushUp: ptScore.pushUp2,
            pt2SitUp: ptScore.sitUp2,
            pt2Run2Miles: ptScore.run2Miles2,
            pt2Swim100m: ptScore.swim100m2,
            raw: {
              ...student.raw,
              "ดึงข้อ ครั้งที่ 1 (PTtest 69)": ptScore.pullUp,
              "ดันพื้น ครั้งที่ 1 (PTtest 69)": ptScore.pushUp,
              "ลุกนั่ง ครั้งที่ 1 (PTtest 69)": ptScore.sitUp,
              "วิ่ง 2 ไมล์ ครั้งที่ 1 (PTtest 69)": ptScore.run2Miles,
              "ว่ายน้ำ 100 ม. ครั้งที่ 1 (PTtest 69)": ptScore.swim100m,
              "ดึงข้อ ครั้งที่ 2 (PTtest 69)": ptScore.pullUp2,
              "ดันพื้น ครั้งที่ 2 (PTtest 69)": ptScore.pushUp2,
              "ลุกนั่ง ครั้งที่ 2 (PTtest 69)": ptScore.sitUp2,
              "วิ่ง 2 ไมล์ ครั้งที่ 2 (PTtest 69)": ptScore.run2Miles2,
              "ว่ายน้ำ 100 ม. ครั้งที่ 2 (PTtest 69)": ptScore.swim100m2,
              "คะแนนเทสร่างกาย": summary,
            },
            sheetData: {
              ...student.sheetData,
              "PTtest 69": ptRawMap.get(key) || {},
            },
          };
        });
      }
    } catch {
      // ignore
    }
  }

  // Fetch extra specific sheets that contain arbitrary columns
  const EXTRA_SHEET_NAMES = ["ExtRawdata", "ที่อยู่เมื่อพักบ้าน"];
  for (const sheetName of EXTRA_SHEET_NAMES) {
    try {
      const url = buildSheetByNameUrl(csvUrl, sheetName);
      if (url) {
        const extraResp = await fetch(url);
        if (extraResp.ok) {
          const extraCsvText = await extraResp.text();
          // Make sure it doesn't return HTML like a Google login page
          if (extraCsvText.startsWith("<!DOCTYPE html>") || extraCsvText.startsWith("<html")) {
            continue;
          }
          const rows = await parseSimpleCsvRows(extraCsvText);

          const sheetMap = new Map<string, Record<string, string>>();
          rows.forEach((row) => {
            const nameKey = normalizeName(
              getFirstNonEmpty(row, ["ชื่อค้นหา"]) ||
                `${getFirstNonEmpty(row, ["ชื่อ"])}${getFirstNonEmpty(row, ["นามสกุล"])}`,
            );
            if (nameKey) sheetMap.set(nameKey, row);
          });

          mergedStudents = mergedStudents.map((student) => {
            const key = normalizeName(student.searchableName || `${student.firstName}${student.lastName}`);
            const extraData = sheetMap.get(key);
            if (!extraData) return student;
            // Filter out empty columns to not overwrite existing populated ones with blanks
            const cleanedExtraData = Object.entries(extraData).reduce<Record<string, string>>((acc, [k, v]) => {
              if (v !== "") acc[k] = v;
              return acc;
            }, {});
            
            return {
              ...student,
              raw: { ...student.raw, ...cleanedExtraData },
              sheetData: {
                ...student.sheetData,
                [sheetName]: cleanedExtraData,
              },
            };
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return mergedStudents;
};

export const pushStudentUpdate = async (
  updateUrl: string,
  payload: StudentUpdateRequest,
): Promise<void> => {
  const response = await fetch(updateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to persist update to backend endpoint");
  }
};
