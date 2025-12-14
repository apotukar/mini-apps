window.updateRadius = function (selectEl) {
  const radius = selectEl.value;

  document.querySelectorAll('.fav a').forEach(function (link) {
    const url = new URL(link.href);
    url.searchParams.set('radius', radius);
    link.href = url.toString();
  });
};
