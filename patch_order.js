const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "backend", "src", "modules", "internal", "order", "order.service.js");
let content = fs.readFileSync(p, "utf8");

const oldBuildItems = `// Tinh gia + VAT cho danh sach mon, dua tren menu_items lay tu DB
function buildItems(orderItems, menuById, { requireAvailable }) {
  let subtotal = 0;
  let totalVat = 0;
  const items = [];

  for (const item of orderItems) {
    const food = menuById.get(item.menu_item_id);
    if (!food) throw new NotFound(\`Menu item \${item.menu_item_id} not found.\`);
    const inactive = food.status.toUpperCase() !== "ACTIVE";
    const unavailable = requireAvailable && food.is_available === false;
    if (inactive || unavailable) throw new BadRequest(\`\${food.name} is unavailable.\`);

    const totalPrice = Number(food.price) * Number(item.quantity);
    const vatRate = Number(food.vat) || 0;
    const vatAmount = (totalPrice * vatRate) / 100;

    subtotal += totalPrice;
    totalVat += vatAmount;
    items.push({
      menu_item_id: food.id,
      item_name: food.name,
      unit_price: food.price,
      quantity: item.quantity,
      total_price: totalPrice,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      note: item.note || null,
    });
  }
  return { items, subtotal, totalVat };
}`;

const newBuildItems = `// Tinh gia + VAT cho danh sach mon, dua tren menu_items lay tu DB
function buildItems(orderItems, menuById, { requireAvailable }) {
  let subtotal = 0;
  let totalVat = 0;
  const items = [];

  for (const item of orderItems) {
    if (item.is_combo_parent) {
      const totalPrice = Number(item.price) * Number(item.quantity);
      subtotal += totalPrice;
      items.push({
        menu_item_id: null,
        combo_id: item.combo_id,
        is_combo_parent: true,
        item_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
        total_price: totalPrice,
        vat_rate: 0,
        vat_amount: 0,
        note: item.note || null,
      });
      continue;
    }

    const food = menuById.get(item.menu_item_id);
    if (!food) throw new NotFound(\`Menu item \${item.menu_item_id} not found.\`);
    const inactive = food.status.toUpperCase() !== "ACTIVE";
    const unavailable = requireAvailable && food.is_available === false;
    if (inactive || unavailable) throw new BadRequest(\`\${food.name} is unavailable.\`);

    const unitPrice = item.is_combo_child ? 0 : Number(food.price);
    const totalPrice = unitPrice * Number(item.quantity);
    const vatRate = item.is_combo_child ? 0 : (Number(food.vat) || 0);
    const vatAmount = (totalPrice * vatRate) / 100;

    subtotal += totalPrice;
    totalVat += vatAmount;
    items.push({
      menu_item_id: food.id,
      combo_id: item.combo_id || null,
      is_combo_parent: false,
      item_name: food.name,
      unit_price: unitPrice,
      quantity: item.quantity,
      total_price: totalPrice,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      note: item.note || null,
    });
  }
  return { items, subtotal, totalVat };
}

async function expandCombos(client, orderItems) {
  if (!orderItems || !orderItems.length) return [];
  const result = [];
  const comboIds = orderItems.filter(i => i.is_combo).map(i => i.combo_id);
  
  if (comboIds.length === 0) return orderItems;

  const { rows: combos } = await client.query(\`SELECT combo_id, name, price, status FROM combos WHERE combo_id = ANY($1::int[])\`, [comboIds]);
  const { rows: comboItems } = await client.query(\`SELECT combo_id, menu_item_id, quantity FROM combo_items WHERE combo_id = ANY($1::int[])\`, [comboIds]);
  
  const comboMap = new Map(combos.map(c => [c.combo_id, c]));
  const comboItemsMap = new Map();
  for (const ci of comboItems) {
    if (!comboItemsMap.has(ci.combo_id)) comboItemsMap.set(ci.combo_id, []);
    comboItemsMap.get(ci.combo_id).push(ci);
  }

  for (const item of orderItems) {
    if (!item.is_combo) {
      result.push(item);
      continue;
    }

    const combo = comboMap.get(item.combo_id);
    if (!combo || combo.status !== 'ACTIVE') throw new BadRequest(\`Combo \${item.combo_id} không tồn tại hoặc đã ngừng bán.\`);

    result.push({
      combo_id: combo.combo_id,
      is_combo_parent: true,
      name: combo.name,
      price: combo.price,
      quantity: item.quantity,
      note: item.note
    });

    const cItems = comboItemsMap.get(combo.combo_id) || [];
    for (const cItem of cItems) {
      result.push({
        menu_item_id: cItem.menu_item_id,
        combo_id: combo.combo_id,
        is_combo_child: true,
        quantity: item.quantity * cItem.quantity,
        note: null
      });
    }
  }
  return result;
}`;

content = content.replace(oldBuildItems, newBuildItems);

// Now patch createOrder
const oldCreateOrder = `const menuRows = order_items?.length ? await repo.findMenuItems(client, order_items.map((i) => i.menu_item_id), branch_id) : [];
    const menuById = new Map(menuRows.map((r) => [r.id, r]));
    const { items, subtotal, totalVat } = order_items?.length ? buildItems(order_items, menuById, { requireAvailable: true }) : { items: [], subtotal: 0, totalVat: 0 };`;

const newCreateOrder = `const expandedItems = await expandCombos(client, order_items);
    const menuIds = expandedItems.map(i => i.menu_item_id).filter(id => id != null);
    const menuRows = menuIds.length ? await repo.findMenuItems(client, menuIds, branch_id) : [];
    const menuById = new Map(menuRows.map((r) => [r.id, r]));
    const { items, subtotal, totalVat } = expandedItems.length ? buildItems(expandedItems, menuById, { requireAvailable: true }) : { items: [], subtotal: 0, totalVat: 0 };`;

content = content.replace(oldCreateOrder, newCreateOrder);

// Now patch addOrderItems
const oldAddOrderItems = `const menuRows = await repo.findMenuItems(client, reqItems.map((i) => i.menu_item_id), branch_id);
    const menuById = new Map(menuRows.map((r) => [r.id, r]));
    const { items, subtotal, totalVat } = buildItems(reqItems, menuById, { requireAvailable: false });`;

const newAddOrderItems = `const expandedItems = await expandCombos(client, reqItems);
    const menuIds = expandedItems.map(i => i.menu_item_id).filter(id => id != null);
    const menuRows = menuIds.length ? await repo.findMenuItems(client, menuIds, branch_id) : [];
    const menuById = new Map(menuRows.map((r) => [r.id, r]));
    const { items, subtotal, totalVat } = buildItems(expandedItems, menuById, { requireAvailable: false });`;

content = content.replace(oldAddOrderItems, newAddOrderItems);

fs.writeFileSync(p, content);
console.log("Patched order.service.js successfully!");
