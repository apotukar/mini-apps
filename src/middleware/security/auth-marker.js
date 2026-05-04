export function authMarker() {
  return function (req, res, next) {
    res.locals.user = req.session?.user || null;
    res.locals.isLoggedIn = Boolean(req.session.user);

    next();
  };
}
