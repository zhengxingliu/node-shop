const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const Product = require('../models/product');
const Order = require('../models/order');

const User = require('../models/user');

const ITEMS_PER_PAGE = 2;


exports.getProducts = (req, res, next) => {
  const page = + req.query.page || 1;
  let totalItems;

  Product.find()   //returns all match, use .find().cursor() to get a cursor  .next()
  // .select('title price -_id') //specify fields to retrive, minus sign - excludes _id
  // .populate('userId','name ') //fetches reference data in relation
    .countDocuments() //return number of products
    .then( numProducts => { 
      totalItems = numProducts;
      return Product.find() 
      .skip((page-1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
    }) 
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        totalProducts: totalItems,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};

exports.getProduct = (req, res, next) => {
  const prodID = req.params.productId;
  Product.findById(prodID)
    .then(product => {
      res.render('shop/product-detail',{
        pageTitle: 'Product Detail',
        path: '/products',
        product: product
      })
    })
    .catch(err => console.log(err))
};


exports.getIndex = (req, res, next) => {
  const page = + req.query.page || 1;
  let totalItems;
  Product.find().countDocuments() //return number of products
    .then( numProducts => { 
      totalItems = numProducts;
      return Product.find() 
      .skip((page-1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
    }) 
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        totalProducts: totalItems,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};

exports.getCart = (req, res, next) => {
  req.user.populate('cart.items.productId') //get data using model ref
    .execPopulate() // populate() itself does not return a promise
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    }) 
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {

      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });


};

exports.postCartDeleteProduct = (req, res, next) => {
  prodId = req.body.productId;
  req.user.removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
}

exports.getCheckout = (req, res, next) => {
  let products;
  let total;
  req.user.populate('cart.items.productId') //get data using model ref
    .execPopulate() // populate() itself does not return a promise
    .then(user => {
      products = user.cart.items;
      total = 0;
      products.forEach(p => {
        total += p.quantity * p.productId.price;
      });
      return stripe.checkout.sessions.create({
        payment_method_types:['card'],
        line_items: products.map(p => {
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100, // in cents
            currency: 'usd',
            quantity: p.quantity
          };
        }),
        success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
        cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
      })  
    })
    .then(session => {
      console.log(session);
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalSum: total,
        sessionId: session.id
      });
    }) 
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};



exports.getCheckoutSuccess = (req, res, next) => {
  req.user.
  populate('cart.items.productId').execPopulate()
    .then(user => {
      console.log(user.cart.items);
      const products = user.cart.items.map(i => {
        return {quantity: i.quantity, product: {...i.productId._doc}  }; //_doc: moongoose method to pass data in prodId without metadata
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(result => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};



exports.getOrders = (req, res, next) => {
  Order.find({'user.userId': req.user._id})
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};


exports.postOrder = (req, res, next) => {
  req.user.
  populate('cart.items.productId').execPopulate()
    .then(user => {
      console.log(user.cart.items);
      const products = user.cart.items.map(i => {
        return {quantity: i.quantity, product: {...i.productId._doc}  }; //_doc: moongoose method to pass data in prodId without metadata
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(result => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode  = 500;
      return next(error);  
    });
};




exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;

  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('New order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized.'));
      }

      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);


      //generate pdf file 
      const pdfDoc = new PDFDocument(); //this is a readable stream
      res.setHeader('Content-Type','application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="'+invoiceName+'"'  //change inline to attachment to download file 
        );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text('Invoice', {underline: true, align: 'center'});
      pdfDoc.moveDown(1);
      pdfDoc.fontSize(12).text(`Order #${order._id}`, {underline:true});
      pdfDoc.moveDown();

      let totalPrice = 0;
      order.products.forEach( prod => {
        pdfDoc.moveDown();
        pdfDoc.fontSize(12).text(`${prod.product.title}: ${prod.quantity} x $${prod.product.price}`);
        totalPrice += prod.quantity * prod.product.price;
      });
      pdfDoc.moveDown(2);
      pdfDoc.text(`Total Price: $${totalPrice}`);
      pdfDoc.end();


      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next();
      //   }
      //   res.setHeader('Content-Type','application/pdf');
      //   res.setHeader('Content-Disposition','inline; filename="'+invoiceName+'"'); //change inline to attachment to download file 
      //   res.send(data);
      // })

      // //streaming file instead of preloading 
      // const file = fs.createReadStream(invoicePath);
      // res.setHeader('Content-Type','application/pdf');
      // res.setHeader(
      //   'Content-Disposition',
      //   'inline; filename="'+invoiceName+'"'  //change inline to attachment to download file 
      //   );
      // file.pipe(res);   //response will be piped to client, so there is no preload that get stuck for large file

    

    })
    .catch(err => next(err));

};