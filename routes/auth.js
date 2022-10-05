const express = require('express');
//Through destructuring only a  method of the third package is stored in the const check -> check body,paramaters,cookie etc..
const { check, body } = require('express-validator/check');

const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

//Trough a middleware we check with a submethod if the email is an Email
router.post('/signup',
[ //The array container is optional is just to make clear this is for validation
    
    check('email')
        .isEmail()
        .withMessage('Please enter a valid email.')
        .custom((value, {req})=> {  
            return User.findOne({email: value}) //Sentece to the db to see if some email in the db match with the email of the request trying to sign up
            .then(userWithThatEmail => { 
              if(userWithThatEmail) {//if an object user with the same email is found
                return Promise.reject( //Express validator wil recognise this like an error
                    'The email exist already, please introduce another one.'
                    );
              }
            })
        })
        .normalizeEmail() ,//Sanitize the email field (Removes empty space end & lowercase all of the letters..)
    
    body('password',///Please check 'password' in the body of the req
    'Please enter a password with only numbers and text and at least 5 caract' //Message for all the validators of this section
    ).isLength({ min:5 })
    .isAlphanumeric() 
    .trim(), //password sanitizer remove exescces whitespace
    
    body('confirmPassword')
        .custom((value, {req})=> {  //Create a custom validator
            if(value !== req.body.password) {
                throw new Error('Password have to match!');
            }
            return true;
        }).trim() 
],
authController.postSignup);

router.post('/login',
[
    check('email')
    .isEmail()
    .withMessage('Please enter a valid email.')
    .normalizeEmail() ,
    
    body('password',
    'Please enter a password with only numbers and text and at least 5 caract' 
    ).isLength({ min:5 })
    .isAlphanumeric()
    .trim() //password sanitizer remove exescces whitespace
], authController.postLogin);


router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

//Dynamic parameter in the url (:token)
router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);



module.exports = router;