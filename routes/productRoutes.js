const express = require('express');
const { productAdd, productsShow, productDelete, productUpdate,productShow, productSearch } = require('../controllers/productController');
const auth = require('../middleware/auth');
const router = express.Router();
// const imageUpload = require('../middleware/imageUpload');
const { upload } = require("../config/cloudinary");

router.post('/add', auth, upload.array('productImages', 10), productAdd);
// router.post('/add', auth, imageUpload.array('productImages', 10), productAdd);
router.post('/show',auth, productsShow);
router.delete('/delete/:id',auth, productDelete);

router.post('/update/:id',auth, upload.array('productImages',10),productUpdate);
router.post('/details/:id',auth, productShow);
router.post('/search',auth, productSearch);
module.exports = router; 
