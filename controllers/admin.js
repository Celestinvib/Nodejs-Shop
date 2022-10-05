const  fileHelper = require('../util/file');

const { validationResult } = require('express-validator/check')
const Product = require('../models/product');


exports.getAddProduct = (req, res, next) => {
  if (!req.session.isLoggedIn) {
    return res.redirect('/login');
  }
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError:false,
    errorMessage: null,
    validationErrors: []
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;
  
  if(!image) {
    return   res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description
      },
      errorMessage: 'Attached file is not an image',
      validationErrors: []
    });
  }

  const imageUrl = image.path;

  const product = new Product({
    title: title,
    price: price,
    description: description,
    imageUrl: imageUrl,
    userId: req.user
  });
  product
    .save()
    .then(result => {
      // console.log(result);
      console.log('Created Product');
      res.redirect('/admin/products');
    })
    .catch(err => { 
      //For temporaly Technical server issue
      //  res.status(500).render('admin/edit-product', {
      //   pageTitle: 'Add Product',
      //   path: '/admin/add-product',
      //   editing: false,
      //   hasError: true,
      //   product: {
      //     title: title,
      //     imageUrl: imageUrl,
      //     price: price,
      //     description: description
      //   },
      //   errorMessage:'Database operation failed, plese try again.',
      //   validationErrors: []
      // });
      // res.redirect('/500');
      const error = new Error(err);
      error.httpStatusCode = 500;
      //When next is called with an error express know that an error occurred and it go pass all middlewares to an error middleware
      return next(error);   
    });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect('/');
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return res.redirect('/');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: editMode,
        product: product,
        hasError:false,
        errorMessage: null,
        validationErrors: []
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      //When next is called with an error express know that an error occurred and it go pass all middlewares to an error middleware
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
      editing: true,
      hasError: true,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array()
    });
  }

  Product.findById(prodId)
    .then(product => {
      if(product.userId.toString() !== req.user._id.toString()) {  //if a user that is not who created the book is tring to edit it
        return res.redirect('/');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      
      if(image) { //If the image is undifined (the user has not updated the image) it doesn't updated
        fileHelper.deleteFile(product.imageUrl);
        product.imageUrl = image.path;

      }

      return product.save() 
      .then(result => {
        console.log('UPDATED PRODUCT!');
        res.redirect('/admin/products');
      });
    })  
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.getProducts = (req, res, next) => {
  Product.find({userId: req.user._id}) //Adds a filter and now ony products that has been created by the current user will  be show
    // .select('title price -_id')
    // .populate('userId', 'name')
    .then(products => {
      console.log(products);
      res.render('admin/products', {
        prods: products,
        pageTitle: 'Admin Products',
        path: '/admin/products',
        isAuthenticated: req.session.isLoggedIn
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.productId;
  
  Product.findById(prodId)
  .then( product => {
    
    if(!product) {
      return next(new Error('Product not found.'));
    }

    fileHelper.deleteFile(product.imageUrl); //Delete the image
    return  Product.deleteOne({_id: prodId, userId: req.user._id }) //Delte the product itself
    .then(() => {
      console.log('DESTROYED PRODUCT');
      res.status(200).json({message: 'Success!'});
    })
    .catch(err => {
      res.status(500).json({message: 'Deleting product failed!'});
    });

  }).catch(err => next(err));
};
