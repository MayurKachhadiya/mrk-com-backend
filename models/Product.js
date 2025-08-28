const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  productDescription: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productColor: { type: String, required: true },
  productImages: [{ type: String, required: true }],
  productQuantity: { type: Number, required: true},
  // productRating: { type: Number, required: true},
});

module.exports = mongoose.model('Product', productSchema);
