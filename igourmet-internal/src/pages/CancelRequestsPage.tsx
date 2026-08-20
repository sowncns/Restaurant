import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Check, X, Clock } from 'lucide-react'
import { cancelApi, type CancelRequest, type CancelReason } from '../api/orders'
import { errMsg } from '../lib/errMsg'
import { Button, PageHeader, ErrorText, Badge } from '../components/ui'

const POLL_MS = 15000

const reasonLabel: Record<CancelReason, string> = {
  WRONG_ORDER: 'Gọi nhầm món',
  OUT_OF_STOCK: 'Hết nguyên liệu',
  CUSTOMER_CHANGE: 'Khách đổi ý',
  QUALITY: 'Chất lượng',
  OTHER: 'Lý do khác',
}

export default function CancelRequestsPage() {
  const [rows, setRows] = useState<CancelRequest[]>([])
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    cancelApi
      .list('PENDING')
      .then(setRows)
      .catch((e) => setErr(errMsg(e)))
  }, [])

  useEffect(() => {
    load()
    const t = window.setInterval(load, POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  async function accept(id: number) {
    setBusyId(id)
    setErr('')
    try {
      await cancelApi.accept(id)
      load()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: number, isCombo: boolean) {
    const note = window.prompt(
      isCombo
        ? 'Combo đã bắt đầu làm. Bấm OK → các món con sẽ tách ra thành món lẻ, tiếp tục phục vụ.\nNhập lý do để hiển thị trên từng món con:'
        : 'Lý do từ chối (vd: đã nấu xong):',
      isCombo ? 'Combo bị hủy — phục vụ lẻ từng món' : 'Món đã nấu'
    )
    if (note === null) return
    setBusyId(id)
    setErr('')
    try {
      await cancelApi.reject(id, note)
      load()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Yêu cầu hủy món"
        action={
          <Button variant="secondary" onClick={load}>
            <RefreshCw size={15} /> Làm mới
          </Button>
        }
      />
      <ErrorText>{err}</ErrorText>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Không có yêu cầu hủy nào đang chờ.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const isCombo = !!(r as any).is_combo_parent
            return (
              <div
                key={r.cancel_request_id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${isCombo ? 'border-orange-300' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-base font-semibold text-slate-900">
                      {isCombo && <Badge className="bg-orange-100 text-orange-700">COMBO</Badge>}
                      <span className="truncate">{r.item_name}</span>
                      <span className="text-slate-400 shrink-0">× {r.requested_qty}</span>
                      {r.kitchen_type_name && (
                        <Badge className="bg-slate-100 text-slate-600">{r.kitchen_type_name}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.table_number} · {r.order_code}
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 shrink-0">
                    <Clock size={11} className="mr-1 inline" /> {r.current_kitchen_status}
                  </Badge>
                </div>

                {isCombo && (
                  <div className="mt-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs text-orange-800">
                    ⚠ Các món trong combo đã bắt đầu nấu. "Đã làm rồi" → tách từng món thành món lẻ, không hủy.
                  </div>
                )}

                <div className="mt-2 text-sm text-slate-700">
                  Lý do: <span className="font-medium">{reasonLabel[r.reason_code]}</span>
                  {r.reason_note && <span className="text-slate-500"> — {r.reason_note}</span>}
                </div>
                <div className="text-xs text-slate-400">Phục vụ: {r.requested_by_name ?? '—'}</div>

                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={busyId === r.cancel_request_id}
                    onClick={() => accept(r.cancel_request_id)}
                  >
                    <Check size={15} /> Chấp nhận hủy
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={busyId === r.cancel_request_id}
                    onClick={() => reject(r.cancel_request_id, isCombo)}
                  >
                    <X size={15} /> {isCombo ? 'Đã làm (tách lẻ)' : 'Đã làm rồi'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
