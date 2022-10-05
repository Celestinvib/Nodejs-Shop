const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const PDFDocument = require('pdfkit');

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 4;

exports.getProducts = (req, res, next) => {
  //To transform in the const the string passed in the req to number we use +
  const page = +req.query.page || 1 ; //If the req var has not value it will be 1
  let totalItems;

  Product.find().countDocuments()
  .then(numProducts => {
    totalItems = numProducts;
      return  Product.find()
      //Skip all the products before the current page display set and limit the products showed in the current
      .skip((page -1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
  }).then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'Products',
        path: '/products',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page -1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1 ; 
  let totalItems;

  Product.find().countDocuments()
  .then(numProducts => {
    totalItems = numProducts;
      return  Product.find()
      //Skip all the products before the current page display set and limit the products showed in the current
      .skip((page -1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
  }).then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page -1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
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
      error.httpStatusCode = 500;
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
    }).catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });;
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};
 
  exports.getCheckout = (req, res, next) => {
    let products;
    let total = 0;
    req.user
      .populate("cart.items.productId")
      .execPopulate()
      .then((user) => {
        products = user.cart.items;
        total = 0;
        products.forEach((p) => {
          total += p.quantity * p.productId.price;
        });
   
        return stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: products.map((p) => {
            return {
              quantity: p.quantity,
              price_data: {
                currency: "eur",
                unit_amount: p.productId.price * 100,
                product_data: {
                  name: p.productId.title,
                  description: p.productId.description,
                },
              },
            };
          }),
          customer_email: req.user.email,
          success_url:
            req.protocol + "://" + req.get("host") + "/checkout/success",
          cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel",
        });
      })
      .then((session) => {
        res.render("shop/checkout", {
          path: "/checkout",
          pageTitle: "Checkout",
          products: products,
          totalSum: total,
          sessionId: session.id,
        });
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  };

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
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
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.getInvoice = (req,res, next) => {
  
  const orderId = req.params.orderId;

  Order.findById(orderId)
  .then(order => {
    if(!order) {
      return next(new Error('No order found.'));
    }

    //If the user trying to view the order is not the same as the user who make the order
    if(order.user.userId.toString() !== req.user._id.toString()) { 
      return next(new Error('Unauthorized'));
    }

    const invoiceName = 'invoice-' + orderId + '.pdf';
    const invoicePath = path.join('data', 'invoices',invoiceName); //Get the path in which the invoice would has been stored
    
    const pdfDoc = new PDFDocument();
    res.setHeader('Content-Type','application/pdf');
    res.setHeader(
      'Content-Disposition',
    'filename="'+ invoiceName +'"'
    );    
    pdfDoc.pipe(fs.createWriteStream(invoicePath));//Stored the pdf on the server
    pdfDoc.pipe(res); //Return it to the client

    pdfDoc.fontSize(26).text('invoice',{
      underline:true
    });
    
    pdfDoc.fontSize(14).text('=======================');

    let totalPrice = 0;

    order.products.forEach(prod => {
      
      totalPrice += prod.quantity * prod.product.price;
      
      pdfDoc.text(
        prod.product.title + ' - '+
      prod.quantity + ' - ' + 
      prod.product.price + ' €'
      );
    });
    pdfDoc.text('=======================');
    pdfDoc.fontSize(20).text('Total price = '+totalPrice+" €")

    pdfDoc.end(); //When we are done writing the res is send

    // fs.readFile(invoicePath, (err,data) => {
    //   if(err) { 
    //     return next(err); 
    //   } //if the file exist
    //   res.setHeader('Content-Type','application/pdf');
    //   // res.setHeader('Content-Disposition','inline; file...'); //The file will be open in the current tap , can be attachment to (to open the download panel)
    //   res.setHeader('Content-Disposition','filename="'+ invoiceName +'"');
    //   res.send(data);
    // });
    
    //The code above can be a problem for the server is the file uploaded are too big
    //With this method node don't read all the data in the file it only send it to the browser and he does the job
    // const file = fs.createReadStream(invoicePath);

    // file.pipe(res);

  }).catch(err => next(err));

 
};