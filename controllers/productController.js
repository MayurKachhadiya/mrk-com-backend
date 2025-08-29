const Product = require("../models/Product");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const Cart = require("../models/Cart");
const Review = require("../models/Review");
const { cloudinary } = require("../config/cloudinary");
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "1h";

const productAdd = async (req, res) => {
  const files = req.files;

  const {
    productName,
    productDescription,
    productPrice,
    productColor,
    productQuantity,
  } = req.body;

  if (
    !productName ||
    !productDescription ||
    !productPrice ||
    !productColor ||
    !productQuantity ||
    !files ||
    files.length === 0
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const productExist = await Product.findOne({ productName });
    if (productExist) {
      return res.status(409).json({ message: "Product already exists" });
    }

    // const productImages = files.map((file) => file.filename);
    const productImages = files.map((file) => file.path); // Cloudinary gives file.path = hosted URL
    const newProduct = new Product({
      productName,
      productDescription,
      productPrice,
      productColor,
      productQuantity,
      productImages,
    });
    await newProduct.save();
    res.status(201).json({ message: "Product created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const productsShow = async (req, res) => {
  try {
    const { currentPage } = req.body;
    const products = await Product.find();
    // create image URL
    const filteredProducts = products.map((product) => {
      return {
        ...product._doc,
        productImages: product.productImages,
      };
    });
    const rowsPerPage = 10;
    const startIndex = currentPage * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const totalRecords = filteredProducts.length;
    const updatedProducts = filteredProducts.slice(startIndex, endIndex);

    const token = jwt.sign(
      { products: updatedProducts, totalRecords },
      JWT_SECRET,
      {
        expiresIn: TOKEN_TTL,
      }
    );

    res.status(200).json({ message: "Products fetched", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const productShow = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const { page, limit } = req.query;
    const skip = (page - 1) * limit;

    // Find the product
    const productFind = await Product.findById(id);
    if (!productFind) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get reviews for that product and populate user (only name)
    const reviews = await Review.find({ product: id })
      .populate("user", "name userImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const allReviews = await Review.find({ product: id })
      .populate("user", "name userImage") // only get user's name
      .lean();

    // create image URL
    const productDetails = {
      ...productFind._doc,
      productImages: productFind.productImages,
    };

    const avgRating =
      allReviews.reduce((sum, review) => sum + review.rating, 0) /
      allReviews.length;

    // const avgRating =
    //   allReviews.length > 0
    //     ? allReviews.reduce((sum, review) => sum + review.rating, 0) /
    //       allReviews.length
    //     : 0;

    const reviewsData = reviews.map((review) => ({
      ...review,
      user: {
        ...review.user,
        userImage: review.user.userImage
          ? `http://localhost:5000/uploads/${review.user.userImage}`
          : null,
      },
      avgRating: avgRating.toFixed(1),
      totalReviews: allReviews.length,
    }));

    // Check if product exists in user's cart
    const cartItem = await Cart.findOne(
      { user: userId, "items.product": id },
      { "items.$": 1 }
    );

    let quantity = 0;
    if (cartItem && cartItem.items.length > 0) {
      quantity = cartItem.items[0].quantity;
    }

    // Generate token
    const token = jwt.sign(
      {
        product: productDetails,
        productQuantity: quantity,
        reviews: reviewsData,
        avgRating: avgRating,
        allReviews: allReviews,
        page,
        limit,
        hasMore: reviewsData.length === limit,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL }
    );

    res.status(200).json({ message: "Product fetched", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const productDelete = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Optionally delete image files
    product.productImages.forEach((filename) => {
      const filepath = path.join(__dirname, "..", "uploads", filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    // Get updated list of products
    const products = await Product.find();
    const updatedProducts = products.map((product) => ({
      ...product._doc,
      productImages: product.productImages,
    }));

    const token = jwt.sign({ products: updatedProducts }, JWT_SECRET, {
      expiresIn: TOKEN_TTL,
    });

    res.status(200).json({ message: "Product deleted", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const productUpdate = async (req, res) => {
  const { id } = req.params;
  const files = req.files;
  const {
    productName,
    productDescription,
    productPrice,
    productColor,
    productQuantity,
    deletedImages: deletedImagesRaw,
  } = req.body;

  const deletedImages = JSON.parse(deletedImagesRaw || "[]"); // contains full URLs

  if (
    !productName ||
    !productDescription ||
    !productPrice ||
    !productColor ||
    !productQuantity
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const productExist = await Product.findOne({
      productName,
      _id: { $ne: id },
    });
    if (productExist) {
      return res
        .status(409)
        .json({ message: "Product name already exists for another product" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 1️⃣ Delete selected images from Cloudinary using extracted public_id
    for (const imageUrl of deletedImages) {
      const publicId = imageUrl
        .split("/")
        .slice(-2) // take last 2 segments: folder + filename
        .join("/")
        .split(".")[0]; // remove extension

      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error(
          `Failed to delete Cloudinary image ${publicId}:`,
          err.message
        );
      }
    }

    // 2️⃣ Keep remaining images in MongoDB
    const remainingOldImages = product.productImages.filter(
      (imgUrl) => !deletedImages.includes(imgUrl)
    );
    console.log("files==========", files);

    // 3️⃣ Add newly uploaded images (URLs only)
    const newImages = files.map((file) => file.path);
    console.log("remainingOldImages---------", remainingOldImages);
    console.log("newImages---------", newImages);
    const updatedImages = [...remainingOldImages, ...newImages];

    // 4️⃣ Validate image count
    if (updatedImages.length > 5) {
      return res.status(400).json({
        message: "You can upload a maximum of 5 images per product.",
      });
    }
    if (updatedImages.length === 0) {
      return res.status(400).json({
        message: "At least 1 image is required for a product.",
      });
    }

    // 5️⃣ Update product fields
    product.productName = productName;
    product.productDescription = productDescription;
    product.productPrice = productPrice;
    product.productColor = productColor;
    product.productQuantity = productQuantity;
    product.productImages = updatedImages;

    await product.save();
    res.status(200).json({ message: "Product updated successfully", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const productSearch = async (req, res) => {
  try {
    const { pname } = req.query;
    const { currentPage, rowPerPage } = req.body;
    const products = await Product.find({
      productName: { $regex: pname, $options: "i" },
    });

    const filteredProducts = products.map((product) => ({
      ...product._doc,
      productImages: product.productImages,
    }));
    const rowsPerPage = rowPerPage;
    const startIndex = currentPage * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const totalRecords = filteredProducts.length;
    const updatedProducts = filteredProducts.slice(startIndex, endIndex);
    res.status(200).json({ filteredProducts: updatedProducts, totalRecords });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  productAdd,
  productsShow,
  productDelete,
  productUpdate,
  productShow,
  productSearch,
};
