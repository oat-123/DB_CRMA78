import React, { useState, useRef } from 'react';
import type { UrineColorDay, TemperatureDay } from '../types/student';

interface TooltipState {
  x: number;
  y: number;
  label: string;
  value: string;
  visible: boolean;
}

interface PointData {
  x: number;
  y: number;
  val: number | null;
  day: string;
  type: string;
}

const getUrineValue = (value: string): number | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("4") || v.includes("น้ำตาล")) return 4;
  if (v.includes("3") || v.includes("เหลืองเข้ม")) return 3;
  if (v.includes("1") || v.includes("เหลืองใส")) return 1;
  if (v.includes("2") || v.includes("เหลือง")) return 2;
  if (v.includes("0") || v.includes("ใส")) return 0;
  
  const num = parseInt(v);
  if (!isNaN(num) && num >= 0 && num <= 4) return num;
  return null;
};

const getUrineName = (val: number): string => {
  const names = ["ใส", "เหลืองใส", "เหลือง", "เหลืองเข้ม", "น้ำตาล"];
  return names[val] || "N/A";
};

const getUrineColor = (val: number): string => {
  const colors = ["#ffffff", "#fff59d", "#fff176", "#fdd835", "#8d6e63"];
  return colors[val] || "#e2e8f0";
};

export const UrineTrendChart: React.FC<{ data: UrineColorDay[] }> = ({ data }) => {
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, label: '', value: '', visible: false });
  const containerRef = useRef<HTMLDivElement>(null);

  const height = 180;
  const padding = 40;
  const width = Math.max(700, data.length * 60);
  
  const stepX = (width - padding * 2) / (data.length - 1 || 1);
  const stepY = (height - padding * 2) / 4;

  const morningPoints: PointData[] = data.map((d, i) => ({
    x: padding + i * stepX,
    y: height - (padding + (getUrineValue(d.morning) ?? 0) * stepY),
    val: getUrineValue(d.morning),
    day: d.day,
    type: 'รอบเช้า'
  })).filter(p => p.val !== null);

  const eveningPoints: PointData[] = data.map((d, i) => ({
    x: padding + i * stepX,
    y: height - (padding + (getUrineValue(d.evening) ?? 0) * stepY),
    val: getUrineValue(d.evening),
    day: d.day,
    type: 'รอบเย็น'
  })).filter(p => p.val !== null);

  const handleMouseMove = (e: React.MouseEvent, p: PointData) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 40,
      label: `วันที่ ${p.day} (${p.type})`,
      value: `สีคงที่: ${getUrineName(p.val!)}`,
      visible: true
    });
  };

  return (
    <div className="health-chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <div className="chart-header">
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>กราฟแนวโน้มสีปัสสาวะ</h4>
      </div>
      
      <div className="chart-scroll-wrapper" style={{ marginTop: '15px' }}>
        <svg width={width} height={height} className="health-svg">
          {/* Y Axis Grid & Labels */}
          {[0, 1, 2, 3, 4].map(v => (
            <g key={v}>
              <line x1={padding} y1={height - (padding + v * stepY)} x2={width - padding} y2={height - (padding + v * stepY)} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padding - 10} y={height - (padding + v * stepY)} fontSize="10" fill="#94a3b8" textAnchor="end" alignmentBaseline="middle">{getUrineName(v)}</text>
            </g>
          ))}

          {/* X Axis Line */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="2" />

          {/* Connect Lines */}
          {[morningPoints, eveningPoints].map((pts, idx) => (
            <path
              key={idx}
              d={pts.length > 1 ? `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}` : ''}
              fill="none"
              stroke={idx === 0 ? '#0ea5e9' : '#f43f5e'}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.4"
            />
          ))}

          {/* Points */}
          {[...morningPoints, ...eveningPoints].map((p, i) => (
            <circle
              key={i}
              cx={p.x} cy={p.y} r="5"
              fill={getUrineColor(p.val!)}
              stroke={p.type === 'รอบเช้า' ? '#0ea5e9' : '#f43f5e'}
              strokeWidth="2"
              style={{ cursor: 'pointer', transition: 'r 0.2s' }}
              onMouseMove={(e) => handleMouseMove(e, p)}
              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
            />
          ))}

          {/* Day Labels */}
          {data.map((d, i) => (
            <text key={i} x={padding + i * stepX} y={height - 15} fontSize="10" fill="#64748b" textAnchor="middle">{d.day}</text>
          ))}
        </svg>

        {tooltip.visible && (
          <div className="chart-tooltip" style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(15, 23, 42, 0.9)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{tooltip.label}</div>
            <div style={{ color: '#bae6fd' }}>{tooltip.value}</div>
          </div>
        )}
      </div>

      <div className="chart-legend" style={{ display: 'flex', gap: '20px', padding: '10px 0 0 40px', fontSize: '11px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0ea5e9' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ea5e9' }}></span> เช้า</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f43f5e' }}></span> เย็น</span>
      </div>
    </div>
  );
};

export const TempTrendChart: React.FC<{ data: TemperatureDay[] }> = ({ data }) => {
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, label: '', value: '', visible: false });
  const containerRef = useRef<HTMLDivElement>(null);

  const height = 200;
  const padding = 50;
  const width = Math.max(700, data.length * 60);
  
  const parseTemp = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const allTemps = data.flatMap(d => [parseTemp(d.morning), parseTemp(d.evening), parseTemp(d.beforeBed)].filter(v => v !== null) as number[]);
  if (allTemps.length === 0) return null;

  const minTemp = Math.min(...allTemps, 36) - 0.5;
  const maxTemp = Math.max(...allTemps, 38.5) + 0.5;
  const tempRange = maxTemp - minTemp;

  const stepX = (width - padding * 2) / (data.length - 1 || 1);
  const getY = (t: number) => height - (padding + ((t - minTemp) / tempRange) * (height - padding * 2));

  const morningPoints: PointData[] = data.map((d, i) => ({ x: padding + i * stepX, y: getY(parseTemp(d.morning) ?? 0), val: parseTemp(d.morning), day: d.day, type: 'รอบเช้า' })).filter(p => p.val !== null);
  const eveningPoints: PointData[] = data.map((d, i) => ({ x: padding + (i + 0.2) * stepX, y: getY(parseTemp(d.evening) ?? 0), val: parseTemp(d.evening), day: d.day, type: 'รอบเย็น' })).filter(p => p.val !== null);
  const bedPoints: PointData[] = data.map((d, i) => ({ x: padding + (i + 0.4) * stepX, y: getY(parseTemp(d.beforeBed) ?? 0), val: parseTemp(d.beforeBed), day: d.day, type: 'ก่อนนอน' })).filter(p => p.val !== null);

  const handleMouseMove = (e: React.MouseEvent, p: PointData) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 40,
      label: `วันที่ ${p.day} (${p.type})`,
      value: `อุณหภูมิ: ${p.val}°C`,
      visible: true
    });
  };

  return (
    <div className="health-chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <div className="chart-header">
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>กราฟบันทึกอุณหภูมิกาย</h4>
      </div>

      <div className="chart-scroll-wrapper" style={{ marginTop: '15px' }}>
        <svg width={width} height={height} className="health-svg">
          {/* Grid lines */}
          {[36, 37, 38, 39].map(t => (
            <g key={t}>
              <line 
                x1={padding} y1={getY(t)} 
                x2={width - padding} y2={getY(t)}
                stroke={t === 37 ? '#fecaca' : '#f1f5f9'} strokeWidth={t === 37 ? 2 : 1}
                strokeDasharray={t === 37 ? '4' : '0'}
              />
              <text x={padding - 10} y={getY(t)} fontSize="10" fill={t === 37 ? '#ef4444' : '#94a3b8'} textAnchor="end" alignmentBaseline="middle">{t}°</text>
            </g>
          ))}

          {/* X Axis Line */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="2" />

          {/* Lines */}
          {[morningPoints, eveningPoints, bedPoints].map((pts, idx) => (
            <path
              key={idx}
              d={pts.length > 1 ? `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}` : ''}
              fill="none" stroke={idx === 0 ? '#0ea5e9' : idx === 1 ? '#f43f5e' : '#8b5cf6'}
              strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.3"
            />
          ))}

          {/* Points */}
          {[...morningPoints, ...eveningPoints, ...bedPoints].map((p, i) => (
            <circle
              key={i} cx={p.x} cy={p.y} r="4"
              fill={p.val! >= 37.0 ? '#ef4444' : (p.type === 'รอบเช้า' ? '#0ea5e9' : p.type === 'รอบเย็น' ? '#f43f5e' : '#8b5cf6')}
              style={{ cursor: 'pointer', transition: 'r 0.2s' }}
              onMouseMove={(e) => handleMouseMove(e, p)}
              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
            />
          ))}

          {/* Labels */}
          {data.map((d, i) => (
            <text key={i} x={padding + i * stepX} y={height - 15} fontSize="10" fill="#64748b" textAnchor="middle">{d.day}</text>
          ))}
        </svg>

        {tooltip.visible && (
          <div className="chart-tooltip" style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(15, 23, 42, 0.9)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{tooltip.label}</div>
            <div style={{ color: tooltip.value.includes('37.5') || tooltip.value.includes('38') || tooltip.value.includes('39') ? '#fca5a5' : '#bae6fd' }}>
              {tooltip.value}
            </div>
          </div>
        )}
      </div>

      <div className="chart-legend" style={{ display: 'flex', gap: '20px', padding: '10px 0 0 50px', fontSize: '11px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0ea5e9' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ea5e9' }}></span> เช้า</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f43f5e' }}></span> เย็น</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8b5cf6' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6' }}></span> ก่อนนอน</span>
      </div>
    </div>
  );
};
