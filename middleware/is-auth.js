module.exports = (req, res , next) => {
    if(!req.session.isLoggedIn) {
        return res.redirect('/login');
    }
    next(); //If the user is logged in we let the req go the next routes is trying to go
}