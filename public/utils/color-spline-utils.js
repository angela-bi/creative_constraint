

(function () {

  /**
   * Solve mixing ratios for red, yellow, blue and white given final color.
   * Assumes linear additive mixing on white canvas.
   *
   * @param {number} R - Red channel (0-255)
   * @param {number} G - Green channel (0-255)
   * @param {number} B - Blue channel (0-255)
   * @returns {{r: number, y: number, b: number, w: number}} Ratios summing close to 1
   */
  function solvePaintRatios(R, G, B) {
    // Clamp input
    R = Math.min(Math.max(R, 0), 255);
    G = Math.min(Math.max(G, 0), 255);
    B = Math.min(Math.max(B, 0), 255);

    // Calculate blue ratio
    let b = (255 - R) / 255;
    b = clamp(b, 0, 1);

    // Calculate red + blue sum
    let r_plus_b = (255 - G) / 255;
    r_plus_b = clamp(r_plus_b, 0, 1);

    // Red ratio
    let r = r_plus_b - b;
    r = clamp(r, 0, 1);

    // Calculate red + yellow sum
    let r_plus_y = (255 - B) / 255;
    r_plus_y = clamp(r_plus_y, 0, 1);

    // Yellow ratio
    let y = r_plus_y - r;
    y = clamp(y, 0, 1);

    // White ratio (leftover)
    let w = 1 - (r + y + b);
    w = clamp(w, 0, 1);

    // Normalize so sum is exactly 1 (optional)
    const sum = r + y + b + w;
    if (sum > 0) {
      r /= sum;
      y /= sum;
      b /= sum;
      w /= sum;
    }

    return { 'red':r, 'yellow':y, 'blue':b, 'white':w };

    function clamp(val, min, max) {
      return Math.min(Math.max(val, min), max);
    }
  }


  function sigmoid(t, k) {
    return 1 / (1 + Math.exp(-t/k));
  }

  function customSigmoid(x,y) {
    return 20*(2*(sigmoid(x,25)*sigmoid(y,25))-1)
  }

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
    solvePaintRatios,
    sigmoid,
    customSigmoid,
    rgb2hsl,
    interpolate
  };
})();