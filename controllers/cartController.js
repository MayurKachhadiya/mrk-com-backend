const Cart = require("../models/Cart");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "1h";

const addToCart = async (req, res) => {
  const { UserId, ProductId, quantity } = req.body;

  if (!UserId || !ProductId) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    let cart = await Cart.findOne({ user: UserId });

    if (!cart) {
      cart = new Cart({
        user: UserId,
        items: [{ product: ProductId, quantity }],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === ProductId
      );

      if (itemIndex > -1) {
        // update quantity
        cart.items[itemIndex].quantity = quantity;
      } else {
        // add new item
        cart.items.push({ product: ProductId, quantity });
      }
    }

    await cart.save();

    // ✅ single item that was just updated/added
    const singleItem = cart.items.find(
      (item) => item.product.toString() === ProductId
    );

    res.status(201).json({
      message: "Cart updated",
      cart,        // all records
      singleItem,  // only the updated/added record
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const getCartDetails = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const cart = await Cart.findOne({ user: id }).populate("items.product");
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const productDetails = cart.items.map((item) => {
      return {
        ...item._doc,
        productImages: item.product.productImages
      };
    });

    const token = jwt.sign({ cart: productDetails }, JWT_SECRET, {
      expiresIn: TOKEN_TTL,
    });

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const cartDelete = async (req, res) => {
  const { UserId, ProductId } = req.body;
  try {

    const updatedCart = await Cart.findOneAndUpdate(
      { user: UserId },
      { $pull: { items: { product: ProductId } } },
      { new: true } // return updated document
    ).populate("items.product");

    const productDetails = updatedCart.items.map((item) => {
      return {
        ...item._doc,
        productImages: item.product.productImages
      };
    });
    
    if (!productDetails) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const token = jwt.sign({ productDetails }, JWT_SECRET, {
      expiresIn: TOKEN_TTL,
    });
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addToCart,
  getCartDetails,
  cartDelete,
};
