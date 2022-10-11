const crypto = require('crypto');

const User = require('../models/user');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require ('express-validator/check'); //With this we'll get the result of the validation in the routes files

//Configure the transporterof sendgrid with the api key created in the web
const transporter = nodemailer.createTransport(sendgridTransport({
  auth: {
    api_key: process.env.SENDGRID_KEY
  }
}))

exports.getLogin = (req, res, next) => {
  let message = req.flash('error'); //req.flash gets an array  - (used to the styles in CSS)
  if(message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage: message, //After the session var is stored in a var for the views it remove itself from the var of the session
    oldInput: {
      email:'',
      password: ''
    },
    validationErrors: []
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error'); //req.flash gets an array  - (used to the styles in CSS)
  if(message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage: message,
    oldInput: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []
  });
};

exports.postLogin = (req, res, next) => {
  const reqEmail = req.body.email;
  const reqPassword = req.body.password;

  const errors = validationResult(req);
  if(!errors.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: errors.array()[0].msg,
      oldInput: { 
        email: reqEmail,
        password: reqPassword,
      },
      validationErrors: errors.array()
    })
  }

  User.findOne({email : reqEmail})
    .then(user => {
      if (!user) { //If i didn't find a user in the db
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'Invalid email',
          oldInput: { 
            email: reqEmail,
            password: reqPassword,
          },
          validationErrors:[]
        });
      }
      bcrypt.compare(reqPassword, user.password) //comparing the req password  with the one  in the db
      .then(doMatch => {
        if(doMatch){
        //Sessions vars 
        req.session.isLoggedIn = true;
        req.session.user = user;
        return req.session.save(err => {
          console.log(err);
          return res.redirect('/');
         });
        }
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'Password not match the account pass...',
          oldInput: { 
            email: reqEmail,
            password: reqPassword,
          },
          validationErrors:[]
        });
      })
      .catch(err => {
        console.log(err);
        res.redirect('/login');
      })
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      //When next is called with an error express know that an error occurred and it go pass all middlewares to an error middleware
      return next(error);   
    });
};

//If don't check if an user already exist bc the validator already does in the route
exports.postSignup = (req, res, next) => {
  const reqEmail = req.body.email;
  const reqPassword = req.body.password;
 
  const errors = validationResult(req);
  if(!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg,
      oldInput: { 
        email: reqEmail,
        password: reqPassword,
        confirmPassword: req.body.confirmPassword
      },
      validationErrors: errors.array()
    })
  }

    //Nested promises (Node do the then block only if we generate the hash pass)
    bcrypt.hash(reqPassword, 12) //generate a hash password encrypted in 12 rounds of hashing (highly secure)
    .then( hashedPassword => {
      const user = new User({
        email: reqEmail,
        password: hashedPassword, //Store the secure pasword
        cart: { items: [] }
      });
      return user.save();
    })
    .then(result => {
      res.redirect('/login');
      return transporter.sendMail({
        to: reqEmail,
        from: 'celestinvib@gmail.com',
        subject: 'Signup succeeded',
        html: '<h1>You succesfully signed up!</h1>'
      })
    }).catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let message = req.flash('error'); 
  if(message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password',
    errorMessage: message
  });
};

exports.postReset = (req, res , next) => {
  
  crypto.randomBytes(32, (err,buffer) =>{ //Generates a buffer
  
    if(err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex'); //Parse the valid buffer in hexadecimal to string
    User.findOne({email: req.body.email})  //find the user that the match the mail of the form
    .then(user => {
      if (!user){
        req.flash('error', 'No account with that email found.');
        res.redirect('/reset');
      }
      //Set of fields of the user model crate for this purpose
      user.resetToken = token; 
      user.resetTokenExpiration = Date.now() + 3600000; //Set the expiration date of 1 hour(in miliseconds)
      return user.save(); //return the user with the new data on the fields
    }).then (result => {
       transporter.sendMail({
        to: req.body.email,
        from: 'celestinvib@gmail.com',
        subject: 'Password Reset',
        html: `
        <p> You request a password reset</p>
        <p>Click this <a href="https://node-cka-shop.herokuapp.com/reset/${token}">link</a> to set a new password</p>
        <p>Only valid from 1 hour</p>
        `
      })
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);   
    });
  });
};

exports.getNewPassword = (req, res , next) => {
  
  const Reqtoken = req.params.token;
  //if some user have the token that has been passed in the req url and it hasn't expired yet
  User.findOne({resetToken: Reqtoken, resetTokenExpiration: {$gt: Date.now()}}) //$gt -> special comparation means greater than 
  .then(user => {
    let message = req.flash('error'); 
    if(message.length > 0) {
      message = message[0];
    } else {
      message = null;
    }
    res.render('auth/new-password', {
      path: '/new-password',
      pageTitle: 'New Password',
      errorMessage: message,
      userId: user._id.toString(),
      passwordToken: Reqtoken
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);   
  });
  
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;

  User.findOne({ //Find if a user with this reset token/ id exist and if the token hasn't expired
      resetToken: passwordToken, 
      resetTokenExpiration: { $gt: Date.now()},
      _id: userId
  })
  
  .then(user => {
    resetUser = user; 
    return bcrypt.hash(newPassword,12); //if it does hash the new password
  })
  .then(hashedPassword => { //save the new password to the user and clear the token realted fields
    resetUser.password = hashedPassword
    resetUser.resetToken = undefined; //With undefined in the object of db won't appear the field
    resetUser.resetTokenExpiration = undefined;
    return resetUser.save();
  }).then(result => {
    res.redirect('/login');
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);   
  });

};
