// src/modules/internal/combo/combo.schema.js
const { z } = require("zod");

const comboItemSchema = z.object({
  menu_item_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1)
});

exports.createComboSchema = z.object({
  company_id: z.coerce.number().int().positive().optional(),
  combo_code: z.string().trim().max(50),
  name: z.string().trim().max(150),
  description: z.string().trim().optional(),
  image_url: z.string().trim().optional(),
  price: z.coerce.number().min(0),
  items: z.array(comboItemSchema).min(1, "Combo phải có ít nhất 1 món")
});

exports.updateComboSchema = z.object({
  company_id: z.coerce.number().int().positive().optional(),
  combo_code: z.string().trim().max(50).optional(),
  name: z.string().trim().max(150).optional(),
  description: z.string().trim().optional(),
  image_url: z.string().trim().optional(),
  price: z.coerce.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  items: z.array(comboItemSchema).min(1).optional()
}).refine((d) => Object.keys(d).length > 0, { message: "Không có dữ liệu cập nhật" });

exports.statusSchema = z.object({
  company_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE'])
});
