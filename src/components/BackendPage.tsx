import { useMemo, useState } from "react";
import type { StudentRecord } from "../types/student";
import { buildStudentDisplayName } from "../utils/search";

interface BackendPageProps {
  students: StudentRecord[];
  onUpdateStudent: (key: string, patch: Partial<StudentRecord>) => Promise<void>;
}

const DEFAULT_COLUMNS = ["ลำดับที่", "รหัส นตท.", "ชื่อ-สกุล", "จัดการ"];

const isPositiveMetric = (value: string): boolean | null => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric > 0;
};

export function BackendPage({ students, onUpdateStudent }: BackendPageProps) {
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftRaw, setDraftRaw] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

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

  return (
    <section className="backend-page">
      <div className="backend-header">
        <h2>หน้า Backend</h2>
        <p>จัดการและตรวจสอบข้อมูลนักเรียนทั้งหมด</p>
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
                <td>
                  {buildStudentDisplayName(student)}
                </td>
                <td>
                  <button type="button" className="backend-action edit" onClick={() => openDetail(student)}>
                    ดูรายละเอียด
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
