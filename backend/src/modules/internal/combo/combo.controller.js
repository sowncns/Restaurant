// src/modules/internal/combo/combo.controller.js
const { asyncHandler } = require("../../../shared/utils/asyncHandler");
const { BadRequest } = require("../../../shared/errors/AppError");
const service = require("./combo.service");
const audit = require("../../../shared/services/audit.service");
const { parseId } = require("../../../shared/utils/parseId");
const { resolveCompanyId } = require("../../../shared/utils/resolveCompanyId");

exports.list = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const combos = await service.listCombos(resolveCompanyId(req), { status, search });
  res.json({ message: "Lấy danh sách combo thành công", combos });
});

exports.get = asyncHandler(async (req, res) => {
  const combo = await service.getCombo(parseId(req.params.id), resolveCompanyId(req));
  res.json({ message: "Lấy chi tiết combo thành công", combo });
});

exports.create = asyncHandler(async (req, res) => {
  const companyId = resolveCompanyId(req);
  if (!companyId) throw new BadRequest("Thiếu thông tin công ty");
  const combo = await service.createCombo(companyId, req.body);
  audit.record(audit.ctx(req), {
    action: "CREATE", entityType: "COMBO", entityId: combo.id,
    description: `Tạo combo "${combo.name}"`,
  });
  res.status(201).json({ message: "Tạo combo thành công", combo });
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const companyId = resolveCompanyId(req);
  if (!companyId) throw new BadRequest("Thiếu thông tin công ty");
  const combo = await service.updateCombo(id, companyId, req.body);
  audit.record(audit.ctx(req), {
    action: "UPDATE", entityType: "COMBO", entityId: id,
    description: `Cập nhật combo "${combo.name}"`,
  });
  res.json({ message: "Cập nhật combo thành công", combo });
});

exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const companyId = resolveCompanyId(req);
  if (!companyId) throw new BadRequest("Thiếu thông tin công ty");
  await service.deleteCombo(id, companyId);
  audit.record(audit.ctx(req), {
    action: "DELETE", entityType: "COMBO", entityId: id,
    description: `Xóa combo #${id}`,
  });
  res.json({ message: "Đã xóa combo thành công" });
});
