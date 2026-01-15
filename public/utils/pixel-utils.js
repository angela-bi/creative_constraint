

(function () {

  function indexToXY(i, width) {
    const p = i / 4;
    return {
      x: p % width,
      y: (p / width) | 0,
    };
  }
  
  function getPixel(
    data,
    width,
    x,
    y
  ) {
    const i = (y * width + x) * 4;
    return {
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: data[i + 3],
    };
  }
  
  function pixel_is_different(
    prev,
    curr,
  ) {
    // returns true if any of the r,g,b values of two pixels are different
    if (prev['r'] == curr['r'] && prev['g'] == curr['g'] && prev['b'] == curr['b']) {
      return false
    } else {
      return true
    }
  }

  window.PixelUtils = {
    indexToXY,
    getPixel,
    pixel_is_different
  };
})();