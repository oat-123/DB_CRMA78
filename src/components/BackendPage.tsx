import { useMemo, useState } from "react";
import type { StudentRecord } from "../types/student";
import { buildStudentDisplayName } from "../utils/search";
import { UrineTrendChart, TempTrendChart } from "./HealthCharts";

interface BackendPageProps {
  students: StudentRecord[];
  sheetUrl: string;
  onRefresh: () => Promise<void>;
  onUpdateStudent: (key: string, patch: Partial<StudentRecord>, sourceUrl: string) => Promise<void>;
}

const DEFAULT_COLUMNS = ["ลำดับที่", "รหัส นตท.", "ชื่อ-สกุล", "จัดการ"];

const isPositiveMetric = (value: string): boolean | null => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric > 0;
};

const getUrineColorClass = (value: string): string => {
  const lower = (value || "").toLowerCase();
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
  if (num >= 37.6) return "temp-mild-fever";
  if (num >= 35.5) return "temp-normal";
  return "temp-low";
};

const getEditUrl = (url: string) => {
  if (url.includes("/export?") || url.includes("/export/")) {
    const match = url.match(/\/d\/([^/]+)/);
    const gidMatch = url.match(/gid=(\d+)/);
    if (match) {
      const gid = gidMatch ? `#gid=${gidMatch[1]}` : "";
      return `https://docs.google.com/spreadsheets/d/${match[1]}/edit${gid}`;
    }
  }
  return url;
};

export function BackendPage({ students, sheetUrl, onRefresh, onUpdateStudent }: BackendPageProps) {
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftRaw, setDraftRaw] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("ข้อมูลหลัก (Rawdata)");

  const handleRefresh = async () => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(10);
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    try {
      await onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return students;
    return students.filter((student) => {
      const fullName = buildStudentDisplayName(student).toLowerCase();
      return (
        fullName.includes(normalized) ||
        student.studentId.toLowerCase().includes(normalized) ||
        student.nickname.toLowerCase().includes(normalized) ||
        student.phoneNumber.toLowerCase().includes(normalized)
      );
    });
  }, [students, query]);

  const getStudentKey = (student: StudentRecord): string =>
    `${student.sequence}-${student.studentId || student.searchableName}`;

  const openDetail = (student: StudentRecord) => {
    setSelectedStudent(student);
    setEditingKey(null);
    setDraftRaw({});
    setSaveState("idle");
    setSaveMessage("");
    if (student.sheetData && Object.keys(student.sheetData).length > 0) {
      const tabs = Object.keys(student.sheetData);
      setActiveTab(tabs.includes(activeTab) ? activeTab : tabs[0]);
    } else {
      setActiveTab("อ้างอิงรวม");
    }
  };

  const startEdit = (student: StudentRecord) => {
    const key = getStudentKey(student);
    setEditingKey(key);
    // Make ALL data from the currently active tab editable
    setDraftRaw({ ...student.sheetData?.[activeTab] });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftRaw({});
    setSaveState("idle");
    setSaveMessage("");
  };

  const saveEdit = async () => {
    if (!editingKey || !selectedStudent) return;
    try {
      setSaveState("saving");
      setSaveMessage("กำลังบันทึกข้อมูลไปยัง Google Sheet...");
      
      // Get the correct source URL for the active tab from metadata
      const sourceUrl = (selectedStudent.sheetData?.[activeTab] as any)?.__source_url__ || sheetUrl;
      
      await onUpdateStudent(editingKey, { raw: draftRaw }, sourceUrl);
      
      setSaveState("success");
      setSaveMessage("บันทึกข้อมูลลงชีทสำเร็จแล้ว!");
      
      // Refresh local state without closing the modal
      setTimeout(() => {
        setSaveState("idle");
        setEditingKey(null);
      }, 1500);
    } catch (error: unknown) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <section className="backend-page">
      <div className="backend-header">
        <h2>หน้า Backend</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <p>จัดการและตรวจสอบข้อมูลนักเรียนทั้งหมด</p>
          <button 
            type="button" 
            onClick={() => void handleRefresh()}
            disabled={refreshCooldown > 0}
            style={{ 
              padding: '8px 16px', 
              fontSize: '13px', 
              cursor: refreshCooldown > 0 ? 'not-allowed' : 'pointer',
              backgroundColor: refreshCooldown > 0 ? '#cbd5e1' : '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
            }}
          >
            {refreshCooldown > 0 ? `รอ ${refreshCooldown} วินาที...` : "รีเฟรชข้อมูล (Sync)"}
          </button>
        </div>
      </div>

      <div className="backend-stats">
        <div className="backend-stat-card">
          <span>จำนวนทั้งหมด</span>
          <strong>{students.length}</strong>
        </div>
        <div className="backend-stat-card">
          <span>ผลลัพธ์ที่แสดง</span>
          <strong>{filtered.length}</strong>
        </div>
      </div>

      <div className="backend-toolbar">
        <input
          type="text"
          className="backend-input"
          placeholder="ค้นหาในหลังบ้าน (ชื่อ, รหัส, ชื่อเล่น, เบอร์)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="backend-table-wrap">
        <table className="backend-table">
          <thead>
            <tr>
              {DEFAULT_COLUMNS.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={`${student.sequence}-${student.studentId}`}>
                <td>{student.sequence || "-"}</td>
                <td>{student.studentId || "-"}</td>
                <td>{buildStudentDisplayName(student)}</td>
                <td>
                  <button type="button" className="backend-action edit" onClick={() => openDetail(student)}>
                    ดูรายละเอียด / แก้ไข
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={DEFAULT_COLUMNS.length} className="backend-empty">
                  ไม่พบข้อมูลที่ตรงกับคำค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <div className="student-modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="student-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="student-modal-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h2>{buildStudentDisplayName(selectedStudent)}</h2>
                  <p>รหัสนักเรียน: {selectedStudent.studentId || "-"}</p>
                </div>
                <button type="button" className="student-modal-close" onClick={() => setSelectedStudent(null)}>
                  ปิด
                </button>
              </div>

              {selectedStudent.sheetData && Object.keys(selectedStudent.sheetData).length > 0 && (
                <>
                  <h3 style={{ fontSize: "0.95rem", color: "#334155", marginBottom: "0.5rem" }}>ข้อมูลรายชีท (คลิกแท็บเพื่อเปรียบเทียบหรือแก้ไข)</h3>
                  <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                    {Object.keys(selectedStudent.sheetData).map(sheetName => (
                      <button
                        key={sheetName}
                        onClick={() => {
                          setActiveTab(sheetName);
                          setEditingKey(null); // Cancel current edit if tab changes
                        }}
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
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#0369a1' }}>
                    <strong>แหล่งข้อมูลของแท็บ {activeTab}:</strong>
                  </span>
                  <a 
                    href={getEditUrl((selectedStudent.sheetData?.[activeTab] as any)?.__source_url__ || sheetUrl)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    แก้ไขใน Google Sheet
                  </a>
                </div>
                <div className="detail-list" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  {Object.entries(selectedStudent.sheetData?.[activeTab] || {}).map(([field, value]) => {
                    if (field === "__custom_renderer__" || field === "__source_url__") return null;

                    const isEdit = editingKey === getStudentKey(selectedStudent);
                    const isHealthTab = (activeTab === "สีปัสสาวะ (เม.ย.)" || activeTab === "อุณหภูมิ (เม.ย.)") && 
                                      (selectedStudent.urineColorData || selectedStudent.temperatureData);

                    if (isHealthTab && !isEdit) {
                      return null;
                    }

                    if (field.startsWith("---") && field.endsWith("---")) {
                      return (
                        <div key={field} style={{ gridColumn: "1 / -1", marginTop: "12px", marginBottom: "4px", background: "#f8fafc", padding: "6px 12px", borderRadius: "4px", borderLeft: "4px solid #0ea5e9", fontWeight: "bold", color: "#334155" }}>
                          {field.replace(/---/g, "").trim()}
                        </div>
                      );
                    }

                    const currentValue = isEdit ? (draftRaw[field] ?? "") : value;
                    const status =
                      field.includes("ดึงข้อ") ||
                      field.includes("ดันพื้น") ||
                      field.includes("ลุกนั่ง") ||
                      (field.includes("วิ่ง") && field.includes("ไมล์")) ||
                      (field.includes("ว่ายน้ำ") && field.includes("100"))
                        ? isPositiveMetric(currentValue)
                        : null;

                    return (
                      <div className="detail-row" key={field}>
                        <span>{field}</span>
                        {isEdit ? (
                          <input
                            className="backend-cell-input"
                            value={currentValue}
                            onChange={(e) => setDraftRaw(prev => ({ ...prev, [field]: e.target.value }))}
                            style={{ 
                              width: '100%', 
                              padding: '4px 8px', 
                              border: '1px solid #cbd5e1', 
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                          />
                        ) : (
                          <strong className="backend-detail-value">
                            {currentValue || "-"}
                            {status !== null && (
                              <span className={status ? "metric-badge pass" : "metric-badge fail"}>
                                {status ? "ผ่าน" : "ปรับปรุง"}
                              </span>
                            )}
                          </strong>
                        )}
                      </div>
                    );
                  })}

                  {(activeTab === "สีปัสสาวะ (เม.ย.)" && !editingKey) && selectedStudent.urineColorData && (
                    <div className="urine-grid-container">
                      <UrineTrendChart data={selectedStudent.urineColorData} />
                      <div className="urine-legend" style={{ marginBottom: '1rem' }}>
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
                                <div className={`urine-indicator ${getUrineColorClass(data.morning)}`}>{formatUrineValue(data.morning)}</div>
                              </div>
                              <div className="slot">
                                <span className="slot-label">เย็น:</span>
                                <div className={`urine-indicator ${getUrineColorClass(data.evening)}`}>{formatUrineValue(data.evening)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(activeTab === "อุณหภูมิ (เม.ย.)" && !editingKey) && selectedStudent.temperatureData && (
                    <div className="urine-grid-container">
                      <TempTrendChart data={selectedStudent.temperatureData} />
                      <div className="urine-legend" style={{ marginBottom: '1rem' }}>
                        <div className="legend-item"><span className="urine-dot temp-normal"></span> ปกติ</div>
                        <div className="legend-item"><span className="urine-dot temp-mild-fever"></span> ไข้ต่ำ</div>
                        <div className="legend-item"><span className="urine-dot temp-high-fever"></span> ไข้สูง</div>
                      </div>
                      <div className="urine-calendar-grid">
                        {selectedStudent.temperatureData.map((data, idx) => (
                          <div key={idx} className="urine-day-card">
                            <div className="day-number">วันที่ {data.day}</div>
                            <div className="day-slots">
                              <div className="slot">
                                <span className="slot-label">เช้า:</span>
                                <div className={`urine-indicator ${getTempColorClass(data.morning)}`}>{data.morning || "-"}</div>
                              </div>
                              <div className="slot">
                                <span className="slot-label">เย็น:</span>
                                <div className={`urine-indicator ${getTempColorClass(data.evening)}`}>{data.evening || "-"}</div>
                              </div>
                              <div className="slot">
                                <span className="slot-label">ก่อนนอน:</span>
                                <div className={`urine-indicator ${getTempColorClass(data.beforeBed)}`}>{data.beforeBed || "-"}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="backend-detail-actions" style={{ marginTop: '2rem', padding: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
              {saveState !== "idle" && <p className={`save-status ${saveState}`} style={{ margin: 0, fontWeight: 'bold' }}>{saveMessage}</p>}
              {editingKey === getStudentKey(selectedStudent) ? (
                <div className="backend-action-group" style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="backend-action save" onClick={() => void saveEdit()} disabled={saveState === "saving"}>
                    บันทึกข้อมูลลง Google Sheet
                  </button>
                  <button type="button" className="backend-action cancel" onClick={cancelEdit} disabled={saveState === "saving"}>
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button type="button" className="backend-action edit" onClick={() => startEdit(selectedStudent)}>
                  แก้ไขข้อมูลในแท็บนี้
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
