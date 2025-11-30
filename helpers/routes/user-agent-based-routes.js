import path from 'path';
import express from 'express';

export function registerStaticCssRoutes() {
  return function (req, res, next) {
    const ua = req.headers['user-agent'] || '';
    const isNs4 = ua.includes('Mozilla/4.');

    if (isNs4) {
      return express.static(path.join(process.cwd(), 'public/css/fallback'))(req, res, next);
    } else {
      return express.static(path.join(process.cwd(), 'public/css/default'))(req, res, next);
    }
  };
}

export function viewBaseMarker() {
  return function (req, res, next) {
    const ua = req.headers['user-agent'] || '';
    const isNs4 = ua.includes('Mozilla/4.');

    res.locals.viewBase = isNs4 ? '.fallback' : '';

    next();
  };
}
