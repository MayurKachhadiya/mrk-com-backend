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

// helper to extract public_id from cloudinary URL
// function getPublicIdFromUrl(url) {
//   const parts = url.split("/");
//   const folderAndFile = parts.slice(parts.indexOf("upload") + 2).join("/");
//   return folderAndFile.split(".")[0];
// }

const productDelete = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 1️⃣ Delete all product images from Cloudinary
    for (const imageUrl of product.productImages) {
      const publicId = getPublicIdFromUrl(imageUrl);
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted Cloudinary image: ${publicId}`);
      } catch (err) {
        console.error(
          `Failed to delete Cloudinary image ${publicId}:`,
          err.message
        );
      }
    }

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

// helper to extract public_id from cloudinary URL
function getPublicIdFromUrl(url) {
  try {
    // Example: https://res.cloudinary.com/demo/image/upload/v1234567/mrk-ecom/abcd123.jpg
    const parts = url.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    // everything after version number
    const publicIdWithExt = parts.slice(uploadIndex + 2).join("/");
    // remove extension (.jpg, .png, etc.)
    return publicIdWithExt.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

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

  const deletedImages = JSON.parse(deletedImagesRaw || "[]");

  if (!productName || !productDescription || !productPrice || !productColor || !productQuantity) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const productExist = await Product.findOne({ productName, _id: { $ne: id } });
    if (productExist) {
      return res.status(409).json({ message: "Product name already exists for another product" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // ✅ 1. Delete selected images from Cloudinary
    for (const imageUrl of deletedImages) {
      const publicId = getPublicIdFromUrl(imageUrl);
      if (!publicId) continue;

      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted Cloudinary image: ${publicId}`);
      } catch (err) {
        console.error(`Failed to delete Cloudinary image ${publicId}:`, err.message);
      }
    }

    // ✅ 2. Remove deleted images from MongoDB record
    const remainingOldImages = product.productImages.filter(
      (img) => !deletedImages.includes(img)
    );

    // ✅ 3. Upload new files to Cloudinary
    const newImages = [];
    for (const file of files) {
      try {
        const uploadRes = await cloudinary.uploader.upload(file.path, {
          folder: "mrk-ecom",
        });
        newImages.push(uploadRes.secure_url);
      } catch (err) {
        console.error("Failed to upload new image:", err.message);
      }
    }

    // ✅ 4. Merge old + new
    const updatedImages = [...remainingOldImages, ...newImages];

    // ✅ 5. Validate image count
    if (updatedImages.length > 5) {
      return res.status(400).json({ message: "You can upload a maximum of 5 images per product." });
    }
    if (updatedImages.length === 0) {
      return res.status(400).json({ message: "At least 1 image is required for a product." });
    }

    // ✅ 6. Update product in MongoDB
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
