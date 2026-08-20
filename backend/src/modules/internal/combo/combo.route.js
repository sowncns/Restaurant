// src/modules/internal/combo/combo.route.js
const express = require("express");
const controller = require("./combo.controller");
const { requireAuth } = require("../../../shared/middlewares/auth.middleware");
const { authorize } = require("../../../shared/middlewares/role.middleware");
const { validate } = require("../../../shared/middlewares/validate.middleware");
const { createComboSchema, updateComboSchema } = require("./combo.schema");

const router = express.Router();

const adminOnly = authorize("SUPER_ADMIN", "COMPANY_ADMIN");
const canRead = authorize("SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "WAITER", "CASHIER", "KITCHEN");

router.use(requireAuth);

router.get("/", canRead, controller.list);
router.get("/:id", canRead, controller.get);
router.post("/", adminOnly, validate(createComboSchema), controller.create);
router.put("/:id", adminOnly, validate(updateComboSchema), controller.update);
router.delete("/:id", adminOnly, controller.remove);

module.exports = router;
