// src/modules/internal/combo/combo.service.js
const repo = require("./combo.repository");
const { NotFound, Conflict } = require("../../../shared/errors/AppError");

exports.listCombos = async (companyId, filters) => {
  const combos = await repo.findCombos(companyId, filters);
  // Optionally attach items to each combo if needed, or return as is.
  return combos;
};

exports.getCombo = async (id, companyId) => {
  const combo = await repo.findComboById(id, companyId);
  if (!combo) throw new NotFound("Không tìm thấy combo");
  
  combo.items = await repo.findComboItems(id);
  return combo;
};

exports.createCombo = async (companyId, data) => {
  try {
    const combo = await repo.createCombo(companyId, data);
    combo.items = await repo.findComboItems(combo.id);
    return combo;
  } catch (e) {
    if (e.code === "23505") throw new Conflict("Mã combo đã tồn tại trong công ty này");
    if (e.code === "23503") throw new Conflict("Một hoặc nhiều món ăn không tồn tại");
    throw e;
  }
};

exports.updateCombo = async (id, companyId, data) => {
  await exports.getCombo(id, companyId); // Validate existence
  try {
    const combo = await repo.updateCombo(id, companyId, data);
    if (!combo) throw new NotFound("Không tìm thấy combo");
    combo.items = await repo.findComboItems(id);
    return combo;
  } catch (e) {
    if (e.code === "23505") throw new Conflict("Mã combo đã tồn tại");
    if (e.code === "23503") throw new Conflict("Một hoặc nhiều món ăn không tồn tại");
    throw e;
  }
};

exports.deleteCombo = async (id, companyId) => {
  await exports.getCombo(id, companyId);
  const deleted = await repo.deleteCombo(id, companyId);
  if (!deleted) throw new NotFound("Không tìm thấy combo");
  return deleted;
};
