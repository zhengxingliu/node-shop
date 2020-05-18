module.exports = (req, res, next) => { //user authentication for route protection
    if (!req.session.isLoggedIn) {
        return res.redirect('/login');
    }
    next();
}