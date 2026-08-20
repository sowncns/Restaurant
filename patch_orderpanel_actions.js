const fs = require('fs');
const p = 'igourmet-internal/src/components/orders/OrderPanel.tsx';
let data = fs.readFileSync(p, 'utf8');

const t = `                  {/* Actions */}
                  {!it.is_mistake && !it.has_pending_cancel && it.kitchen_status !== 'CANCELLED' && (
                    <div className="mt-2 flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      {isReady && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 h-8 text-xs font-bold"
                          disabled={busy}
                          onClick={() => onServe(it.order_item_id)}
                        >
                          <Check size={14} /> Phục vụ
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        disabled={busy}
                        onClick={() => onRequestCancel(it)}
                      >
                        <X size={14} /> {it.kitchen_status === 'WAITING' ? 'Hủy món' : 'Báo nhầm'}
                      </Button>
                    </div>
                  )}`;

const r = `                  {/* Actions */}
                  {!it.is_mistake && !it.has_pending_cancel && it.kitchen_status !== 'CANCELLED' && (isReady || !it.is_combo_parent) && (
                    <div className="mt-2 flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      {isReady && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 h-8 text-xs font-bold"
                          disabled={busy}
                          onClick={() => onServe(it.order_item_id)}
                        >
                          <Check size={14} /> Phục vụ
                        </Button>
                      )}
                      {!it.is_combo_parent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-8 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          disabled={busy}
                          onClick={() => onRequestCancel(it)}
                        >
                          <X size={14} /> {it.kitchen_status === 'WAITING' ? 'Hủy món' : 'Báo nhầm'}
                        </Button>
                      )}
                    </div>
                  )}`;

data = data.replace(t, r);
fs.writeFileSync(p, data);
console.log('patched OrderPanel actions');
