(function () {
  window.Games = {};
  const PAL = { p: '#ff2e97', c: '#2ef2ff', y: '#ffe14d', b: '#3a6bff', g: '#5dff8a', w: '#f3eaff', v: '#8a4dff', o: '#ff9a3d', r: '#ff4d4d' };
  window.pixelIcon = function (rows) {
    const h = rows.length, w = rows[0].length;
    let r = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (PAL[ch]) r += `<rect x="${x}" y="${y}" width="1.03" height="1.03" fill="${PAL[ch]}"/>`;
    }));
    return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" class="pxicon" aria-hidden="true">${r}</svg>`;
  };
  window.rnd = (n) => Math.floor(Math.random() * n);
  window.pick = (arr) => arr[rnd(arr.length)];
  window.shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
})();
