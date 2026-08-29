const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, enum: ['juice', 'fruit', 'snack'] },
  emoji: { type: String, default: '🍎' },
  unit: { type: String, default: 'piece' },
  stock: { type: Number, default: 100 },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);