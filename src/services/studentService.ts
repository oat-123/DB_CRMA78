import Papa from "papaparse";
import type { StudentRecord, UrineColorDay, TemperatureDay } from "../types/student";

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

export const mapRawRowToStudent = (row: Record<string, unknown>, mainUrl: string = ""): StudentRecord => {
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
    battalionCompany: getCellValue(row, "สังกัด"),
    platoonSquad: getFirstNonEmpty(row as Record<string, string>, ["มว/หมู่", "มว. หมู่"]),
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
      "ข้อมูลหลัก (Rawdata)": { ...raw, __source_url__: mainUrl },
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
  const attempt2Markers = ["ครั้งที่ 2", "คร้้งที่ 2", "_1", ".1"];

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

export const parseStudentCsv = (csvText: string, mainUrl: string = ""): Promise<StudentRecord[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(trimToHeader(csvText), {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const students = results.data
          .map((row) => mapRawRowToStudent(row, mainUrl))
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

const buildExternalSheetUrl = (sheetId: string, gid: string): string =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

const EXTERNAL_SOURCES: Array<{ label: string; url: string; nameKeys: string[] }> = [
  {
    label: "เจ็บป่วย",
    url: buildExternalSheetUrl("1QfJncCbq3OvU4eUeonWyn2tgTrm5Qq7omIZ7Hq4hj_Q", "0"),
    nameKeys: ["ชื่อค้นหา", "ชื่อ"],
  },
];

const URINE_COLOR_SHEET_URL = buildExternalSheetUrl(
  "16w4E7pnlGvmkZpYifmcSO0KDK80X7Ko6nvEuSBj31DI",
  "599870853",
);

const TEMP_SHEET_URL = buildExternalSheetUrl(
  "16w4E7pnlGvmkZpYifmcSO0KDK80X7Ko6nvEuSBj31DI",
  "2034317015",
);

const DATA_START_COL = 6;

const parseUrineColorCsv = async (
  csvText: string,
): Promise<Map<string, { data: UrineColorDay[]; raw: Record<string, string>; battalionCompany?: string; platoonSquad?: string }>> => {
  return new Promise((resolve) => {
    Papa.parse<string[]>(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const result = new Map<string, { data: UrineColorDay[]; raw: Record<string, string>; battalionCompany?: string; platoonSquad?: string }>();

        let headerIdx = -1;
        let dayRow: string[] = [];
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (rows[i][0]?.trim() === "ลำดับ") {
            headerIdx = i;
            if (i > 0) dayRow = rows[i - 1];
            break;
          }
        }

        if (headerIdx === -1) {
          resolve(result);
          return;
        }

        const rawDayHeaders: string[] = [];
        for (let c = DATA_START_COL; c < dayRow.length; c += 2) {
          const val = (dayRow[c] || "").trim();
          rawDayHeaders.push(val);
        }

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const firstName = (row[2] || "").trim();
          const lastName = (row[3] || "").trim();
          if (!firstName && !lastName) continue;

          const battalionCompany = (row[4] || "").trim();
          const platoonSquad = (row[5] || "").trim();

          const nameKey = normalizeName(`${firstName}${lastName}`);
          const days: UrineColorDay[] = [];

          for (let d = 0; d < rawDayHeaders.length; d++) {
            const mornIdx = DATA_START_COL + d * 2;
            const eveIdx = DATA_START_COL + d * 2 + 1;
            const morning = (row[mornIdx] || "").trim();
            const evening = (row[eveIdx] || "").trim();
            const dayLabel = rawDayHeaders[d] || (d + 1).toString();
            days.push({ day: dayLabel, morning, evening });
          }

          const rawHeaders = rows[headerIdx];
          const rawRow = rawHeaders.reduce<Record<string, string>>((acc, header, idx) => {
            if (header) acc[header] = (row[idx] || "").trim();
            return acc;
          }, {});
          result.set(nameKey, { data: days, raw: rawRow, battalionCompany, platoonSquad });
        }

        resolve(result);
      },
    });
  });
};

const parseTemperatureCsv = async (
  csvText: string,
): Promise<Map<string, { data: TemperatureDay[]; raw: Record<string, string>; battalionCompany?: string; platoonSquad?: string }>> => {
  return new Promise((resolve) => {
    Papa.parse<string[]>(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const result = new Map<string, { data: TemperatureDay[]; raw: Record<string, string>; battalionCompany?: string; platoonSquad?: string }>();

        let headerIdx = -1;
        let dayRow: string[] = [];
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (rows[i][0]?.trim() === "ลำดับ") {
            headerIdx = i;
            if (i > 0) dayRow = rows[i - 1];
            break;
          }
        }

        if (headerIdx === -1) {
          resolve(result);
          return;
        }

        const rawDayHeaders: string[] = [];
        for (let c = DATA_START_COL; c < dayRow.length; c += 3) {
          const val = (dayRow[c] || "").trim();
          rawDayHeaders.push(val);
        }

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const firstName = (row[2] || "").trim();
          const lastName = (row[3] || "").trim();
          if (!firstName && !lastName) continue;

          const battalionCompany = (row[4] || "").trim();
          const platoonSquad = (row[5] || "").trim();

          const nameKey = normalizeName(`${firstName}${lastName}`);
          const days: TemperatureDay[] = [];

          for (let d = 0; d < rawDayHeaders.length; d++) {
            const mornIdx = DATA_START_COL + d * 3;
            const eveIdx = DATA_START_COL + d * 3 + 1;
            const bedIdx = DATA_START_COL + d * 3 + 2;
            const morning = (row[mornIdx] || "").trim();
            const evening = (row[eveIdx] || "").trim();
            const beforeBed = (row[bedIdx] || "").trim();
            const dayLabel = rawDayHeaders[d] || (d + 1).toString();
            days.push({ day: dayLabel, morning, evening, beforeBed });
          }

          const rawHeaders = rows[headerIdx];
          const rawRow = rawHeaders.reduce<Record<string, string>>((acc, header, idx) => {
            if (header) acc[header] = (row[idx] || "").trim();
            return acc;
          }, {});
          result.set(nameKey, { data: days, raw: rawRow, battalionCompany, platoonSquad });
        }

        resolve(result);
      },
    });
  });
};

export const fetchStudents = async (csvUrl: string): Promise<StudentRecord[]> => {
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const csvText = await response.text();
  const students = await parseStudentCsv(csvText, csvUrl);
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
          const pttestRowFormatted: Record<string, string> = {
            "--- ทดสอบร่างกาย ครั้งที่ 1 ---": "",
            "ดึงข้อ (ครั้งที่ 1)": ptMap.get(nameKey)?.pullUp || "",
            "ดันพื้น (ครั้งที่ 1)": ptMap.get(nameKey)?.pushUp || "",
            "ลุกนั่ง (ครั้งที่ 1)": ptMap.get(nameKey)?.sitUp || "",
            "วิ่ง 2 ไมล์ (ครั้งที่ 1)": ptMap.get(nameKey)?.run2Miles || "",
            "ว่ายน้ำ 100 ม. (ครั้งที่ 1)": ptMap.get(nameKey)?.swim100m || "",
            "--- ทดสอบร่างกาย ครั้งที่ 2 ---": "",
            "ดึงข้อ (ครั้งที่ 2)": ptMap.get(nameKey)?.pullUp2 || "",
            "ดันพื้น (ครั้งที่ 2)": ptMap.get(nameKey)?.pushUp2 || "",
            "ลุกนั่ง (ครั้งที่ 2)": ptMap.get(nameKey)?.sitUp2 || "",
            "วิ่ง 2 ไมล์ (ครั้งที่ 2)": ptMap.get(nameKey)?.run2Miles2 || "",
            "ว่ายน้ำ 100 ม. (ครั้งที่ 2)": ptMap.get(nameKey)?.swim100m2 || "",
          };
          ptRawMap.set(nameKey, pttestRowFormatted);
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
              "PTtest 69": { ...(ptRawMap.get(key) || {}), __source_url__: ptUrl },
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
                [sheetName]: { ...cleanedExtraData, __source_url__: url },
              },
            };
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // Fetch external spreadsheets (illness records, urine color, etc.)
  for (const source of EXTERNAL_SOURCES) {
    try {
      const extResp = await fetch(source.url);
      if (!extResp.ok) continue;
      const extCsvText = await extResp.text();
      if (extCsvText.startsWith("<!DOCTYPE html") || extCsvText.startsWith("<html")) continue;

      const extRows = await parseSimpleCsvRows(extCsvText);

      // Build a map per name – a student may have multiple rows (e.g. multiple illness episodes)
      const extMap = new Map<string, Record<string, string>[]>();
      extRows.forEach((row) => {
        const nameKey = normalizeName(
          getFirstNonEmpty(row, ["ชื่อค้นหา"]) ||
            `${getFirstNonEmpty(row, ["ชื่อ"])}${getFirstNonEmpty(row, ["นามสกุล"])}`,
        );
        if (!nameKey) return;
        if (!extMap.has(nameKey)) extMap.set(nameKey, []);
        extMap.get(nameKey)!.push(row);
      });

      mergedStudents = mergedStudents.map((student) => {
        const key = normalizeName(student.searchableName || `${student.firstName}${student.lastName}`);
        const rows = extMap.get(key);
        if (!rows || rows.length === 0) return student;

        // Merge all rows for this student into a flattened display object
        // Multiple rows are merged with a numeric index suffix to avoid key collisions
        const merged: Record<string, string> = {};
        if (rows.length === 1) {
          Object.entries(rows[0]).forEach(([k, v]) => {
            if (v !== "") merged[k] = v;
          });
        } else {
          rows.forEach((row, idx) => {
            merged[`--- รายการที่ ${idx + 1} ---`] = "";
            Object.entries(row).forEach(([k, v]) => {
              if (v !== "") merged[`${k} [${idx + 1}]`] = v;
            });
          });
        }

        return {
          ...student,
          sheetData: {
            ...student.sheetData,
            [source.label]: merged,
          },
        };
      });
    } catch {
      // ignore individual source failures
    }
  }

  // Fetch urine color sheet with custom multi-row-header parser
  try {
    const urineResp = await fetch(URINE_COLOR_SHEET_URL);
    if (urineResp.ok) {
      const urineCsv = await urineResp.text();
      if (!urineCsv.startsWith("<!DOCTYPE html") && !urineCsv.startsWith("<html")) {
        const urineMap = await parseUrineColorCsv(urineCsv);

        mergedStudents = mergedStudents.map((student) => {
          const key = normalizeName(
            student.searchableName || `${student.firstName}${student.lastName}`,
          );
          const urineData = urineMap.get(key);
          if (!urineData) return student;

          return {
            ...student,
            urineColorData: urineData.data,
            sheetData: {
              ...student.sheetData,
              "สีปัสสาวะ (เม.ย.)": { 
                ...urineData.raw,
                "__custom_renderer__": "urineColor",
                "__source_url__": URINE_COLOR_SHEET_URL 
              },
            },
          };
        });
      }
    }
  } catch {
    // ignore
  }

  // Fetch temperature sheet
  try {
    const tempResp = await fetch(TEMP_SHEET_URL);
    if (tempResp.ok) {
      const tempCsv = await tempResp.text();
      if (!tempCsv.startsWith("<!DOCTYPE html") && !tempCsv.startsWith("<html")) {
        const tempMap = await parseTemperatureCsv(tempCsv);

        mergedStudents = mergedStudents.map((student) => {
          const key = normalizeName(
            student.searchableName || `${student.firstName}${student.lastName}`,
          );
          const tempData = tempMap.get(key);
          if (!tempData) return student;

          return {
            ...student,
            temperatureData: tempData.data,
            battalionCompany: student.battalionCompany || tempData.battalionCompany,
            platoonSquad: student.platoonSquad || tempData.platoonSquad,
            sheetData: {
              ...student.sheetData,
              "อุณหภูมิ (เม.ย.)": { 
                ...tempData.raw,
                "__custom_renderer__": "temperature",
                "__source_url__": TEMP_SHEET_URL 
              },
            },
          };
        });
      }
    }
  } catch {
    // ignore
  }

  // Same for urine to ensure battalion/squad are prioritized from these sheets
  try {
    const urineResp = await fetch(URINE_COLOR_SHEET_URL);
    if (urineResp.ok) {
      const urineCsv = await urineResp.text();
      const urineMap = await parseUrineColorCsv(urineCsv);
      mergedStudents = mergedStudents.map(student => {
        const key = normalizeName(student.firstName + student.lastName);
        const data = urineMap.get(key);
        if (!data) return student;
        return {
          ...student,
          battalionCompany: student.battalionCompany || data.battalionCompany,
          platoonSquad: student.platoonSquad || data.platoonSquad,
        };
      });
    }
  } catch {}

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
