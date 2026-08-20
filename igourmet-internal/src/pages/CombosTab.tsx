import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { comboApi, type Combo, type ComboItem } from '../api/combo'
import { menuApi, type MenuItem } from '../api/menu'
import { errMsg } from '../lib/errMsg'
import { Button, Table, Modal, Input, Select, Badge, ErrorText } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export function CombosTab({ filterCompanyId }: { filterCompanyId: number | '' }) {
  const [list, setList] = useState<Combo[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [editing, setEditing] = useState<Combo | null>(null)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')
  const { staff } = useAuth()
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'COMPANY_ADMIN'

  async function load() {
    try {
      const [combos, items] = await Promise.all([
        comboApi.list(filterCompanyId),
        menuApi.listItems(filterCompanyId)
      ])
      setList(combos)
      setMenuItems(items)
    } catch (e) {
      setErr(errMsg(e))
    }
  }
  useEffect(() => {
    Promise.all([
      comboApi.list(filterCompanyId),
      menuApi.listItems(filterCompanyId),
    ]).then(([combos, items]) => {
      setList(combos)
      setMenuItems(items)
    }).catch((e) => setErr(errMsg(e)))
  }, [filterCompanyId])

  async function remove(id: number, companyId: number) {
    if (!confirm('Xóa combo này?')) return
    try {
      await comboApi.remove(id, companyId)
      void load()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  const filteredCombos = list.filter((c) => (filterCompanyId ? c.company_id === filterCompanyId : true))

  return (
    <div>
      <ErrorText>{err}</ErrorText>
      <div className="mb-3 flex justify-end">
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus size={16} /> Thêm Combo
          </Button>
        )}
      </div>
      <Table headers={['Mã', 'Tên Combo', 'Giá', 'Trạng thái', '']}>
        {filteredCombos.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3 font-medium text-slate-800">{c.combo_code}</td>
            <td className="px-4 py-3">{c.name}</td>
            <td className="px-4 py-3">{Number(c.price).toLocaleString('vi-VN')}đ</td>
            <td className="px-4 py-3">
              <Badge className={c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                {c.status}
              </Badge>
            </td>
            <td className="px-4 py-3 text-right">
              {canManage && (
                <>
                  <button
                    className="mr-2 text-slate-500 hover:text-slate-800"
                    onClick={async () => {
                      const fullCombo = await comboApi.get(c.id, c.company_id)
                      setEditing(fullCombo)
                      setOpen(true)
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button className="text-red-500 hover:text-red-700" onClick={() => remove(c.id, c.company_id)}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {open && (
        <ComboForm
          combo={editing}
          menuItems={menuItems}
          filterCompanyId={filterCompanyId}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function ComboForm({
  combo,
  menuItems,
  filterCompanyId,
  onClose,
  onSaved,
}: {
  combo: Combo | null
  menuItems: MenuItem[]
  filterCompanyId: number | ''
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState(combo?.combo_code ?? '')
  const [name, setName] = useState(combo?.name ?? '')
  const [price, setPrice] = useState(String(combo?.price ?? ''))
  const [description, setDescription] = useState(combo?.description ?? '')
  const [imageUrl, setImageUrl] = useState(combo?.image_url ?? '')
  const [status, setStatus] = useState(combo?.status ?? 'ACTIVE')
  
  const [items, setItems] = useState<ComboItem[]>(
    combo?.items?.length ? combo.items : [{ menu_item_id: menuItems[0]?.menu_item_id || 0, quantity: 1 }]
  )
  
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const addItem = () => setItems([...items, { menu_item_id: menuItems[0]?.menu_item_id || 0, quantity: 1 }])
  const updateItem = (idx: number, field: keyof ComboItem, val: number) => {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: val }
    setItems(next)
  }
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  async function submit() {
    if (items.length === 0) {
      setErr('Phải có ít nhất 1 món ăn trong combo')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const normalizedItems = items.map(i => ({ menu_item_id: Number(i.menu_item_id), quantity: Number(i.quantity) }))
      const originalItems = combo?.items?.map(i => ({
        menu_item_id: Number(i.menu_item_id),
        quantity: Number(i.quantity),
      }))
      const body: any = {
        combo_code: code,
        name,
        description,
        image_url: imageUrl,
        price: Number(price),
        status,
      }
      if (!combo || JSON.stringify(normalizedItems) !== JSON.stringify(originalItems)) body.items = normalizedItems
      if (filterCompanyId) body.company_id = filterCompanyId
      
      if (combo) await comboApi.update(combo.id, body)
      else await comboApi.create(body)
      onSaved()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={combo ? 'Sửa Combo' : 'Thêm Combo'} onClose={onClose}>
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto p-1">
        <Input label="Mã Combo" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input label="Tên Combo" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Giá bán" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        {combo && (
          <Select label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="INACTIVE">Ngừng hoạt động (INACTIVE)</option>
          </Select>
        )}
        <Input label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="URL Ảnh" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        
        <div className="mt-4 border-t pt-4">
          <label className="block text-sm font-medium mb-2">Danh sách món ăn trong Combo</label>
          <div className="flex flex-col gap-3">
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 border rounded">
                <div className="flex-1">
                  <Select value={it.menu_item_id} onChange={(e) => updateItem(idx, 'menu_item_id', Number(e.target.value))}>
                    {menuItems.map(m => (
                      <option key={m.menu_item_id} value={m.menu_item_id}>{m.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <Input type="number" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                </div>
                <button className="text-red-500 hover:bg-red-100 p-2 rounded" onClick={() => removeItem(idx)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <Button variant="secondary" onClick={addItem} className="self-start">
              <Plus size={16} /> Thêm món
            </Button>
          </div>
        </div>

        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2 mt-4 border-t pt-4">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
        </div>
      </div>
    </Modal>
  )
}
