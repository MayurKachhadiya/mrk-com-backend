const Review = require("../models/Review");

const reviewAdd = async (req, res) => {
  try {
    const { rating, comment, reviewDate, pid, userId } = req.body;
    if (!rating && !comment && (!pid || !userId)) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userReviews = await Review.find({ user: userId });
    const alreadyReviewed = userReviews.some(
      (userReview) => userReview.product.toString() === pid.toString()
    );

    if (alreadyReviewed) {
      return res
        .status(403)
        .json({ message: "You've already reviewed this item." });
    }

    const review = new Review({
      rating,
      comment,
      reviewDate,
      product: pid,
      user: userId,
    });
    await review.save();
    res.status(200).json({ message: "Review added successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const reviewUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, reviewDate, pid, userId } = req.body;
    if (!rating && !comment && (!pid || !userId || !id)) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userReview = await Review.findOne({ _id: id, user: userId });

    if (!userReview) {
      return res.status(404).json({ message: "Review not found" });
    }
    if (rating) {
      userReview.rating = rating;
    }
    if (comment) {
      userReview.comment = comment;
    }
    userReview.reviewDate = reviewDate;
    await userReview.save();
    res.status(200).json({ message: "Review updated successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const reviewDelete = async (req, res) => {
  try {
    const { id } = req.params;    
    const review = await Review.findByIdAndDelete({_id:id});
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.status(200).json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  reviewAdd,
  reviewUpdate,
  reviewDelete,
};
