const fileHelper = require('../util/file');

const { validationResult } = require('express-validator/check');
const Product = require('../models/product');


exports.getAddProduct = (req, res, next) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: [],
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;

  if (!image) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      product: {title: title, price: price, description: description},
      errorMessage: 'Attached file is not an image.',
      hasError: true,
      validationErrors: []
    });

  }
  console.log(image);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      product: {title: title, price: price, description: description},
      errorMessage: errors.array()[0].msg,
      hasError: true,
      validationErrors: errors.array()
    });
  }

  const imageUrl = image.path;

  const product = new Product({
    title: title, 
    price: price, 
    description: description, 
    imageUrl: imageUrl,
    userId: req.user //mongoose will pick _id, no need to write explicitly 
  });
  product.save() //save method provided by mongoose
    .then(result => {
      console.log('Created Product');
      res.redirect('/admin/products');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  //pass in error, express skips all middleware and go directly to an error handling middleware


      // res.redirect('/500');
  
      // return res.status(500).render('admin/edit-product', {
      //   pageTitle: 'Add Product',
      //   path: '/admin/add-product',
      //   editing: false,
      //   product: {title: title, imageUrl: imageUrl, price: price, description: description},
      //   errorMessage: 'Database operation failed, please try again.',
      //   hasError: true,
      //   validationErrors: []
      // });

    });

};

exports.getEditProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: true,
        product: product,
        errorMessage: null,
        hasError: false,
        validationErrors: [],
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/edit-product',
      editing: false,
      errorMessage: errors.array()[0].msg,
      hasError: true,
      editing: true,
      validationErrors: errors.array(),
      product: {title: updatedTitle, price: updatedPrice, description: updatedDesc, _id: prodId}
    });
  }

  Product.findById(prodId)
    .then(product => {
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect('/');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      console.log(image);
      if (image) { //update image if new image is uploaded
        
        fileHelper.deleteFile(product.imageUrl); //does not wait, since there is no callback
        product.imageUrl = image.path;

      }
      return product.save() //save on existing object will perform update
      .then(result => {
        console.log('updated product');
        res.redirect('/admin/products');
      })
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error); 
    });
};


exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.prductId;
  console.log(prodId);
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return next(new Error('product is not found'));
      }
      fileHelper.deleteFile(product.imageUrl);
      return Product.deleteOne({_id: prodId, userId: req.user._id})
    })
    .then(result => {
      console.log('destroyed product');
      res.status(200).json({message: 'Success!'});
    })
    .catch(err => {
      res.status(500).json({message: 'Deleting data failed.'});
    });
};


exports.getProducts = (req, res, next) => {
  Product.find({userId: req.user._id})
    .then(products => {
      res.render('admin/products', {
        prods: products,
        pageTitle: 'Admin Products',
        path: '/admin/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};


