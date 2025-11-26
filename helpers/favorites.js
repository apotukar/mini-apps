const FAV_COOKIE_MAX_AGE = 90 * 86400000

function favKey(namespace) {
  return namespace ? `${namespace}_favs` : 'favs'
}

function hideKey(namespace) {
  return namespace ? `${namespace}_hideConfigFavs` : 'hideConfigFavs'
}

export function getFavorites(req, namespace) {
  const key = favKey(namespace)
  if (!req.cookies?.[key]) return []
  try {
    const parsed = JSON.parse(req.cookies[key])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFavorites(res, favs, namespace) {
  const key = favKey(namespace)
  res.cookie(key, JSON.stringify(favs), {
    maxAge: FAV_COOKIE_MAX_AGE,
    path: '/'
  })
}

export function clearFavorites(res, namespace) {
  const keyFav = favKey(namespace)
  const keyHide = hideKey(namespace)
  res.clearCookie(keyFav, { path: '/' })
}

export function setHideFlag(res, namespace) {
  const key = hideKey(namespace)
  res.cookie(key, '1', {
    maxAge: FAV_COOKIE_MAX_AGE,
    path: '/'
  })
}

export function getHideFlag(req, namespace) {
  const key = hideKey(namespace)
  return !!req.cookies?.[key]
}

export function clearHideFlag(res, namespace) {
  const key = hideKey(namespace)
  res.clearCookie(key, { path: '/' })
}

export function dedupeFavs(list) {
  const seen = new Set()

  return list.filter(item => {
    const key = typeof item === 'string' ? item : JSON.stringify(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
