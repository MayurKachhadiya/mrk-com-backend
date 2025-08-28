const express = require('express');
const { addToCart,getCartDetails,cartDelete } = require('../controllers/cartController');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/add', auth, addToCart);
router.get('/details/:id', auth, getCartDetails);
router.post('/delete/', auth, cartDelete)
module.exports = router; 
