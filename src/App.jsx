import { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, X, Download, Upload, UserPlus, Users, ClipboardList,
  Receipt, Loader2, Banknote, Landmark, ChevronLeft, Settings2,
  ListPlus, Pencil, Trash2, Lock, LockOpen, Calculator, CheckSquare, Square
} from 'lucide-react';

const COLORS = {
  navy: '#1C2B3A',
  navyDark: '#141F2B',
  ivory: '#FAFAF8',
  card: '#FFFFFF',
  line: '#E4E1DA',
  text: '#1C2321',
  muted: '#7C8580',
  yellow: '#F2B705',
  blue: '#2C6E9B',
  green: '#2E8B57',
  red: '#C0392B',
  brown: '#8C6A46',
};

const DEFAULT_FEE = 20000;

function pad(n) { return n.toString().padStart(2, '0'); }
function dateKeyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatVNDate(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function formatVNTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function formatMoney(n) { return (Number(n) || 0).toLocaleString('vi-VN') + 'đ'; }
function dateKeyToVN(key) { const [y, mo, da] = key.split('-'); return `${da}/${mo}/${y}`; }
function newId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function sortMembersFirst(list) {
  return [...list.filter(c => !c.isGuest), ...list.filter(c => c.isGuest)];
}

const DEFAULT_MEMBERS = [
  'Duy Hàng Không', 'Huy HK', 'Huy ĐN', 'Định ĐN', 'Bảo nhỏ', 'Phúc XM',
  'Tuấn Bô', 'Hùng Dơi', 'A.Long', 'Chú Huy', 'H.Hai', 'Kim Xuân Tiến',
  'Bình Xuyên', 'Trung Trực', 'Đại Q8', 'A.Phương', 'M.Trường Q8',
  'Mắt kính', 'Bé Ngọc', 'Đạt La', 'Thiên Phúc (12)',
].map(name => ({ id: newId('mem'), name, playCount: 0, joinedAt: Date.now() }));

async function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage set failed', key, e);
  }
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [waterFee, setWaterFee] = useState(15000);
  const [today] = useState(new Date());
  const todayKey = dateKeyOf(today);
  const [activeDateKey, setActiveDateKey] = useState(todayKey);
  const [checkins, setCheckins] = useState([]);
  const [tab, setTab] = useState('today');
  const [search, setSearch] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [newName, setNewName] = useState('');
  const [reportView, setReportView] = useState(null);
  const [historyKeys, setHistoryKeys] = useState([]);
  const canvasRef = useRef(null);

  // ---------- Load ----------
  useEffect(() => {
    (async () => {
      const m = await storageGet('members');
      const f = await storageGet('fee-config');
      const day = await storageGet(`day:${activeDateKey}`);
      const loadedMembers = (m && m.length > 0) ? m : DEFAULT_MEMBERS;
      setMembers(loadedMembers.map(x => ({ ...x, joinedAt: x.joinedAt || Date.now() })));
      setFee(f?.fee || DEFAULT_FEE);
      setWaterFee(f?.waterFee ?? 15000);
      setCheckins(day?.checkins || []);
      const keys = Object.keys(localStorage)
        .filter(k => k.startsWith('day:'))
        .sort()
        .reverse();
      setHistoryKeys(keys);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload checkins when user switches to a different date
  useEffect(() => {
    if (loading) return;
    storageGet(`day:${activeDateKey}`).then(day => {
      setCheckins(day?.checkins || []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDateKey]);

  // ---------- Persist ----------
  useEffect(() => { if (!loading) storageSet('members', members); }, [members, loading]);
  useEffect(() => { if (!loading) storageSet('fee-config', { fee, waterFee }); }, [fee, waterFee, loading]);
  useEffect(() => {
    if (!loading) {
      storageSet(`day:${activeDateKey}`, { checkins, waterFeeUsed: waterFee, savedAt: Date.now() });
      setHistoryKeys(
        Object.keys(localStorage).filter(k => k.startsWith('day:')).sort().reverse()
      );
    }
  }, [checkins, loading, activeDateKey, waterFee]);

  // ---------- Derived ----------
  const attendanceRate = (m) => {
    const daysTracked = Math.max(1, Math.ceil((Date.now() - (m.joinedAt || Date.now())) / 86400000));
    return (m.playCount || 0) / daysTracked;
  };

  const filteredRoster = members
    .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => attendanceRate(b) - attendanceRate(a) || a.name.localeCompare(b.name));

  const totalPeople = checkins.length;
  const paidList = checkins.filter(c => c.paid);
  const unpaidList = checkins.filter(c => !c.paid);
  const totalCollected = paidList.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const totalOwed = unpaidList.length * fee;

  // ---------- Handlers ----------
  const addMemberToRoster = () => {
    const name = newName.trim();
    if (!name) return;
    setMembers(prev => [...prev, { id: newId('mem'), name, playCount: 0, joinedAt: Date.now() }]);
    setNewName('');
    setShowAddMember(false);
  };

  const bulkImportMembers = (replaceAll) => {
    const lines = importText.split('\n')
      .map(l => l.replace(/^\s*\d+\s*[\/\.\)]\s*/, '').trim())
      .filter(Boolean);

    if (replaceAll) {
      const seen = new Set();
      const fresh = [];
      lines.forEach(name => {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          fresh.push({ id: newId('mem'), name, playCount: 0, joinedAt: Date.now() });
        }
      });
      setMembers(fresh);
      setImportText('');
      setShowImport(false);
      return;
    }

    const existingLower = new Set(members.map(m => m.name.toLowerCase()));
    const additions = [];
    lines.forEach(name => {
      const key = name.toLowerCase();
      if (!existingLower.has(key)) {
        existingLower.add(key);
        additions.push({ id: newId('mem'), name, playCount: 0, joinedAt: Date.now() });
      }
    });
    setMembers(prev => [...prev, ...additions]);
    setImportText('');
    setShowImport(false);
  };

  const renameMember = (id, name) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name } : m));
    setCheckins(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    setEditingMember(null);
  };

  const deleteMember = (id) => {
    setMembers(prev => prev.filter(m => m.id !== id));
    setCheckins(prev => prev.filter(c => c.id !== id));
    setEditingMember(null);
  };

  const normalize = (s) => s.trim().toLowerCase();
  const isCheckedIn = (member) => checkins.some(c => c.id === member.id || normalize(c.name) === normalize(member.name));

  const toggleRosterCheckin = (member) => {
    const existing = checkins.find(c => c.id === member.id || normalize(c.name) === normalize(member.name));
    if (existing) {
      setCheckins(prev => prev.filter(c => c !== existing));
    } else {
      setCheckins(prev => [...prev, { id: member.id, name: member.name, isGuest: false, paid: false, method: null, amount: 0 }]);
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, playCount: (m.playCount || 0) + 1 } : m));
    }
  };

  const addGuest = () => {
    const guestCount = checkins.filter(c => c.isGuest).length;
    const baseName = newName.trim() || `Khách lẻ #${guestCount + 1}`;
    const name = `${baseName} **`;
    setCheckins(prev => [...prev, { id: newId('guest'), name, isGuest: true, paid: false, method: null, amount: 0 }]);
    setNewName('');
    setShowAddGuest(false);
  };

  const removeFromToday = (id) => setCheckins(prev => prev.filter(c => c.id !== id));

  const setPaid = (id, method) => {
    setCheckins(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (c.paid && c.method === method) return { ...c, paid: false, method: null, amount: 0 };
      return { ...c, paid: true, method, amount: c.amount && c.amount !== fee ? c.amount : fee };
    }));
  };

  const setAmount = (id, value) => {
    const n = Number(value.replace(/[^\d]/g, '')) || 0;
    setCheckins(prev => prev.map(c => c.id === id ? { ...c, amount: n } : c));
  };

  const openReport = () => {
    const now = new Date();
    setReportView({
      dateStr: dateKeyToVN(activeDateKey),
      timeStr: formatVNTime(now),
      rows: sortMembersFirst(checkins).map(c => ({ ...c })),
      feeUsed: fee,
      waterFeeUsed: waterFee,
    });
  };

  const loadHistoryReport = async (key) => {
    const rec = await storageGet(key);
    if (!rec) return;
    const dstr = key.split(':')[1];
    const [y, mo, da] = dstr.split('-');
    setReportView({
      dateStr: `${da}/${mo}/${y}`,
      timeStr: rec.savedAt ? formatVNTime(new Date(rec.savedAt)) : '—',
      rows: sortMembersFirst(rec.checkins || []),
      feeUsed: fee,
      waterFeeUsed: rec.waterFeeUsed ?? waterFee,
    });
  };

  // ---------- Canvas render ----------
  useEffect(() => {
    if (!reportView || !canvasRef.current) return;
    drawReport(canvasRef.current, reportView);
  }, [reportView]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-${reportView.dateStr.replaceAll('/', '-')}.png`;
    a.click();
  };

  if (loading) {
    return (
      <div style={{ background: COLORS.ivory, minHeight: '100%' }} className="flex items-center justify-center p-10">
        <Loader2 className="animate-spin" size={28} style={{ color: COLORS.blue }} />
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.ivory, minHeight: '100%', fontFamily: "'Inter', sans-serif", color: COLORS.text }} className="flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .score-num { font-family: 'Oswald', sans-serif; font-weight: 700; letter-spacing: 0.5px; }
        .tab-btn { -webkit-tap-highlight-color: transparent; }
        input, button { font-family: inherit; }
      `}</style>

      {/* ---- Scoreboard summary ---- */}
      <div style={{ background: COLORS.navy }} className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div style={{ color: activeDateKey !== todayKey ? COLORS.yellow : '#8FA3B8', fontSize: 12 }}>
              {activeDateKey !== todayKey ? `Đang nhập: ${dateKeyToVN(activeDateKey)}` : formatVNDate(today)}
            </div>
            <div className="score-num" style={{ color: 'white', fontSize: 20 }}>SÂN BÓNG CHUYỀN</div>
          </div>
          <div className="flex items-center gap-2">
            {activeDateKey !== todayKey && (
              <button
                onClick={() => setActiveDateKey(todayKey)}
                className="px-2 py-1 rounded-full text-xs font-semibold"
                style={{ background: COLORS.yellow, color: COLORS.navy }}
              >
                Hôm nay
              </button>
            )}
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Settings2 size={18} color="#C7D3DE" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ScoreTile label="Có mặt" value={totalPeople} color="white" />
          <ScoreTile label="Đã thu" value={formatMoney(totalCollected)} color={COLORS.yellow} small />
          <ScoreTile label="Còn nợ" value={formatMoney(totalOwed)} color="#FF8A80" small />
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'today' && (
          <TodayTab
            checkins={checkins}
            fee={fee}
            onRemove={removeFromToday}
            onPaid={setPaid}
            onAmount={setAmount}
            onAddGuest={() => setShowAddGuest(true)}
            onAddFromRoster={() => setTab('roster')}
          />
        )}
        {tab === 'roster' && (
          <RosterTab
            roster={filteredRoster}
            search={search}
            setSearch={setSearch}
            isCheckedIn={isCheckedIn}
            onToggle={toggleRosterCheckin}
            onAddMember={() => setShowAddMember(true)}
            onImport={() => setShowImport(true)}
            onEdit={(m) => setEditingMember(m)}
          />
        )}
        {tab === 'reports' && (
          <ReportsTab historyKeys={historyKeys} onOpen={loadHistoryReport} todayKey={todayKey} />
        )}
        {tab === 'settle' && (
          <SettlementTab historyKeys={historyKeys} />
        )}
      </div>

      {/* ---- Bottom tab bar ---- */}
      <div style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.line}` }} className="fixed bottom-0 left-0 right-0 flex items-center px-1 py-2 gap-0.5">
        <TabButton icon={<ClipboardList size={19} />} label="Hôm nay" active={tab === 'today'} onClick={() => setTab('today')} />
        <TabButton icon={<Users size={19} />} label="Danh sách" active={tab === 'roster'} onClick={() => setTab('roster')} />
        <TabButton icon={<Receipt size={19} />} label="Báo cáo" active={tab === 'reports'} onClick={() => setTab('reports')} />
        <TabButton icon={<Calculator size={19} />} label="Quyết toán" active={tab === 'settle'} onClick={() => setTab('settle')} />
        <button
          onClick={openReport}
          className="flex flex-col items-center justify-center rounded-xl px-2 py-2"
          style={{ background: COLORS.yellow, minWidth: 56, flexShrink: 0 }}
        >
          <Download size={16} color={COLORS.navy} />
          <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.navy, marginTop: 2, whiteSpace: 'nowrap' }}>Xuất</span>
        </button>
      </div>

      {/* ---- Modals ---- */}
      {showAddMember && (
        <NameModal
          title="Thêm thành viên mới"
          placeholder="Tên thành viên"
          value={newName}
          setValue={setNewName}
          onCancel={() => { setShowAddMember(false); setNewName(''); }}
          onConfirm={addMemberToRoster}
          confirmLabel="Thêm vào danh sách"
        />
      )}
      {showAddGuest && (
        <NameModal
          title="Thêm khách vãng lai"
          placeholder="Tên (không bắt buộc)"
          value={newName}
          setValue={setNewName}
          onCancel={() => { setShowAddGuest(false); setNewName(''); }}
          onConfirm={addGuest}
          confirmLabel="Thêm vào sân hôm nay"
          hint="Tên sẽ tự động thêm dấu ** phía sau để phân biệt với thành viên chính thức, kể cả trong ảnh báo cáo."
        />
      )}
      {showSettings && (
        <SettingsModal
          fee={fee} setFee={setFee}
          waterFee={waterFee} setWaterFee={setWaterFee}
          activeDateKey={activeDateKey}
          todayKey={todayKey}
          onSwitchDate={(key) => setActiveDateKey(key)}
          onClose={() => setShowSettings(false)}
          onRestore={() => window.location.reload()}
        />
      )}
      {reportView && (
        <ReportModal
          reportView={reportView}
          canvasRef={canvasRef}
          onClose={() => setReportView(null)}
          onDownload={downloadImage}
        />
      )}
      {showImport && (
        <ImportModal
          value={importText}
          setValue={setImportText}
          onCancel={() => { setShowImport(false); setImportText(''); }}
          onConfirm={bulkImportMembers}
        />
      )}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onCancel={() => setEditingMember(null)}
          onSave={renameMember}
          onDelete={deleteMember}
        />
      )}
    </div>
  );
}

// ================= Small components =================

function ScoreTile({ label, value, color, small }) {
  return (
    <div className="rounded-lg py-2 px-2 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="score-num" style={{ color, fontSize: small ? 15 : 22, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: '#8FA3B8', fontSize: 10, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className="tab-btn flex-1 flex flex-col items-center justify-center py-1 rounded-lg" style={{ color: active ? COLORS.blue : COLORS.muted }}>
      {icon}
      <span style={{ fontSize: 11, marginTop: 2, fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  );
}

function TodayTab({ checkins, fee, onRemove, onPaid, onAmount, onAddGuest, onAddFromRoster }) {
  const sorted = sortMembersFirst(checkins);
  if (checkins.length === 0) {
    return (
      <div className="flex flex-col items-center text-center px-8 pt-16 gap-3">
        <Users size={40} style={{ color: COLORS.line }} />
        <div style={{ color: COLORS.muted, fontSize: 14 }}>Chưa có ai điểm danh hôm nay. Thêm thành viên từ danh sách hoặc thêm khách vãng lai.</div>
        <div className="flex gap-2 mt-2">
          <button onClick={onAddFromRoster} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: COLORS.blue, color: 'white' }}>Chọn từ danh sách</button>
          <button onClick={onAddGuest} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.line}` }}>Khách vãng lai</button>
        </div>
      </div>
    );
  }
  return (
    <div className="px-3 pt-3">
      <div className="flex gap-2 mb-3">
        <button onClick={onAddFromRoster} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
          <Plus size={15} /> Từ danh sách
        </button>
        <button onClick={onAddGuest} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
          <UserPlus size={15} /> Khách vãng lai
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((c, idx) => (
          <div key={c.id} className="rounded-xl p-3" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ color: COLORS.muted, fontSize: 12, minWidth: 20 }}>{idx + 1}.</span>
                <span className="truncate" style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                {c.isGuest && <span style={{ fontSize: 10, color: COLORS.brown, background: '#F3E9DD', padding: '2px 6px', borderRadius: 6 }}>Vãng lai</span>}
              </div>
              <button onClick={() => onRemove(c.id)} className="p-1"><X size={16} style={{ color: COLORS.muted }} /></button>
            </div>
            <div className="flex items-center gap-2">
              <MethodChip active={c.paid && c.method === 'cash'} color={COLORS.brown} icon={<Banknote size={14} />} label="Tiền mặt" onClick={() => onPaid(c.id, 'cash')} />
              <MethodChip active={c.paid && c.method === 'transfer'} color={COLORS.blue} icon={<Landmark size={14} />} label="Chuyển khoản" onClick={() => onPaid(c.id, 'transfer')} />
              {c.paid ? (
                <input
                  value={c.amount}
                  onChange={e => onAmount(c.id, e.target.value)}
                  inputMode="numeric"
                  className="ml-auto text-right rounded-lg px-2 py-1 text-sm font-semibold"
                  style={{ width: 90, border: `1px solid ${COLORS.line}`, color: COLORS.green }}
                />
              ) : (
                <span className="ml-auto text-sm font-semibold" style={{ color: COLORS.red }}>Chưa đóng</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodChip({ active, color, icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: active ? color : COLORS.ivory,
        color: active ? 'white' : COLORS.muted,
        border: `1px solid ${active ? color : COLORS.line}`,
      }}
    >
      {icon}{label}
    </button>
  );
}

function RosterTab({ roster, search, setSearch, isCheckedIn, onToggle, onAddMember, onImport, onEdit }) {
  return (
    <div className="px-3 pt-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
          <Search size={16} style={{ color: COLORS.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên..." className="flex-1 outline-none text-sm bg-transparent" />
        </div>
        <button onClick={onImport} className="p-2.5 rounded-lg" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
          <ListPlus size={18} style={{ color: COLORS.text }} />
        </button>
        <button onClick={onAddMember} className="p-2.5 rounded-lg" style={{ background: COLORS.blue }}>
          <UserPlus size={18} color="white" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {roster.map(m => {
          const checked = isCheckedIn(m);
          return (
            <div
              key={m.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: checked ? '#EAF3EC' : COLORS.card, border: `1px solid ${checked ? COLORS.green : COLORS.line}` }}
            >
              <button onClick={() => onToggle(m)} className="flex-1 text-left min-w-0">
                <span style={{ fontWeight: 500, fontSize: 15 }} className="truncate block">{m.name}</span>
              </button>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span style={{ fontSize: 11, color: COLORS.muted }}>{m.playCount || 0} buổi</span>
                <button onClick={() => onEdit(m)} className="p-1">
                  <Pencil size={14} style={{ color: COLORS.muted }} />
                </button>
                <button onClick={() => onToggle(m)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: checked ? COLORS.green : COLORS.ivory, border: `1px solid ${checked ? COLORS.green : COLORS.line}` }}>
                  {checked ? <span style={{ color: 'white', fontSize: 13 }}>✓</span> : <Plus size={14} style={{ color: COLORS.muted }} />}
                </button>
              </span>
            </div>
          );
        })}
        {roster.length === 0 && (
          <div className="text-center py-10" style={{ color: COLORS.muted, fontSize: 13 }}>Chưa có thành viên nào. Bấm nút + để thêm, hoặc dùng nút danh sách để dán nhiều tên cùng lúc.</div>
        )}
      </div>
    </div>
  );
}

function ReportsTab({ historyKeys, onOpen, todayKey }) {
  return (
    <div className="px-3 pt-3">
      <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 8 }}>Chọn một ngày để xem lại báo cáo đã lưu.</div>
      <div className="flex flex-col gap-1.5">
        {historyKeys.map(k => {
          const dstr = k.split(':')[1];
          const isToday = dstr === todayKey;
          return (
            <button key={k} onClick={() => onOpen(k)} className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
              <span style={{ fontWeight: 500 }}>{dstr}{isToday && ' (hôm nay)'}</span>
              <Receipt size={16} style={{ color: COLORS.muted }} />
            </button>
          );
        })}
        {historyKeys.length === 0 && (
          <div className="text-center py-10" style={{ color: COLORS.muted, fontSize: 13 }}>Chưa có báo cáo nào được lưu.</div>
        )}
      </div>
    </div>
  );
}

function NameModal({ title, placeholder, value, setValue, onCancel, onConfirm, confirmLabel, hint }) {
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full rounded-t-2xl p-5" style={{ background: COLORS.card, maxWidth: 480 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: hint ? 4 : 12 }}>{title}</div>
        {hint && <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>{hint}</div>}
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 rounded-lg text-sm mb-3 outline-none"
          style={{ border: `1px solid ${COLORS.line}` }}
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: COLORS.ivory, border: `1px solid ${COLORS.line}` }}>Huỷ</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: COLORS.blue, color: 'white' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ fee, setFee, waterFee, setWaterFee, activeDateKey, todayKey, onSwitchDate, onClose, onRestore }) {
  const [val, setVal] = useState(String(fee));
  const [waterVal, setWaterVal] = useState(String(waterFee));
  const [restoreMsg, setRestoreMsg] = useState('');
  const [dateVal, setDateVal] = useState('');
  const fileRef = useRef(null);

  const exportBackup = () => {
    const data = {};
    Object.keys(localStorage).forEach(k => {
      try { data[k] = JSON.parse(localStorage.getItem(k)); } catch {}
    });
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    a.download = `bong-chuyen-backup-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const data = parsed.data || parsed;
        let count = 0;
        Object.entries(data).forEach(([k, v]) => {
          localStorage.setItem(k, JSON.stringify(v));
          count++;
        });
        setRestoreMsg(`✓ Đã khôi phục ${count} mục. Đang tải lại...`);
        setTimeout(() => { onRestore(); onClose(); }, 1200);
      } catch {
        setRestoreMsg('✗ File không hợp lệ, thử lại.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full rounded-t-2xl p-5" style={{ background: COLORS.card, maxWidth: 480 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Phí mỗi người/buổi</div>
        <input
          inputMode="numeric"
          value={val}
          onChange={e => setVal(e.target.value.replace(/[^\d]/g, ''))}
          className="w-full px-3 py-2.5 rounded-lg text-sm mb-4 outline-none"
          style={{ border: `1px solid ${COLORS.line}` }}
        />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Tiền nước mỗi ngày</div>
        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>Tự động cộng vào phiếu thu như một khoản chi phí cố định.</div>
        <input
          inputMode="numeric"
          value={waterVal}
          onChange={e => setWaterVal(e.target.value.replace(/[^\d]/g, ''))}
          className="w-full px-3 py-2.5 rounded-lg text-sm mb-4 outline-none"
          style={{ border: `1px solid ${COLORS.line}` }}
        />
        <button
          onClick={() => { setFee(Number(val) || DEFAULT_FEE); setWaterFee(Number(waterVal) || 0); onClose(); }}
          className="w-full py-2.5 rounded-lg text-sm font-medium mb-4"
          style={{ background: COLORS.blue, color: 'white' }}
        >
          Lưu
        </button>

        {/* Backup section */}
        <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Sao lưu dữ liệu</div>
          <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
            Xuất file JSON để lưu vào Files / iCloud. Nhập lại để khôi phục khi đổi máy hoặc xoá cache.
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportBackup}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: COLORS.navy, color: 'white' }}
            >
              <Download size={15} /> Xuất backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: COLORS.ivory, border: `1px solid ${COLORS.line}`, color: COLORS.text }}
            >
              <Upload size={15} /> Nhập backup
            </button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleRestoreFile} style={{ display: 'none' }} />
          </div>
          {restoreMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: restoreMsg.startsWith('✓') ? COLORS.green : COLORS.red }}>
              {restoreMsg}
            </div>
          )}
        </div>

        {/* Past date entry */}
        <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Nhập dữ liệu ngày khác</div>
          <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
            Chuyển sang ngày quá khứ để nhập hoặc sửa dữ liệu điểm danh. Mặc định luôn là hôm nay.
          </div>
          {activeDateKey !== todayKey && (
            <div style={{ background: '#FFF8E1', border: `1px solid ${COLORS.yellow}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: COLORS.brown }}>
              Đang xem: <strong>{dateKeyToVN(activeDateKey)}</strong>
            </div>
          )}
          <input
            type="date"
            value={dateVal}
            max={todayKey}
            onChange={e => setDateVal(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm mb-2 outline-none"
            style={{ border: `1px solid ${COLORS.line}` }}
          />
          <button
            onClick={() => {
              if (!dateVal) return;
              onSwitchDate(dateVal);
              onClose();
            }}
            disabled={!dateVal || dateVal === activeDateKey}
            className="w-full py-2.5 rounded-lg text-sm font-medium mb-2"
            style={{
              background: (!dateVal || dateVal === activeDateKey) ? COLORS.line : COLORS.blue,
              color: 'white',
            }}
          >
            Chuyển sang ngày đã chọn
          </button>
          {activeDateKey !== todayKey && (
            <button
              onClick={() => { onSwitchDate(todayKey); onClose(); }}
              className="w-full py-2.5 rounded-lg text-sm font-medium"
              style={{ background: COLORS.ivory, border: `1px solid ${COLORS.line}`, color: COLORS.text }}
            >
              Quay về hôm nay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const UNLOCK_CODE = '6648';

function ImportModal({ value, setValue, onCancel, onConfirm }) {
  const [replaceAll, setReplaceAll] = useState(false);
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const count = value.split('\n').map(l => l.trim()).filter(Boolean).length;

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === UNLOCK_CODE) {
        setUnlocked(true);
        setPinError(false);
      } else {
        setPinError(true);
        setUnlocked(false);
      }
    } else {
      setPinError(false);
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full rounded-t-2xl p-5" style={{ background: COLORS.card, maxWidth: 480 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Nhập nhanh danh sách</div>
        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
          Dán mỗi tên một dòng. Có thể giữ số thứ tự kiểu "8/ Hưng Đài" — app sẽ tự bỏ số, tên trùng sẽ bị lọc.
        </div>
        <textarea
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={'8/ Hưng Đài\n9/ A.Long\n10/ Chú Huy\n...'}
          rows={8}
          className="w-full px-3 py-2.5 rounded-lg text-sm mb-2 outline-none"
          style={{ border: `1px solid ${COLORS.line}`, resize: 'none', fontFamily: 'monospace' }}
        />

        <div className="rounded-lg p-3 mb-3" style={{ background: COLORS.ivory, border: `1px solid ${COLORS.line}` }}>
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={replaceAll}
              disabled={!unlocked}
              onChange={e => setReplaceAll(e.target.checked)}
            />
            {unlocked ? <LockOpen size={14} style={{ color: COLORS.green }} /> : <Lock size={14} style={{ color: COLORS.muted }} />}
            <span style={{ color: replaceAll ? COLORS.red : (unlocked ? COLORS.text : COLORS.muted), fontWeight: replaceAll ? 600 : 400 }}>
              Xoá toàn bộ danh sách cũ trước khi thêm
            </span>
          </label>

          {!unlocked ? (
            <div className="mt-2">
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                inputMode="numeric"
                type="password"
                placeholder="Nhập mã 4 số để mở khoá"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${pinError ? COLORS.red : COLORS.line}` }}
              />
              {pinError && <div style={{ color: COLORS.red, fontSize: 11, marginTop: 4 }}>Sai mã, thử lại.</div>}
            </div>
          ) : (
            <div style={{ color: COLORS.green, fontSize: 11, marginTop: 6 }}>✓ Đã mở khoá — có thể tick chọn xoá toàn bộ</div>
          )}
        </div>

        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>{count} dòng sẽ được thêm (bỏ trùng tự động)</div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: COLORS.ivory, border: `1px solid ${COLORS.line}` }}>Huỷ</button>
          <button
            onClick={() => onConfirm(replaceAll && unlocked)}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: (replaceAll && unlocked) ? COLORS.red : COLORS.blue, color: 'white' }}
          >
            {(replaceAll && unlocked) ? `Thay thế bằng ${count} người` : `Thêm ${count} người`}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditMemberModal({ member, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(member.name);
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full rounded-t-2xl p-5" style={{ background: COLORS.card, maxWidth: 480 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Sửa thành viên</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm mb-3 outline-none"
          style={{ border: `1px solid ${COLORS.line}` }}
        />
        <div className="flex gap-2 mb-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: COLORS.ivory, border: `1px solid ${COLORS.line}` }}>Huỷ</button>
          <button onClick={() => onSave(member.id, name.trim() || member.name)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: COLORS.blue, color: 'white' }}>Lưu</button>
        </div>
        <button onClick={() => onDelete(member.id)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#FBEEEE', color: COLORS.red }}>
          <Trash2 size={14} /> Xoá khỏi danh sách
        </button>
      </div>
    </div>
  );
}

function ReportModal({ reportView, canvasRef, onClose, onDownload }) {
  const { dateStr, timeStr } = reportView;
  return (
    <div className="fixed inset-0 flex flex-col z-50" style={{ background: COLORS.ivory }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: COLORS.navy }}>
        <button onClick={onClose} className="flex items-center gap-1" style={{ color: 'white' }}>
          <ChevronLeft size={20} /> <span style={{ fontSize: 14 }}>Đóng</span>
        </button>
        <span className="score-num" style={{ color: 'white', fontSize: 14 }}>PHIẾU THU {dateStr}</span>
        <button onClick={onDownload} className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: COLORS.yellow, color: COLORS.navy, fontSize: 13, fontWeight: 600 }}>
          <Download size={14} /> Tải ảnh
        </button>
      </div>
      <div className="flex-1 overflow-auto flex justify-center p-4">
        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 460, height: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }} />
      </div>
      <div className="px-4 pb-4 text-center" style={{ fontSize: 12, color: COLORS.muted }}>
        Trên iPhone: nếu nút "Tải ảnh" không tự lưu, chạm giữ vào ảnh phía trên rồi chọn "Lưu vào Ảnh".
      </div>
    </div>
  );
}

// ================= Settlement tab =================

function SettlementTab({ historyKeys }) {
  const [selected, setSelected] = useState(new Set());
  const [dayData, setDayData] = useState({});
  const [courtFeePerDay, setCourtFeePerDay] = useState(375000);
  const [editingCourt, setEditingCourt] = useState(false);
  const [courtInput, setCourtInput] = useState('375000');

  // Load all day data from localStorage
  useEffect(() => {
    const data = {};
    historyKeys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) data[k] = JSON.parse(raw);
      } catch {}
    });
    setDayData(data);
  }, [historyKeys]);

  const toggle = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectRecent = (n) => setSelected(new Set(historyKeys.slice(0, n)));
  const selectAll = () => setSelected(new Set(historyKeys));
  const clearAll = () => setSelected(new Set());

  // Totals across selected days
  const totals = [...selected].reduce((acc, key) => {
    const d = dayData[key];
    if (!d) return acc;
    const collected = (d.checkins || []).filter(c => c.paid).reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const unpaid = (d.checkins || []).filter(c => !c.paid).length;
    return {
      collected: acc.collected + collected,
      water: acc.water + (d.waterFeeUsed || 0),
      days: acc.days + 1,
      people: acc.people + (d.checkins || []).length,
      unpaid: acc.unpaid + unpaid,
    };
  }, { collected: 0, water: 0, days: 0, people: 0, unpaid: 0 });

  const netPool = totals.collected - totals.water;
  const courtTotal = totals.days * courtFeePerDay;
  const balance = netPool - courtTotal;

  const saveCourt = () => {
    const v = Number(courtInput.replace(/[^\d]/g, ''));
    if (v > 0) setCourtFeePerDay(v);
    setEditingCourt(false);
  };

  const formatDayLabel = (key) => {
    const dstr = key.split(':')[1] || '';
    const [y, mo, da] = dstr.split('-');
    return `${da}/${mo}/${y}`;
  };

  const getDayStats = (key) => {
    const d = dayData[key];
    if (!d) return null;
    const paid = (d.checkins || []).filter(c => c.paid);
    const total = paid.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { total, count: (d.checkins || []).length };
  };

  return (
    <div className="px-3 pt-3 pb-4">
      {/* Counter + quick-select */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="score-num px-3 py-1 rounded-full"
            style={{
              fontSize: 15,
              background: selected.size === 10 ? COLORS.green : selected.size > 0 ? COLORS.blue : COLORS.navy,
              color: 'white',
              transition: 'background 0.2s',
            }}
          >
            {selected.size}
          </span>
          <span style={{ fontSize: 13, color: COLORS.muted }}>
            {selected.size === 0 ? 'ngày chưa chọn' : selected.size === 10 ? 'ngày ✓ đủ 1 chu kỳ' : `/ 10 ngày`}
          </span>
        </div>
        <button
          onClick={clearAll}
          style={{ fontSize: 12, color: COLORS.muted }}
        >
          Bỏ chọn tất cả
        </button>
      </div>

      {/* Quick-select buttons */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={() => selectRecent(10)}
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: COLORS.navy, color: 'white' }}
        >
          10 ngày gần nhất
        </button>
        <button
          onClick={() => selectRecent(5)}
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.text }}
        >
          5 ngày gần nhất
        </button>
        <button
          onClick={selectAll}
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.text }}
        >
          Tất cả ({historyKeys.length})
        </button>
      </div>

      {/* Day list */}
      {historyKeys.length === 0 ? (
        <div className="text-center py-10" style={{ color: COLORS.muted, fontSize: 13 }}>Chưa có ngày nào được lưu.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-4">
          {historyKeys.map(k => {
            const isSelected = selected.has(k);
            const stats = getDayStats(k);
            return (
              <button
                key={k}
                onClick={() => toggle(k)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{
                  background: isSelected ? '#EAF3EC' : COLORS.card,
                  border: `1px solid ${isSelected ? COLORS.green : COLORS.line}`,
                }}
              >
                <div className="flex items-center gap-2">
                  {isSelected
                    ? <CheckSquare size={16} style={{ color: COLORS.green, flexShrink: 0 }} />
                    : <Square size={16} style={{ color: COLORS.line, flexShrink: 0 }} />
                  }
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{formatDayLabel(k)}</span>
                </div>
                {stats && (
                  <span style={{ fontSize: 12, color: COLORS.muted }}>
                    {stats.count} người · {formatMoney(stats.total)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary card — only show when days selected */}
      {totals.days > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.line}` }}>
          {/* Header */}
          <div className="px-4 py-3" style={{ background: COLORS.navy }}>
            <div className="score-num" style={{ color: 'white', fontSize: 13 }}>
              TỔNG KẾT {totals.days} NGÀY
            </div>
            <div style={{ color: '#8FA3B8', fontSize: 11, marginTop: 2 }}>
              {totals.people} lượt người · {totals.unpaid} chưa đóng
            </div>
          </div>

          {/* Rows */}
          <div style={{ background: COLORS.card }}>
            <SummaryRow label="Tổng tiền đã thu" value={formatMoney(totals.collected)} color={COLORS.green} bold />
            <SummaryRow label="Tổng tiền nước đã trừ" value={`−${formatMoney(totals.water)}`} color={COLORS.brown} />
            <SummaryRow
              label="Quỹ ròng"
              value={formatMoney(netPool)}
              color={netPool >= 0 ? COLORS.green : COLORS.red}
              bold
              highlight
            />

            {/* Court fee row — editable */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `2px dashed ${COLORS.line}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Tiền sân ({totals.days} ngày)</div>
                {editingCourt ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      autoFocus
                      value={courtInput}
                      onChange={e => setCourtInput(e.target.value.replace(/[^\d]/g, ''))}
                      onBlur={saveCourt}
                      onKeyDown={e => e.key === 'Enter' && saveCourt()}
                      inputMode="numeric"
                      className="px-2 py-1 rounded text-xs outline-none"
                      style={{ width: 96, border: `1px solid ${COLORS.blue}`, color: COLORS.text }}
                    />
                    <span style={{ fontSize: 11, color: COLORS.muted }}>đ/ngày</span>
                  </div>
                ) : (
                  <button onClick={() => { setCourtInput(String(courtFeePerDay)); setEditingCourt(true); }} style={{ fontSize: 11, color: COLORS.blue, marginTop: 2 }}>
                    {formatMoney(courtFeePerDay)}/ngày · chỉnh
                  </button>
                )}
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.red }}>
                −{formatMoney(courtTotal)}
              </span>
            </div>

            {/* Final balance */}
            <div
              className="px-4 py-4 flex items-center justify-between"
              style={{ background: balance >= 0 ? '#EAF3EC' : '#FBEEEE' }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                  {balance >= 0 ? 'Quỹ còn dư' : 'CÒN THIẾU CHỦ SÂN'}
                </div>
                {balance < 0 && (
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                    Cần bù thêm từ quỹ hoặc thu thêm
                  </div>
                )}
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: balance >= 0 ? COLORS.green : COLORS.red }} className="score-num">
                {balance < 0 ? '' : '+'}{formatMoney(balance)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, color, bold, highlight }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ borderTop: `1px solid ${COLORS.line}`, background: highlight ? '#F7FAF8' : 'transparent' }}
    >
      <span style={{ fontSize: 13, fontWeight: bold ? 600 : 400, color: COLORS.text }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color }}>{value}</span>
    </div>
  );
}

// ================= Canvas drawing =================

function drawReport(canvas, reportView) {
  const { dateStr, timeStr, rows, feeUsed, waterFeeUsed = 0 } = reportView;
  const scale = 2;
  const width = 480;
  const rowH = 34;
  const headerH = 150;
  const hasGuestRow = rows.some(r => r.isGuest);
  const footerH = 170 + (hasGuestRow ? 20 : 0) + (waterFeeUsed > 0 ? 56 : 0);
  const height = headerH + rowH * (rows.length + 1) + footerH;

  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const C = {
    dark: '#1C2321', muted: '#7C8580', green: '#2E8B57', red: '#C0392B',
    line: '#E4E1DA', headBg: '#F4F2EC', unpaidBg: '#FBEEEE', navy: '#1C2B3A', yellow: '#F2B705',
  };

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, width, 64);
  const notchR = 6;
  ctx.fillStyle = '#FFFFFF';
  for (let x = notchR; x < width; x += notchR * 2.6) {
    ctx.beginPath();
    ctx.arc(x, 64, notchR, 0, Math.PI, false);
    ctx.fill();
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 20px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PHIẾU THU SÂN BÓNG CHUYỀN', width / 2, 30);
  ctx.font = '400 13px Inter, sans-serif';
  ctx.fillStyle = '#B9C6D1';
  ctx.fillText(`Ngày ${dateStr}`, width / 2, 50);

  let y = 90;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.headBg;
  ctx.fillRect(16, y, width - 32, rowH);
  ctx.fillStyle = C.dark;
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillText('STT', 26, y + rowH / 2 + 4);
  ctx.fillText('Tên', 64, y + rowH / 2 + 4);
  ctx.fillText('Trạng thái', 300, y + rowH / 2 + 4);
  ctx.textAlign = 'right';
  ctx.fillText('Tiền', width - 26, y + rowH / 2 + 4);
  ctx.textAlign = 'left';
  y += rowH;

  rows.forEach((r, idx) => {
    if (!r.paid) {
      ctx.fillStyle = C.unpaidBg;
      ctx.fillRect(16, y, width - 32, rowH);
    }
    const color = r.paid ? C.dark : C.red;
    ctx.fillStyle = color;
    ctx.font = '400 12px Inter, sans-serif';
    ctx.fillText(String(idx + 1), 26, y + rowH / 2 + 4);
    ctx.font = '500 12px Inter, sans-serif';
    const name = r.name.length > 22 ? r.name.slice(0, 21) + '…' : r.name;
    ctx.fillText(name, 64, y + rowH / 2 + 4);
    ctx.fillStyle = r.paid ? C.green : C.red;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(r.paid ? '✓ Đã đóng' : '✗ Chưa đóng', 300, y + rowH / 2 + 4);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = '400 12px Inter, sans-serif';
    ctx.fillText(r.paid ? formatMoney(r.amount) : '—', width - 26, y + rowH / 2 + 4);
    ctx.textAlign = 'left';
    y += rowH;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(width - 16, y); ctx.stroke();
  });

  y += 16;
  const paidCount = rows.filter(r => r.paid).length;
  const unpaidCount = rows.length - paidCount;
  const total = rows.filter(r => r.paid).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const owed = unpaidCount * feeUsed;

  const summaryLine = (label, value, color) => {
    ctx.textAlign = 'left';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = C.dark;
    ctx.fillText(label, 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.fillText(value, width - 24, y);
    y += 24;
  };
  summaryLine('Tổng số người tham gia:', `${rows.length} người`, C.dark);
  summaryLine('Đã đóng:', `${paidCount} người`, C.green);
  summaryLine('Chưa đóng:', `${unpaidCount} người`, C.red);

  y += 4;
  ctx.strokeStyle = C.line;
  ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(width - 16, y); ctx.stroke();
  y += 24;

  ctx.textAlign = 'left';
  ctx.font = '700 15px Inter, sans-serif';
  ctx.fillStyle = C.dark;
  ctx.fillText('TỔNG TIỀN ĐÃ THU', 24, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.green;
  ctx.fillText(formatMoney(total), width - 24, y);
  y += 28;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.dark;
  ctx.fillText('CÒN NỢ (dự kiến)', 24, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.red;
  ctx.fillText(formatMoney(owed), width - 24, y);
  y += 32;

  if (waterFeeUsed > 0) {
    ctx.strokeStyle = C.line;
    ctx.beginPath(); ctx.moveTo(16, y - 12); ctx.lineTo(width - 16, y - 12); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '400 13px Inter, sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText('Tiền nước (chi phí cố định)', 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#B0651B';
    ctx.fillText('-' + formatMoney(waterFeeUsed), width - 24, y);
    y += 28;

    const net = total - waterFeeUsed;
    ctx.textAlign = 'left';
    ctx.font = '700 15px Inter, sans-serif';
    ctx.fillStyle = C.dark;
    ctx.fillText('QUỸ CÒN LẠI', 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = net >= 0 ? C.green : C.red;
    ctx.fillText((net < 0 ? '-' : '') + formatMoney(Math.abs(net)), width - 24, y);
    y += 32;
  }

  const hasGuest = rows.some(r => r.isGuest);
  if (hasGuest) {
    ctx.textAlign = 'left';
    ctx.font = '400 11px Inter, sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText('** Khách vãng lai', 24, y);
    y += 18;
  }

  ctx.strokeStyle = C.line;
  ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(width - 16, y); ctx.stroke();
  y += 20;
  ctx.textAlign = 'center';
  ctx.font = '400 11px Inter, sans-serif';
  ctx.fillStyle = C.muted;
  ctx.fillText(`Xuất file lúc ${timeStr} ${dateStr}`, width / 2, y);
}
