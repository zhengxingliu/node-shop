const express = require('express');
const { check, body } = require('express-validator/check');

const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.post('/login', 
    check('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    authController.postLogin
);

router.post('/logout', authController.postLogout);

router.get('/signup', authController.getSignup);

router.post('/signup', 
   [  //adding validation
       check('email').isEmail().withMessage('Please enter a valid email').normalizeEmail()
        .custom((value,{req}) => { 
            //async validator
            return User.findOne({email: value})
                .then(userDoc => {
                    if(userDoc) {
                        return Promise.reject('Email existed, please enter another email.');
                    }
                });
        }),
        
        body( //body only checks body of the request
        'password',
        'Please enter a password with numbers and letters only, and at least 6 characters.')
        .isLength({min: 6}).isAlphanumeric(),
        
        body('confirmPassword') //custom validator
        .custom((value, {req}) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match.');
            }
            return true;
        })
   ],
   authController.postSignup
);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

module.exports = router;