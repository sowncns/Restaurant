import { api } from '../lib/api'

export interface ComboItem {
  combo_item_id?: number
  combo_id?: number
  menu_item_id: number
  quantity: number
  menu_item_name?: string
  menu_item_price?: number
}

export interface Combo {
  id: number
  company_id: number
  combo_code: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  status: 'ACTIVE' | 'INACTIVE'
  items?: ComboItem[]
}

export const comboApi = {
  async list(): Promise<Combo[]> {
    const { data } = await api.get('/internal/combos')
    return data.combos
  },
  async get(id: number): Promise<Combo> {
    const { data } = await api.get(`/internal/combos/${id}`)
    return data.combo
  },
  async create(body: any): Promise<Combo> {
    const { data } = await api.post('/internal/combos', body)
    return data.combo
  },
  async update(id: number, body: any): Promise<Combo> {
    const { data } = await api.put(`/internal/combos/${id}`, body)
    return data.combo
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/internal/combos/${id}`)
  }
}
