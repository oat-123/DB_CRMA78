import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendPage } from "./components/BackendPage";
import { UrineTrendChart, TempTrendChart } from "./components/HealthCharts";
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

const getUrineColorClass = (value: string): string => {
  const lower = value.toLowerCase();
  if (lower.includes("4") || lower.includes("น้ำตาล")) return "urine-4";
  if (lower.includes("3") || lower.includes("เหลืองเข้ม")) return "urine-3";
  if (lower.includes("1") || lower.includes("เหลืองใส")) return "urine-1";
  if (lower.includes("2") || lower.includes("เหลือง")) return "urine-2";
  if (lower.includes("0") || lower.includes("ใส")) return "urine-0";
  return "urine-none";
};

const formatUrineValue = (value: string): string => {
  const v = (value || "").trim();
  if (v === "0") return "ใส";
  if (v === "1") return "เหลืองใส";
  if (v === "2") return "เหลือง";
  if (v === "3") return "เหลืองเข้ม";
  if (v === "4") return "น้ำตาล";
  return v || "-";
};

const getTempColorClass = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return "temp-none";
  if (num >= 38.5) return "temp-high-fever";
  if (num >= 37.0) return "temp-high-fever"; // 37.0+ is now red
  if (num >= 35.5) return "temp-normal";
  return "temp-low";
};

function App() {
  const [data, setData] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "fever" | "urine">("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedPlatoon, setSelectedPlatoon] = useState<string>("all");
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

  const stats = useMemo(() => {
    let feverCount = 0;
    let darkUrineCount = 0;
    
    data.forEach(s => {
      // Check latest temperature record
      if (s.temperatureData && s.temperatureData.length > 0) {
        const d = s.temperatureData[s.temperatureData.length - 1];
        const temps = [parseFloat(d.morning), parseFloat(d.evening), parseFloat(d.beforeBed)];
        if (temps.some(t => !isNaN(t) && t >= 37.0)) feverCount++;
      }

      // Check latest urine color record
      if (s.urineColorData && s.urineColorData.length > 0) {
        const d = s.urineColorData[s.urineColorData.length - 1];
        const vals = [d.morning, d.evening];
        if (vals.some(v => v === "3" || v === "4" || (v || "").includes("เข้ม") || (v || "").includes("น้ำตาล"))) darkUrineCount++;
      }
    });

    return { total: data.length, fever: feverCount, darkUrine: darkUrineCount };
  }, [data]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach(s => { if (s.battalionCompany) set.add(s.battalionCompany); });
    return Array.from(set).sort();
  }, [data]);

  const platoonOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach(s => {
      if (selectedUnit !== "all" && s.battalionCompany !== selectedUnit) return;
      if (s.platoonSquad) set.add(s.platoonSquad);
    });
    return Array.from(set).sort();
  }, [data, selectedUnit]);

  const filteredStudents = useMemo(() => {
    const list = filterStudents(data, debouncedQuery, 100);
    
    return list.filter(student => {
      // Unit/Platoon filters
      if (selectedUnit !== "all" && student.battalionCompany !== selectedUnit) return false;
      if (selectedPlatoon !== "all" && student.platoonSquad !== selectedPlatoon) return false;

      // Health filters
      if (filterType === "all") return true;
      if (filterType === "fever") {
        if (!student.temperatureData || student.temperatureData.length === 0) return false;
        const d = student.temperatureData[student.temperatureData.length - 1];
        const temps = [parseFloat(d.morning), parseFloat(d.evening), parseFloat(d.beforeBed)];
        return temps.some(t => !isNaN(t) && t >= 37.0);
      }
      if (filterType === "urine") {
        if (!student.urineColorData || student.urineColorData.length === 0) return false;
        const d = student.urineColorData[student.urineColorData.length - 1];
        const vals = [d.morning, d.evening];
        return vals.some(v => v === "3" || v === "4" || (v || "").includes("เข้ม") || (v || "").includes("น้ำตาล"));
      }
      return true;
    });
  }, [data, debouncedQuery, filterType, selectedUnit, selectedPlatoon]);
  const isBackendPage = window.location.pathname === "/backend";
  const updateStudent = useCallback(async (key: string, patch: Partial<StudentRecord>, sourceUrl: string) => {
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

    if (SHEET_UPDATE_URL) {
      try {
        await pushStudentUpdate(SHEET_UPDATE_URL, {
          sourceCsvUrl: sourceUrl, // Use the provided source URL
          studentKey: key,
          raw: patch.raw || {},
        });
      } catch (err) {
        console.error("Failed to push update to sheet:", err);
        throw err; // Re-throw to show error in UI
      }
    }

    await fetchData();
  }, [fetchData]);

  return (
    <div className="container">
      <div className="header">
        <h1>ค้นหาข้อมูลของ นนร.(ใหม่) 78</h1>
        <p>ระบบสืบค้นข้อมูล นนร.จากฐานข้อมูล</p>
      </div>

      {!isBackendPage && !loading && (
        <div className="dashboard-section" style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div className="stat-card" style={{ background: '#f0f9ff', padding: '16px', borderRadius: '14px', border: '1px solid #bae6fd', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 600 }}>นนร. ทั้งหมด</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0ea5e9' }}>{stats.total}</div>
          </div>
          <button 
            onClick={() => setFilterType(filterType === 'fever' ? 'all' : 'fever')}
            className={`stat-card ${filterType === 'fever' ? 'active' : ''}`}
            style={{ 
              background: filterType === 'fever' ? '#fef2f2' : '#ffffff', 
              padding: '16px', borderRadius: '14px', 
              border: filterType === 'fever' ? '1px solid #ef4444' : '1px solid #e2e8f0', 
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.8rem', color: filterType === 'fever' ? '#991b1b' : '#64748b', fontWeight: 600 }}>มีไข้ (≥37.0)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{stats.fever}</div>
          </button>
          <button 
            onClick={() => setFilterType(filterType === 'urine' ? 'all' : 'urine')}
            className={`stat-card ${filterType === 'urine' ? 'active' : ''}`}
            style={{ 
              background: filterType === 'urine' ? '#fffbeb' : '#ffffff', 
              padding: '16px', borderRadius: '14px', 
              border: filterType === 'urine' ? '1px solid #f59e0b' : '1px solid #e2e8f0', 
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.8rem', color: filterType === 'urine' ? '#92400e' : '#64748b', fontWeight: 600 }}>สีปัสสาวะเข้ม</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{stats.darkUrine}</div>
          </button>
        </div>
      )}

      {!isBackendPage && (
        <div className="search-box">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <select 
              value={selectedUnit} 
              onChange={(e) => { setSelectedUnit(e.target.value); setSelectedPlatoon("all"); }}
              style={{ flex: 1, minWidth: '140px', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '0.9rem' }}
            >
              <option value="all">ทุกสังกัด (พัน/ร้อย)</option>
              {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select 
              value={selectedPlatoon} 
              onChange={(e) => setSelectedPlatoon(e.target.value)}
              style={{ flex: 1, minWidth: '140px', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '0.9rem' }}
            >
              <option value="all">ทุก มว./หมู่</option>
              {platoonOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
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
          {!loading && (
            <div className="results-count" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>พบข้อมูล {filteredStudents.length} รายการ</span>
              {(filterType !== 'all' || selectedUnit !== 'all' || selectedPlatoon !== 'all') && (
                <button 
                  onClick={() => { setFilterType('all'); setSelectedUnit('all'); setSelectedPlatoon('all'); }} 
                  style={{ background: '#f1f5f9', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer' }}
                >
                  ล้างตัวกรอง
                </button>
              )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0ea5e9', letterSpacing: '0.025em' }}>ลำดับที่ {student.sequence || "-"}</div>
                    {/* Health Status Dots */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {student.temperatureData && student.temperatureData.length > 0 && (
                        (() => {
                          const d = student.temperatureData[student.temperatureData.length - 1];
                          const hasFever = [parseFloat(d.morning), parseFloat(d.evening), parseFloat(d.beforeBed)].some(t => t >= 37.0);
                          return hasFever ? <span title={`มีไข้ (วันที่ ${d.day})`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 4px #ef4444' }}></span> : null;
                        })()
                      )}
                      {student.urineColorData && student.urineColorData.length > 0 && (
                        (() => {
                          const d = student.urineColorData[student.urineColorData.length - 1];
                          const isDark = [d.morning, d.evening].some(v => v === "3" || v === "4" || (v || "").includes("เข้ม") || (v || "").includes("น้ำตาล"));
                          return isDark ? <span title={`ปัสสาวะเข้ม (วันที่ ${d.day})`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 4px #f59e0b' }}></span> : null;
                        })()
                      )}
                    </div>
                  </div>
                  <div className="student-name" style={{ fontSize: '1.2rem' }}>{buildStudentDisplayName(student) || "-"}</div>
                </div>
                <div className="student-id">
                  รหัส: {student.studentId || "-"}
                </div>
              </div>

              <div className="student-body">
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {student.battalionCompany && (
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>{student.battalionCompany}</span>
                  )}
                  {student.platoonSquad && (
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: '#f0f9ff', color: '#0ea5e9', border: '1px solid #e0f2fe' }}>{student.platoonSquad}</span>
                  )}
                </div>
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
          onUpdateStudent={(key: string, patch: Partial<StudentRecord>, url: string) => updateStudent(key, patch, url)}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0ea5e9', marginBottom: '4px' }}>ลำดับที่ {selectedStudent.sequence || "-"}</div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{buildStudentDisplayName(selectedStudent) || "-"}</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>รหัสนักเรียน: {selectedStudent.studentId || "-"}</p>
                </div>
                <button
                  type="button"
                  className="student-modal-close"
                  onClick={() => setSelectedStudent(null)}
                >
                  ปิด
                </button>
              </div>

              {selectedStudent.sheetData && Object.keys(selectedStudent.sheetData).length > 0 && (
                <>
                  <h3 style={{ fontSize: "0.95rem", color: "#334155", marginBottom: "0.75rem" }}>ข้อมูลแยกตามชีทหลัก</h3>
                  <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
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
                </>
              )}
            </div>

            <div className="student-modal-grid">
              <section className="detail-section detail-section-full" style={{ border: "none", background: "transparent", padding: "0" }}>
                {selectedStudent.sheetData && Object.keys(selectedStudent.sheetData).length > 0 ? (
                  <>
                    <div className="detail-list">
                      {Object.entries(selectedStudent.sheetData?.[activeTab] || {}).map(([field, value]) => {
                        if (field === "__custom_renderer__" || field === "__source_url__") return null;

                        if ((activeTab === "สีปัสสาวะ (เม.ย.)" || activeTab === "อุณหภูมิ (เม.ย.)") && 
                            (selectedStudent.urineColorData || selectedStudent.temperatureData)) {
                          return null; // Handle separately below
                        }

                        if (field.startsWith("---") && field.endsWith("---")) {
                          return (
                            <div key={field} style={{ gridColumn: "1 / -1", marginTop: "12px", marginBottom: "4px", background: "#f8fafc", padding: "6px 12px", borderRadius: "4px", borderLeft: "4px solid #0ea5e9", fontWeight: "bold", color: "#334155" }}>
                              {field.replace(/---/g, "").trim()}
                            </div>
                          );
                        }

                        const status =
                          field.includes("ดึงข้อ") ||
                            field.includes("ดันพื้น") ||
                            field.includes("ลุกนั่ง") ||
                            (field.includes("วิ่ง") && field.includes("ไมล์")) ||
                            (field.includes("ว่ายน้ำ") && field.includes("100"))
                            ? isPositiveMetric(value)
                            : null;

                        // PT Improvement Comparison
                        let improvement = "";
                        if (activeTab.includes("PTtest") && selectedStudent.sheetData) {
                           const compareField = field.includes("ครั้งที่ 1") 
                            ? field.replace("ครั้งที่ 1", "ครั้งที่ 2") 
                            : field.replace("ครั้งที่ 2", "ครั้งที่ 1");
                           
                           const otherValue = (selectedStudent.sheetData[activeTab] || {})[compareField];
                           if (otherValue && value && !field.includes("วิ่ง") && !field.includes("ว่ายน้ำ")) {
                             const vCurrent = parseFloat(value);
                             const vOther = parseFloat(otherValue);
                             if (!isNaN(vCurrent) && !isNaN(vOther)) {
                               const diff = field.includes("ครั้งที่ 2") ? vCurrent - vOther : vOther - vCurrent;
                               if (diff > 0) improvement = `(↑ ${diff})`;
                               else if (diff < 0) improvement = `(↓ ${Math.abs(diff)})`;
                             }
                           }
                        }

                        return (
                          <div className="detail-row" key={field}>
                            <span>{field}</span>
                            <strong>
                              {value || "-"}
                              {improvement && (
                                <span style={{ marginLeft: '6px', color: improvement.includes('↑') ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 800 }}>
                                  {improvement}
                                </span>
                              )}
                              {status !== null && (
                                <span className={status ? "metric-badge pass" : "metric-badge fail"} style={{ marginLeft: "4px" }}>
                                  {status ? "ผ่าน" : "ไม่ผ่าน"}
                                </span>
                              )}
                            </strong>
                          </div>
                        );
                      })}

                      {activeTab === "สีปัสสาวะ (เม.ย.)" && selectedStudent.urineColorData && (
                        <div className="urine-grid-container">
                          <UrineTrendChart data={selectedStudent.urineColorData} />
                          <div className="urine-legend">
                            <div className="legend-item"><span className="urine-dot urine-0"></span> ใส</div>
                            <div className="legend-item"><span className="urine-dot urine-1"></span> เหลืองใส</div>
                            <div className="legend-item"><span className="urine-dot urine-2"></span> เหลือง</div>
                            <div className="legend-item"><span className="urine-dot urine-3"></span> เหลืองเข้ม</div>
                            <div className="legend-item"><span className="urine-dot urine-4"></span> น้ำตาล</div>
                          </div>

                          <div className="urine-calendar-grid">
                            {selectedStudent.urineColorData.map((data, idx) => (
                              <div key={idx} className="urine-day-card">
                                <div className="day-number">วันที่ {data.day}</div>
                                <div className="day-slots">
                                  <div className="slot">
                                    <span className="slot-label">เช้า:</span>
                                    <div className={`urine-indicator ${getUrineColorClass(data.morning)}`}>
                                      {formatUrineValue(data.morning)}
                                    </div>
                                  </div>
                                  <div className="slot">
                                    <span className="slot-label">เย็น:</span>
                                    <div className={`urine-indicator ${getUrineColorClass(data.evening)}`}>
                                      {formatUrineValue(data.evening)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === "อุณหภูมิ (เม.ย.)" && selectedStudent.temperatureData && (
                        <div className="urine-grid-container">
                          <TempTrendChart data={selectedStudent.temperatureData} />
                          <div className="urine-legend">
                            <div className="legend-item"><span className="urine-dot temp-normal"></span> ปกติ (&lt; 37.0)</div>
                            <div className="legend-item"><span className="urine-dot temp-high-fever"></span> มีไข้ (≥ 37.0)</div>
                          </div>

                          <div className="urine-calendar-grid">
                            {selectedStudent.temperatureData.map((data, idx) => (
                              <div key={idx} className="urine-day-card">
                                <div className="day-number">วันที่ {data.day}</div>
                                <div className="day-slots">
                                  <div className="slot">
                                    <span className="slot-label">เช้า:</span>
                                    <div className={`urine-indicator ${getTempColorClass(data.morning)}`}>
                                      {data.morning || "-"}
                                    </div>
                                  </div>
                                  <div className="slot">
                                    <span className="slot-label">เย็น:</span>
                                    <div className={`urine-indicator ${getTempColorClass(data.evening)}`}>
                                      {data.evening || "-"}
                                    </div>
                                  </div>
                                  <div className="slot">
                                    <span className="slot-label">ก่อนนอน:</span>
                                    <div className={`urine-indicator ${getTempColorClass(data.beforeBed)}`}>
                                      {data.beforeBed || "-"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
