

(function () {
  function rgb2hsl(r, g, b) {
    // https://gist.github.com/mjackson/5311256
    r /= 255, g /= 255, b /= 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
      h = s = 0; // achromatic
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }

      h /= 6;
    }

    return {'h': h, 's': s, 'l': l };
  }

  function interpolate(key, hsl) {
    let spline = null;
    if (key === 'h') {
      spline = new Spline({
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 200 }
        ],
        duration: 1000
      });
    } else if (key === 's') { // saturation
      // spline = new Spline({
      //   points: [
      //     { x: 0, y: 1 },
      //     { x: 0, y: 0.5 }
      //   ],
      //   duration: 1000
      // });
      return hsl[key]
    } else if (key === 'l') { // lightness
      spline = spline = new Spline({
        points: [
          { x: 0, y: 1 },
          { x: 100, y: 0 }
        ],
        duration: 1000
      });
    } else {
      throw new Error('invalid key')
    }
    
    time = hsl[key] * spline.duration
    output = spline.pos(time).y;
    //console.log('output', output)
    return output
  }

  window.ColorSplineUtils = {
    rgb2hsl,
    interpolate
  };
})();