import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendPage } from "./components/BackendPage";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { fetchStudents, pushStudentUpdate } from "./services/studentService";
import type { StudentRecord } from "./types/student";
import { buildStudentDisplayName, filterStudents } from "./utils/search";

const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1f9PRgmIVv8AxQyP-oaCN00xz_Il0Kgl0sKhB_BIgRu8/export?format=csv&gid=1129857548";
const SHEET_CSV_URL = import.meta.env.VITE_SHEET_CSV_URL ?? DEFAULT_SHEET_CSV_URL;
const SHEET_UPDATE_URL = import.meta.env.VITE_SHEET_UPDATE_URL;
const isPositiveMetric = (value: string): boolean | null => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric > 0;
};

function App() {
  const [data, setData] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ข้อมูลหลัก (Rawdata)");
  const debouncedQuery = useDebouncedValue(searchQuery, 250);

  const openDetailView = (student: StudentRecord) => {
    setSelectedStudent(student);
    if (student.sheetData && Object.keys(student.sheetData).length > 0) {
      setActiveTab(Object.keys(student.sheetData)[0]);
    } else {
      setActiveTab("ข้อมูลหลัก (Rawdata)");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const students = await fetchStudents(SHEET_CSV_URL);
      setData(students);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);



  useEffect(() => {
    if (!selectedStudent) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedStudent(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedStudent]);

  const filteredStudents = useMemo(() => {
    return filterStudents(data, debouncedQuery, 50);
  }, [data, debouncedQuery]);
  const isBackendPage = window.location.pathname === "/backend";
  const updateStudent = useCallback(async (key: string, patch: Partial<StudentRecord>) => {
    if (SHEET_UPDATE_URL) {
      await pushStudentUpdate(SHEET_UPDATE_URL, {
        sourceCsvUrl: SHEET_CSV_URL,
        studentKey: key,
        raw: patch.raw ?? {},
      });
    }

    setData((prev) =>
      prev.map((student) => {
        const studentKey = `${student.sequence}-${student.studentId || student.searchableName}`;
        if (studentKey !== key) return student;
        const nextRaw = patch.raw ? { ...student.raw, ...patch.raw } : student.raw;
        const fromRaw = (field: string, fallback: string): string => {
          const value = nextRaw[field];
          return typeof value === "string" && value.trim() !== "" ? value : fallback;
        };
        return {
          ...student,
          ...patch,
          firstName: fromRaw("ชื่อ", patch.firstName ?? student.firstName),
          lastName: fromRaw("นามสกุล", patch.lastName ?? student.lastName),
          nickname: fromRaw("ชื่อเล่น", patch.nickname ?? student.nickname),
          searchableName: fromRaw("ชื่อค้นหา", patch.searchableName ?? student.searchableName),
          studentId: fromRaw("รหัส นตท.", patch.studentId ?? student.studentId),
          phoneNumber: fromRaw("หมายเลขโทรศัพท์", patch.phoneNumber ?? student.phoneNumber),
          previousSchool: fromRaw(
            "สถานศึกษาก่อนเข้า รร.ตท.",
            patch.previousSchool ?? student.previousSchool,
          ),
          hometown: fromRaw("ภูมิลำเนาเดิม", patch.hometown ?? student.hometown),
          birthDate: fromRaw("วัน/เดือน/ปีเกิด", patch.birthDate ?? student.birthDate),
          age: fromRaw("อายุ", patch.age ?? student.age),
          bloodType: fromRaw("กรุ๊บเลือด", patch.bloodType ?? student.bloodType),
          religion: fromRaw("ศาสนา", patch.religion ?? student.religion),
          ptPullUp: fromRaw("ดึงข้อ ครั้งที่ 1 (PTtest 69)", patch.ptPullUp ?? student.ptPullUp),
          ptPushUp: fromRaw("ดันพื้น ครั้งที่ 1 (PTtest 69)", patch.ptPushUp ?? student.ptPushUp),
          ptSitUp: fromRaw("ลุกนั่ง ครั้งที่ 1 (PTtest 69)", patch.ptSitUp ?? student.ptSitUp),
          ptRun2Miles: fromRaw(
            "วิ่ง 2 ไมล์ ครั้งที่ 1 (PTtest 69)",
            patch.ptRun2Miles ?? student.ptRun2Miles,
          ),
          ptSwim100m: fromRaw(
            "ว่ายน้ำ 100 ม. ครั้งที่ 1 (PTtest 69)",
            patch.ptSwim100m ?? student.ptSwim100m,
          ),
          pt2PullUp: fromRaw("ดึงข้อ ครั้งที่ 2 (PTtest 69)", patch.pt2PullUp ?? student.pt2PullUp),
          pt2PushUp: fromRaw("ดันพื้น ครั้งที่ 2 (PTtest 69)", patch.pt2PushUp ?? student.pt2PushUp),
          pt2SitUp: fromRaw("ลุกนั่ง ครั้งที่ 2 (PTtest 69)", patch.pt2SitUp ?? student.pt2SitUp),
          pt2Run2Miles: fromRaw(
            "วิ่ง 2 ไมล์ ครั้งที่ 2 (PTtest 69)",
            patch.pt2Run2Miles ?? student.pt2Run2Miles,
          ),
          pt2Swim100m: fromRaw(
            "ว่ายน้ำ 100 ม. ครั้งที่ 2 (PTtest 69)",
            patch.pt2Swim100m ?? student.pt2Swim100m,
          ),
          raw: {
            ...nextRaw,
            ...(patch.firstName !== undefined ? { ชื่อ: patch.firstName } : {}),
            ...(patch.lastName !== undefined ? { นามสกุล: patch.lastName } : {}),
            ...(patch.nickname !== undefined ? { ชื่อเล่น: patch.nickname } : {}),
            ...(patch.phoneNumber !== undefined ? { หมายเลขโทรศัพท์: patch.phoneNumber } : {}),
            ...(patch.previousSchool !== undefined
              ? { "สถานศึกษาก่อนเข้า รร.ตท.": patch.previousSchool }
              : {}),
            ...(patch.ptPullUp !== undefined ? { "ดึงข้อ ครั้งที่ 1 (PTtest 69)": patch.ptPullUp } : {}),
            ...(patch.ptPushUp !== undefined ? { "ดันพื้น ครั้งที่ 1 (PTtest 69)": patch.ptPushUp } : {}),
            ...(patch.ptSitUp !== undefined ? { "ลุกนั่ง ครั้งที่ 1 (PTtest 69)": patch.ptSitUp } : {}),
            ...(patch.ptRun2Miles !== undefined
              ? { "วิ่ง 2 ไมล์ ครั้งที่ 1 (PTtest 69)": patch.ptRun2Miles }
              : {}),
            ...(patch.ptSwim100m !== undefined
              ? { "ว่ายน้ำ 100 ม. ครั้งที่ 1 (PTtest 69)": patch.ptSwim100m }
              : {}),
            ...(patch.pt2PullUp !== undefined ? { "ดึงข้อ ครั้งที่ 2 (PTtest 69)": patch.pt2PullUp } : {}),
            ...(patch.pt2PushUp !== undefined ? { "ดันพื้น ครั้งที่ 2 (PTtest 69)": patch.pt2PushUp } : {}),
            ...(patch.pt2SitUp !== undefined ? { "ลุกนั่ง ครั้งที่ 2 (PTtest 69)": patch.pt2SitUp } : {}),
            ...(patch.pt2Run2Miles !== undefined
              ? { "วิ่ง 2 ไมล์ ครั้งที่ 2 (PTtest 69)": patch.pt2Run2Miles }
              : {}),
            ...(patch.pt2Swim100m !== undefined
              ? { "ว่ายน้ำ 100 ม. ครั้งที่ 2 (PTtest 69)": patch.pt2Swim100m }
              : {}),
          },
        };
      }),
    );

    await fetchData();
  }, [fetchData]);

  return (
    <div className="container">
      <div className="header">
        <h1>ค้นหาข้อมูลของ นนร.(ใหม่) 78</h1>
        <p>ระบบสืบค้นข้อมูลนนร.จากฐานข้อมูล</p>
      </div>

      {!isBackendPage && (
        <div className="search-box">
          <div className="search-input-wrapper">
            <svg className="search-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="พิมพ์ชื่อ, นามสกุล, ชื่อเล่น หรือรหัสนักเรียน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {!loading && debouncedQuery.trim() && (
            <div className="results-count">
              พบข้อมูล {filteredStudents.length} รายการ
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          เกิดข้อผิดพลาดในการโหลดข้อมูล: {error}
          <button type="button" className="retry-button" onClick={() => void fetchData()}>
            ลองใหม่
          </button>
        </div>
      )}

      {!loading && !error && !isBackendPage && (
        <div className="student-list">
          {filteredStudents.map((student, index) => (
            <div
              key={student.studentId || student.sequence || index}
              className="student-card"
              style={{ animationDelay: `${index * 0.05}s` }}
              role="button"
              tabIndex={0}
              onClick={() => openDetailView(student)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetailView(student);
                }
              }}
            >
              <div className="student-header">
                <div className="student-name">{buildStudentDisplayName(student) || "-"}</div>
                <div className="student-id">
                  รหัส: {student.studentId || "-"}
                </div>
              </div>

              <div className="student-body">
                <div className="info-group">
                  <span className="info-label">ภูมิลำเนา</span>
                  <span className="info-value">{student.hometown || "-"}</span>
                </div>

                <div className="info-group">
                  <span className="info-label">วันเกิด / อายุ</span>
                  <span className="info-value">
                    {student.birthDate || "-"}
                    {student.age && student.age !== "-" ? ` (อายุ ${student.age} ปี)` : ""}
                  </span>
                </div>

                <div className="info-group">
                  <span className="info-label">เบอร์โทรศัพท์</span>
                  <span className="info-value">{student.phoneNumber || "-"}</span>
                </div>
              </div>
            </div>
          ))}

          {debouncedQuery.trim() && filteredStudents.length === 0 && (
            <div className="empty-state">
              ไม่พบข้อมูลที่ตรงกับ "{debouncedQuery}"
            </div>
          )}

          {!debouncedQuery.trim() && (
            <div className="empty-state" style={{ border: "none" }}>
              กรุณาพิมพ์คำค้นหาเพื่อเริ่มค้นหาประวัตินักเรียน
            </div>
          )}
        </div>
      )}

      {!loading && !error && isBackendPage && (
        <BackendPage 
          students={data} 
          sheetUrl={SHEET_CSV_URL}
          onRefresh={fetchData}
          onUpdateStudent={updateStudent} 
        />
      )}

      {selectedStudent && (
        <div className="student-modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div
            className="student-modal"
            role="dialog"
            aria-modal="true"
            aria-label="รายละเอียดนักเรียน"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="student-modal-header">
              <div>
                <h2>{buildStudentDisplayName(selectedStudent) || "-"}</h2>
                <p>รหัสนักเรียน: {selectedStudent.studentId || "-"}</p>
              </div>
              <button
                type="button"
                className="student-modal-close"
                onClick={() => setSelectedStudent(null)}
              >
                ปิด
              </button>
            </div>

            <div className="student-modal-grid">
              <section className="detail-section detail-section-full">
                <h3>ข้อมูลแยกตามชีทหลัก</h3>
                
                {selectedStudent.sheetData && Object.keys(selectedStudent.sheetData).length > 0 ? (
                  <>
                    <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
                      {Object.keys(selectedStudent.sheetData).map(sheetName => (
                        <button
                          key={sheetName}
                          onClick={() => setActiveTab(sheetName)}
                          style={{
                            padding: "8px 16px",
                            border: "none",
                            background: activeTab === sheetName ? "#0ea5e9" : "#f1f5f9",
                            color: activeTab === sheetName ? "white" : "#475569",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: activeTab === sheetName ? "bold" : "normal",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {sheetName}
                        </button>
                      ))}
                    </div>

                    <div className="detail-list">
                      {Object.entries(selectedStudent.sheetData[activeTab] || {}).map(([field, value]) => {
                        const status =
                          field.includes("ดึงข้อ") ||
                          field.includes("ดันพื้น") ||
                          field.includes("ลุกนั่ง") ||
                          (field.includes("วิ่ง") && field.includes("ไมล์")) ||
                          (field.includes("ว่ายน้ำ") && field.includes("100"))
                            ? isPositiveMetric(value)
                            : null;
                        return (
                          <div className="detail-row" key={field}>
                            <span>{field}</span>
                            <strong>
                              {value || "-"}
                              {status !== null && (
                                <span className={status ? "metric-badge pass" : "metric-badge fail"} style={{ marginLeft: "4px" }}>
                                  {status ? "ผ่าน" : "ไม่ผ่าน"}
                                </span>
                              )}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="detail-list">
                    {/* Fallback array if no sheetData provided */}
                    {Object.entries(selectedStudent.raw).map(([field, value]) => {
                      const status =
                        field.includes("ดึงข้อ") ||
                        field.includes("ดันพื้น") ||
                        field.includes("ลุกนั่ง") ||
                        (field.includes("วิ่ง") && field.includes("ไมล์")) ||
                        (field.includes("ว่ายน้ำ") && field.includes("100"))
                          ? isPositiveMetric(value)
                          : null;
                      return (
                        <div className="detail-row" key={field}>
                          <span>{field}</span>
                          <strong>
                            {value || "-"}
                            {status !== null && (
                              <span className={status ? "metric-badge pass" : "metric-badge fail"} style={{ marginLeft: "4px" }}>
                                {status ? "ผ่าน" : "ไม่ผ่าน"}
                              </span>
                            )}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
