const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const userRoutes = require("./routes/userRoutes");
app.use("/user", userRoutes);
const productRoutes = require("./routes/productRoutes");
app.use("/product", productRoutes);
const cartRoutes = require("./routes/cartRoutes");
app.use("/cart", cartRoutes);
const reviewRoutes = require("./routes/reviewRoutes");
app.use("/review", reviewRoutes);

app.use((err, req, res, next) => {
  // Check custom file filter error (like 'Only images are allowed')
  if (err.message === "Only images are allowed") {
    return res.status(400).json({ message: err.message });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
