import { useMemo, useState } from "react";
import type { StudentRecord } from "../types/student";
import { buildStudentDisplayName } from "../utils/search";

interface BackendPageProps {
  students: StudentRecord[];
  sheetUrl: string;
  onRefresh: () => Promise<void>;
  onUpdateStudent: (key: string, patch: Partial<StudentRecord>) => Promise<void>;
}

const DEFAULT_COLUMNS = ["ลำดับที่", "รหัส นตท.", "ชื่อ-สกุล", "จัดการ"];

const isPositiveMetric = (value: string): boolean | null => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric > 0;
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

  const startEdit = (student: StudentRecord) => {
    const key = getStudentKey(student);
    setEditingKey(key);
    setDraftRaw({ ...student.raw });
  };

  const openDetail = (student: StudentRecord) => {
    setSelectedStudent(student);
    setEditingKey(null);
    setDraftRaw({});
    setSaveState("idle");
    setSaveMessage("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftRaw({});
    setSaveState("idle");
    setSaveMessage("");
  };

  const saveEdit = async () => {
    if (!editingKey) return;
    try {
      setSaveState("saving");
      setSaveMessage("กำลังบันทึกข้อมูล...");
      await onUpdateStudent(editingKey, { raw: draftRaw });
      setSaveState("success");
      setSaveMessage("บันทึกสำเร็จและซิงก์ข้อมูลล่าสุดแล้ว");
      setSelectedStudent(null);
      cancelEdit();
    } catch (error: unknown) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  };

  const allColumns = useMemo(() => {
    if (students.length === 0) return DEFAULT_COLUMNS;
    const keys = new Set<string>();
    // Collect all keys from all students
    students.forEach((s) => {
      Object.keys(s.raw).forEach((k) => keys.add(k));
    });
    // Order columns logically
    const firstCols = ["ลำดับที่", "รหัส นตท.", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่อข้นหา", "ภูมิลำเนาเดิม"];
    const otherCols = Array.from(keys).filter((k) => !firstCols.includes(k) && k !== "คำนำหน้า"); // Filter out if already in firstCols
    const finalCols = [];
    for (const col of firstCols) {
      if (keys.has(col)) finalCols.push(col);
    }
    finalCols.push(...otherCols);
    return finalCols;
  }, [students]);

  return (
    <section className="backend-page">
      <div className="backend-header">
        <h2>หน้า Backend</h2>
        <p>จัดการและตรวจสอบข้อมูลนักเรียนทั้งหมด</p>
        <div className="backend-sheet-info" style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong>แหล่งข้อมูล: </strong> 
              <a href={getEditUrl(sheetUrl)} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'underline', wordBreak: 'break-all' }}>
                เปิด Google Sheet ต้นทาง
              </a>
            </div>
            <button 
              type="button" 
              onClick={() => void handleRefresh()}
              disabled={refreshCooldown > 0}
              style={{ 
                padding: '6px 12px', 
                fontSize: '13px', 
                cursor: refreshCooldown > 0 ? 'not-allowed' : 'pointer',
                backgroundColor: refreshCooldown > 0 ? '#cbd5e1' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
            >
              {refreshCooldown > 0 ? `รอ ${refreshCooldown} วินาที...` : "รีเฟรชข้อมูล (Sync)"}
            </button>
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
            URL: {sheetUrl}
          </div>
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

      <div className="backend-table-wrap" style={{ overflowX: "auto" }}>
        <table className="backend-table" style={{ whiteSpace: "nowrap" }}>
          <thead>
            <tr>
              {allColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              <th style={{ position: 'sticky', right: 0, backgroundColor: '#f1f5f9', zIndex: 1 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={`${student.sequence}-${student.studentId}`}>
                {allColumns.map((col) => {
                  const val = student.raw[col];
                  const status =
                    col.includes("ดึงข้อ") ||
                    col.includes("ดันพื้น") ||
                    col.includes("ลุกนั่ง") ||
                    (col.includes("วิ่ง") && col.includes("ไมล์")) ||
                    (col.includes("ว่ายน้ำ") && col.includes("100"))
                      ? isPositiveMetric(val)
                      : null;
                  
                  return (
                    <td key={col}>
                      {val || "-"}
                      {status !== null && (
                        <span className={status ? "metric-badge pass" : "metric-badge fail"} style={{ marginLeft: 4 }}>
                          {status ? "ผ่าน" : "ไม่ผ่าน"}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td style={{ position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 1, boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>
                  <button type="button" className="backend-action edit" onClick={() => openDetail(student)}>
                    ดู/แก้ไขรายละเอียด
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={allColumns.length + 1} className="backend-empty">
                  ไม่พบข้อมูลที่ตรงกับคำค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <div className="student-modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="student-modal" onClick={(event) => event.stopPropagation()}>
            <div className="student-modal-header">
              <div>
                <h2>{buildStudentDisplayName(selectedStudent)}</h2>
                <p>รหัสนักเรียน: {selectedStudent.studentId || "-"}</p>
              </div>
              <button type="button" className="student-modal-close" onClick={() => setSelectedStudent(null)}>
                ปิด
              </button>
            </div>

            <div className="student-modal-grid">
              <section className="detail-section detail-section-full">
                <h3>ข้อมูลทั้งหมดของคนนี้</h3>
                <div className="detail-list">
                  {Object.entries(selectedStudent.raw).map(([field, value]) => {
                    const currentValue =
                      editingKey === getStudentKey(selectedStudent)
                        ? (draftRaw[field] ?? "")
                        : value;
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
                        {editingKey === getStudentKey(selectedStudent) ? (
                          <input
                            className="backend-cell-input"
                            value={currentValue}
                            onChange={(event) =>
                              setDraftRaw((prev) => ({ ...prev, [field]: event.target.value }))
                            }
                          />
                        ) : (
                          <strong className="backend-detail-value">
                            {currentValue || "-"}
                            {status !== null && (
                              <span
                                className={status ? "metric-badge pass" : "metric-badge fail"}
                              >
                                {status ? "ผ่าน" : "ปรับปรุง"}
                              </span>
                            )}
                          </strong>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="backend-detail-actions">
              {saveState !== "idle" && <p className={`save-status ${saveState}`}>{saveMessage}</p>}
              {editingKey === getStudentKey(selectedStudent) ? (
                <div className="backend-action-group">
                  <button type="button" className="backend-action save" onClick={() => void saveEdit()}>
                    บันทึกการแก้ไข
                  </button>
                  <button type="button" className="backend-action cancel" onClick={cancelEdit}>
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button type="button" className="backend-action edit" onClick={() => startEdit(selectedStudent)}>
                  แก้ไขข้อมูลนี้
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
