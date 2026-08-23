import { useEffect, useState, useMemo } from 'react'
import { Plus, Wand2, LogIn, RefreshCw, AlertTriangle, CalendarClock, Phone, Users, Search, Trash2 } from 'lucide-react'
import {
  reservationsApi,
  type Reservation,
  type ReservationStatus,
  type ReservationAlert,
  type AlertState,
} from '../api/reservations'
import { tablesApi, type DiningTable } from '../api/tables'
import { useRealtime } from '../lib/useRealtime'
import { errMsg } from '../lib/errMsg'
import { Button, PageHeader, Table, Modal, Input, Select, Badge, ErrorText } from '../components/ui'
import { cn } from '../lib/cn'

const STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]

const statusLabel: Record<ReservationStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xếp bàn',
  CHECKED_IN: 'Đã đến',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
}

const statusStyle: Record<ReservationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  CHECKED_IN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  COMPLETED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  NO_SHOW: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
}

const alertStyle: Record<AlertState, string> = {
  READY: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
  NO_TABLE: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  CONFLICT: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  OVERDUE: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
}

export default function ReservationsPage() {
  const [list, setList] = useState<Reservation[]>([])
  const [tables, setTables] = useState<DiningTable[]>([])
  const [alerts, setAlerts] = useState<ReservationAlert[]>([])
  const [open, setOpen] = useState(false)
  const [reschedule, setReschedule] = useState<Reservation | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [rs, ts, al] = await Promise.all([
        reservationsApi.list(),
        tablesApi.list(),
        reservationsApi.getAlerts().catch(() => []),
      ])
      setList(rs)
      setTables(ts)
      setAlerts(al)
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Khach dat ban / doi trang thai -> refetch ngay (chi chi nhanh cua le tan nay).
  useRealtime('/internal/reservations/stream', load)

  async function act<T>(fn: () => Promise<T>) {
    try {
      await fn()
      await load()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  async function suggestAndAssign(r: Reservation) {
    try {
      const t = await reservationsApi.suggestTable(r.id)
      if (!t) return alert('Không còn bàn trống phù hợp.')
      if (!confirm(`Gợi ý bàn ${t.table_number} (${t.capacity} chỗ). Gán bàn này?`)) return
      await reservationsApi.assignTable(r.id, t.id)
      await load()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((r) => {
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false
      if (q) {
        return [r.customer_name, r.customer_phone, r.reservation_code, r.table_number]
          .some((val) => (val ?? '').toString().toLowerCase().includes(q))
      }
      return true
    })
  }, [list, filterStatus, search])

  return (
    <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
      <PageHeader
        title="Quản Lý Đặt Bàn"
        action={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading} className="shrink-0">
              <RefreshCw size={15} /> Làm mới
            </Button>
            <Button onClick={() => setOpen(true)} size="sm" className="shrink-0">
              <Plus size={16} /> Tạo phiếu mới
            </Button>
          </div>
        }
      />

      {/* Cảnh báo trước giờ hẹn */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-xl border p-3 text-xs md:text-sm ${alertStyle[a.state]}`}
            >
              <span className="flex items-center gap-2 font-medium">
                <AlertTriangle size={16} className="shrink-0" /> {a.message}
              </span>
              {a.state === 'NO_TABLE' && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs font-bold shrink-0 self-end sm:self-auto"
                  onClick={() => {
                    const r = list.find((x) => x.id === a.id)
                    if (r) void suggestAndAssign(r)
                  }}
                >
                  <Wand2 size={13} /> Gợi ý bàn
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Thanh tìm kiếm & Bộ lọc trạng thái */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Tìm theo tên, SĐT, mã đặt bàn, số bàn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>

        {/* Status Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { key: 'ALL', label: `Tất cả (${list.length})` },
            { key: 'PENDING', label: `Chờ xếp (${list.filter((x) => x.status === 'PENDING').length})` },
            { key: 'CONFIRMED', label: `Đã xếp (${list.filter((x) => x.status === 'CONFIRMED').length})` },
            { key: 'CHECKED_IN', label: `Đã đến (${list.filter((x) => x.status === 'CHECKED_IN').length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-all select-none cursor-pointer',
                filterStatus === tab.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorText>{err}</ErrorText>

      {/* MOBILE VIEW (< md): Touch-Friendly Cards */}
      <div className="block md:hidden space-y-3">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-medium">
            Không có phiếu đặt bàn nào phù hợp
          </div>
        ) : (
          filteredList.map((r) => (
            <div
              key={r.id}
              data-testid="reservation-row"
              data-reservation-id={r.id}
              data-phone={r.customer_phone}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
            >
              {/* Header: Code, Time, Status */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      #{r.reservation_code}
                    </span>
                    <Badge className={statusStyle[r.status]}>
                      {statusLabel[r.status] || r.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                    <CalendarClock size={13} className="text-slate-400" />
                    <span>
                      {r.reservation_date} · <strong className="text-slate-800 dark:text-slate-200">{r.reservation_time?.slice(0, 5)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="neutral" className="text-xs font-semibold">
                    <Users size={11} className="mr-1 inline" /> {r.guest_count} khách
                  </Badge>
                </div>
              </div>

              {/* Customer Info & Phone */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {r.customer_name}
                  </div>
                  <a
                    href={`tel:${r.customer_phone}`}
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline mt-0.5"
                  >
                    <Phone size={12} /> {r.customer_phone}
                  </a>
                </div>

                {/* Table assignment selector on mobile */}
                <div className="flex items-center gap-1.5 max-w-[170px]">
                  <Select
                    data-testid="reservation-table-select"
                    value={r.table_id ?? ''}
                    onChange={(e) => e.target.value && act(() => reservationsApi.assignTable(r.id, Number(e.target.value)))}
                    className="h-8 text-xs py-0"
                  >
                    <option value="">-- Chưa gán bàn --</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.table_name || `Bàn ${t.table_number}`} ({t.capacity}c)
                      </option>
                    ))}
                  </Select>
                  <button
                    title="Gợi ý bàn trống"
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 shrink-0"
                    onClick={() => void suggestAndAssign(r)}
                  >
                    <Wand2 size={14} />
                  </button>
                </div>
              </div>

              {/* Action Buttons on Mobile */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 flex-1">
                  <Button
                    data-testid="reservation-checkin-button"
                    variant="primary"
                    size="sm"
                    className="flex-1 h-9 text-xs font-bold"
                    onClick={() => act(() => reservationsApi.checkin(r.id, r.table_id ?? undefined))}
                    disabled={r.status === 'CHECKED_IN' || r.status === 'COMPLETED' || r.status === 'CANCELLED'}
                  >
                    <LogIn size={14} /> Check-in
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 text-xs shrink-0"
                    onClick={() => setReschedule(r)}
                  >
                    <CalendarClock size={14} /> Đổi lịch
                  </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Select
                    data-testid="reservation-status-select"
                    value={r.status}
                    onChange={(e) => act(() => reservationsApi.changeStatus(r.id, e.target.value as ReservationStatus))}
                    className="h-9 text-xs py-0 w-28"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s] || s}
                      </option>
                    ))}
                  </Select>
                  <button
                    onClick={() => act(() => reservationsApi.cancel(r.id))}
                    className="h-9 w-9 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center shrink-0"
                    title="Hủy đặt bàn"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP VIEW (>= md): Full ERP Table */}
      <div className="hidden md:block">
        <Table headers={['Mã', 'Khách', 'SĐT', 'Ngày giờ', 'Số khách', 'Bàn', 'Trạng thái', 'Thao tác']}>
          {filteredList.map((r) => (
            <tr key={r.id} data-testid="reservation-row" data-reservation-id={r.id} data-phone={r.customer_phone}>
              <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                {r.reservation_code}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{r.customer_name}</td>
              <td className="px-4 py-3">
                <a href={`tel:${r.customer_phone}`} className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                  {r.customer_phone}
                </a>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                {r.reservation_date} <strong>{r.reservation_time?.slice(0, 5)}</strong>
              </td>
              <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{r.guest_count}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Select
                    data-testid="reservation-table-select"
                    value={r.table_id ?? ''}
                    onChange={(e) => e.target.value && act(() => reservationsApi.assignTable(r.id, Number(e.target.value)))}
                    className="py-1 text-xs"
                  >
                    <option value="">-- Chưa gán --</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.table_name || t.table_number} ({t.capacity}c)
                      </option>
                    ))}
                  </Select>
                  <button
                    title="Gợi ý bàn trống"
                    className="p-1 text-slate-500 hover:text-emerald-600"
                    onClick={() => void suggestAndAssign(r)}
                  >
                    <Wand2 size={16} />
                  </button>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge className={statusStyle[r.status]}>
                  {statusLabel[r.status] || r.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Select
                    data-testid="reservation-status-select"
                    value={r.status}
                    onChange={(e) => act(() => reservationsApi.changeStatus(r.id, e.target.value as ReservationStatus))}
                    className="py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s] || s}
                      </option>
                    ))}
                  </Select>
                  <Button variant="secondary" size="sm" onClick={() => setReschedule(r)} className="text-xs">
                    <CalendarClock size={13} /> Đổi lịch
                  </Button>
                  <Button
                    data-testid="reservation-checkin-button"
                    variant="secondary"
                    size="sm"
                    onClick={() => act(() => reservationsApi.checkin(r.id, r.table_id ?? undefined))}
                    disabled={r.status === 'CHECKED_IN' || r.status === 'COMPLETED' || r.status === 'CANCELLED'}
                    className="text-xs"
                  >
                    <LogIn size={13} /> Check-in
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => act(() => reservationsApi.cancel(r.id))} className="text-xs">
                    Hủy
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {open && (
        <ReservationForm
          tables={tables}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            void load()
          }}
        />
      )}

      {reschedule && (
        <RescheduleForm
          reservation={reschedule}
          onClose={() => setReschedule(null)}
          onSaved={() => {
            setReschedule(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function RescheduleForm({
  reservation,
  onClose,
  onSaved,
}: {
  reservation: Reservation
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(reservation.reservation_date)
  const [time, setTime] = useState(reservation.reservation_time?.slice(0, 5) ?? '')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    setErr('')
    try {
      await reservationsApi.update(reservation.id, {
        reservation_date: date,
        reservation_time: time,
      })
      onSaved()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={`Đổi lịch hẹn · ${reservation.customer_name}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Ngày (YYYY-MM-DD)" value={date} onChange={(e) => setDate(e.target.value)} placeholder="2026-07-08" />
        <Input label="Giờ (HH:mm)" value={time} onChange={(e) => setTime(e.target.value)} placeholder="19:00" />
        <p className="text-xs text-slate-500">
          Nếu bàn này đã đặt món trước, bếp sẽ được báo là lịch hẹn đã thay đổi.
        </p>
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu lịch mới'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ReservationForm({
  tables,
  onClose,
  onSaved,
}: {
  tables: DiningTable[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [guests, setGuests] = useState('2')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [tableId, setTableId] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    setErr('')
    try {
      await reservationsApi.create({
        customer_name: name,
        customer_phone: phone,
        customer_email: email || undefined,
        guest_count: Number(guests),
        reservation_date: date,
        reservation_time: time,
        table_id: tableId ? Number(tableId) : undefined,
        note: note || undefined,
      })
      onSaved()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Tạo phiếu đặt bàn (khách vãng lai)" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Tên khách *" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Số điện thoại *" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email (tùy chọn)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Số khách" type="number" value={guests} onChange={(e) => setGuests(e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Ngày (YYYY-MM-DD)" value={date} onChange={(e) => setDate(e.target.value)} placeholder="2026-07-08" />
          <Input label="Giờ (HH:mm)" value={time} onChange={(e) => setTime(e.target.value)} placeholder="19:00" />
        </div>
        <Select label="Bàn (tùy chọn)" value={tableId} onChange={(e) => setTableId(e.target.value)}>
          <option value="">-- Chưa gán --</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.table_name || t.table_number} ({t.capacity} chỗ)
            </option>
          ))}
        </Select>
        <Input label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu phiếu'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
