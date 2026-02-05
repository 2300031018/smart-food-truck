
const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const { cacheGet, cacheSet, cacheDelByPrefix } = require('../utils/cache');

exports.addItem = asyncHandler(async (req, res) => {
  const { name, price, category, prepTime } = req.body;
  const truck = req.params.truckId || req.body.truck;
  if (!truck) return res.status(400).json({ success: false, error: { message: 'truckId is required' } });
  if (!name || price == null) return res.status(400).json({ success: false, error: { message: 'name and price required' } });
  const item = await MenuItem.create({ truck, name, price, category, prepTime });
  try { await cacheDelByPrefix(`menu:${truck}:`); } catch {}
  res.status(201).json({ success: true, data: item });
});

exports.getMenuForTruck = asyncHandler(async (req, res) => {
  const group = req.query.group === 'category' ? 'category' : 'flat';
  const cacheKey = `menu:${req.params.truckId}:${group}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });
  const items = await MenuItem.find({ truck: req.params.truckId, isAvailable: true }).lean();

  if (req.query.group === 'category') {
    const map = new Map();
    for (const item of items) {
      const cat = (item.category && item.category.trim()) ? item.category.trim() : 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({
        _id: item._id,
        name: item.name,
        category: cat,
        price: item.price,
        priceInINR: `₹ ${item.price}`,
        prepTime: item.prepTime,
        isAvailable: item.isAvailable,
        stockCount: item.stockCount
      });
    }
    const categories = [...map.entries()].map(([name, items]) => ({ name, items }));

    categories.sort((a,b)=> a.name.localeCompare(b.name));
    const payload = { categories };
    await cacheSet(cacheKey, payload, 60);
    return res.json({ success: true, data: payload });
  }
  const withINR = items.map(i => ({ ...i, priceInINR: `₹ ${i.price}`, stockCount: i.stockCount }));
  await cacheSet(cacheKey, withINR, 60);
  res.json({ success: true, data: withINR });
});

exports.updateItem = asyncHandler(async (req, res) => {
  const allowed = ['name', 'price', 'category', 'prepTime', 'isAvailable', 'stockCount'];
  const updates = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
  if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: { message: 'No valid fields to update' } });
  const item = await MenuItem.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!item) return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  if (item.truck) { try { await cacheDelByPrefix(`menu:${item.truck}:`); } catch {} }
  res.json({ success: true, data: item });
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  await item.deleteOne();
  if (item.truck) { try { await cacheDelByPrefix(`menu:${item.truck}:`); } catch {} }
  res.json({ success: true, data: { id: req.params.id, deleted: true } });
});

exports.toggleAvailability = asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  item.isAvailable = !item.isAvailable;
  await item.save();
  if (item.truck) { try { await cacheDelByPrefix(`menu:${item.truck}:`); } catch {} }
  res.json({ success: true, data: item });
});

exports.updateStock = asyncHandler(async (req, res) => {
  const { stockCount, isAvailable } = req.body || {};
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
  
  if (stockCount != null) {
    const n = Number(stockCount);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success:false, error:{ message:'stockCount must be a non-negative number' } });
    item.stockCount = Math.floor(n);
    // Auto-toggle availability when stock hits zero
    if (item.stockCount === 0) item.isAvailable = false;
  }
  if (typeof isAvailable !== 'undefined') {
    item.isAvailable = !!isAvailable;
  }
  await item.save();
  if (item.truck) { try { await cacheDelByPrefix(`menu:${item.truck}:`); } catch {} }
  res.json({ success:true, data: item });
});
