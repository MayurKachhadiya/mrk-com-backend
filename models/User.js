const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+\@.+\..+/, 'Please enter valid email'],
  },
  password: { type: String, required: true },
  userImage: {type: String},
  userType: { type: String}
});

module.exports = mongoose.model('User', userSchema);
