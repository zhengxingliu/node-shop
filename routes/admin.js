const path = require('path');

const express = require('express');
const {check, body} = require('express-validator/check');

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is_auth'); //user login authenticaiton 

const router = express.Router();


router.get('/add-product', isAuth, adminController.getAddProduct);


router.get('/products', isAuth, adminController.getProducts);


router.post('/add-product', isAuth, 
    [
        check('title','Please enter all fields').notEmpty().isString().trim().isLength({max: 50}).withMessage('Title must be less than 50 characters'),
        check('price', 'Please enter all fields').notEmpty().isNumeric(),
        // check('image', 'Please enter all fields').notEmpty(), 
        check('description','Please enter all fields').notEmpty().isString()
    ],
    adminController.postAddProduct);


router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

router.post('/edit-product', isAuth, 
    [
        check('title','Please enter all fields').notEmpty().isString().trim().isLength({max: 50}).withMessage('Title must be less than 50 characters'),
        check('price', 'Please enter all fields').notEmpty().isNumeric(),
        // check('imageUrl', 'Please enter all fields').notEmpty(), 
        check('description','Please enter all fields').notEmpty().isString()
    ],
    adminController.postEditProduct);


router.delete('/product/:prductId', isAuth, adminController.deleteProduct);


module.exports = router;
