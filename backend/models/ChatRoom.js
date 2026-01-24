const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({
  type: { type: String, enum: ['order','truck','support'], required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

ChatRoomSchema.index({ type: 1, order: 1 }, { unique: true, partialFilterExpression: { type: 'order' } });
ChatRoomSchema.index({ type: 1, truck: 1 }, { unique: true, partialFilterExpression: { type: 'truck' } });

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
