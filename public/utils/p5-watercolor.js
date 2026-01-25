
window.sendPixels = (pixels) => {
    window.parent.postMessage(
        { type: "updatePixels", payload: pixels },
        "*"
    );
};

// helpers

function samplePixels() {
    loadPixels();
    const snapshot = new Uint8ClampedArray(pixels);
  
    const w = width;
    const h = height;
  
    const result = getPixels(snapshot)
    sendPixels(result.data);
  }
  
  function getPixels() {
    loadPixels();
  
    const buffer = new Uint8ClampedArray(pixels);
  
    return {
      width,
      height,
      data: buffer, // rgba
    };
  }
  
  let isPointerDown = false;
  let pointerX = 0;
  let pointerY = 0;
  let pointerPressure = 1.0;
  
  function setupPointerSupport(canvasElt) {
    canvasElt.addEventListener('pointerdown', (e) => {
      isPointerDown = true;
  
      pointerX = e.offsetX;
      pointerY = e.offsetY;
      pointerPressure = e.pressure || 1.0;
  
      prevMouseX = pointerX;
      prevMouseY = pointerY;
    });
  
    canvasElt.addEventListener('pointermove', (e) => {
      pointerX = e.offsetX;
      pointerY = e.offsetY;
      pointerPressure = e.pressure || 1.0;
    });
  
    canvasElt.addEventListener('pointerup', () => {
      isPointerDown = false;
    });
  
    canvasElt.style.touchAction = "none";
  }
  
  // global vars
  
  let defaultTime = 0.0012; // large = quick dry
  let runnyColors = false;
  let backgrd = 255; // 255 white; 0 black
  let smallCanvas = true;
  let state;
  dryTime = defaultTime;
  let prevMouseX, prevMouseY;
  let sliderDrops, buttonDry, buttonWet, buttonDefault;
  let colorPicker;
  let colorPicked = [266, 0, 168];
  let paint = [];
  let tempPaint1 = [];
  let tempPaint2 = [];
  
  let brushMode = "paint"; // "paint" | "smudge"
  let smudgeStrength = 1; // 0 through 1
  let isSmudging = false;
  
  let lastSampleTime = 0;
  const sampleInterval = 2000; // bigger = less often, smaller = more often
  
  function setup() {
    pixelDensity(1);
  
    let c = createCanvas(450,450);
  
    background(255);
  
    setupPointerSupport(c.elt);
  
    // allow file drops for PNG import
    c.drop(handleFile);
  
    // listen for React messages
    window.addEventListener("message", (event) => {
      const { type, payload } = event.data;
  
      if (type === "setBrushSize") {
        brushSize = payload;
      }
      if (type === "setBrushColor") {
        brushColor = payload.rgb;
      }
      if (type === "clearCanvas") {
        clearCanvas();
      }
      if (type === "savePNG") {
        const png = canvas.toDataURL("image/png");
        window.parent.postMessage({ type: "canvasPNG", payload: png }, "*");
      }
      if (type === "importPNG") {
        clearCanvas();
        importPNG(payload);
      }
      if (type === "updateColor") {
        colorPicked = [payload.rgb[0], payload.rgb[1], payload.rgb[2]];
      }
      // if (type === "updateAvg") {
      //   // const cols = averageColumnColors();
      //   // console.log('cols', cols)
      //   // window.parent.postMessage({ type: "updateAvg", payload: cols }, "*");
      // }
      if (type === "getPNG") {
        const pngData = document.querySelector("canvas").toDataURL("image/png");
        window.parent.postMessage({ type: "canvasPNG", payload: pngData }, "*");
      }
      if (type === "setBrushMode") {
        brushMode = payload;
      }
  
    });
  
    paint = [];
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        paint.push(backgrd, backgrd, backgrd, 0);
      }
    }
  
    tempPaint1 = paint;
    tempPaint2 = paint;
  }
  
  function draw() {
    paintDrop = 70;
  
    addPaint();
    update();
    render();
  
    if (millis() - lastSampleTime > sampleInterval) {
      samplePixels();
      lastSampleTime = millis();
    }
  }
  
  // add paint when clicking - start with dragging
  function addPaint() {
    if (
      isPointerDown &&
      mouseIsPressed &&
      mouseX >= 0 &&
      mouseX <= width &&
      mouseY >= 0 &&
      mouseY <= height
    ) {
      // Send smudging active message when actively smudging
      if (brushMode === "smudge" && !isSmudging) {
        isSmudging = true;
        window.parent.postMessage({ type: "smudgingActive", payload: isSmudging }, "*");
      }
      
      let distance = dist(prevMouseX, prevMouseY, pointerX, pointerY);
      let numPoints = floor(distance / 1); // larger number = more gaps and fewer points; these two lines from George Profenza, noted below.
      drawLinePoints(prevMouseX, prevMouseY, pointerX, pointerY, numPoints);
  
      // add paint when clicking in one place
      if (pointerX == prevMouseX && pointerY == prevMouseY) {
        renderPoints(mouseX, mouseY);
      }
    } else {
      // Reset smudging flag when not drawing
      isSmudging = false;
    }
    prevMouseX = pointerX;
    prevMouseY = pointerY;
  
    // preventing a wrap around error when dragging off canvas and back on
    // prevMouseX = constrain(prevMouseX, 0, width - 1);
    // prevMouseY = constrain(prevMouseY, 0, height - 1);
  }
  
  // calculate points when dragging
  // This function from George Profenza on stackoverflow https://stackoverflow.com/questions/63959181/how-do-you-draw-a-line-in-a-pixel-array
  function drawLinePoints(x1, y1, x2, y2, points) {
    for (let i = 0; i < points; i++) {
      let t = map(i, 0, points, 0.0, 1.0);
      let x = round(lerp(x1, x2, t));
      let y = round(lerp(y1, y2, t));
      renderPoints(x, y);
    }
  }
  
  // replace array points when drawing
  
  function renderPoints(x, y) {
    let arrayPos = (x + y * width) * 4;
  
    if (brushMode === "paint") {
      let newR = (paint[arrayPos + 0] + colorPicked[0]) / 2;
      let newG = (paint[arrayPos + 1] + colorPicked[1]) / 2;
      let newB = (paint[arrayPos + 2] + colorPicked[2]) / 2;
      let newN = paint[arrayPos + 3] + paintDrop;
      paint.splice(arrayPos, 4, newR, newG, newB, newN); // replace the current pixel color with the newly calculated color
      return;
    } else { // smudge
      let radius = 8;
      let strength = 0.8;
  
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
  
          let d = Math.sqrt(dx * dx + dy * dy);
          if (d > radius) continue;
  
          let nx = x + dx;
          let ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
  
          let w = (1 - d / radius) * strength;
  
          mixPixelAt(nx, ny, w);
        }
      }
    }
  }
  
  function mixPixelAt(x, y, strength = 1) {
    let arrayPos = (x + y * width) * 4;
    // right
    if (x < width - 1) {
      tempPaint1[arrayPos + 4] =
        lerp(tempPaint1[arrayPos + 4], (paint[arrayPos + 4] + paint[arrayPos]) / 2, strength);
      tempPaint1[arrayPos + 5] =
        lerp(tempPaint1[arrayPos + 5], (paint[arrayPos + 5] + paint[arrayPos + 1]) / 2, strength);
      tempPaint1[arrayPos + 6] =
        lerp(tempPaint1[arrayPos + 6], (paint[arrayPos + 6] + paint[arrayPos + 2]) / 2, strength);
      tempPaint1[arrayPos + 7] += strength;
    }
  
    // left
    if (x > 0) {
      tempPaint1[arrayPos - 4] =
        lerp(tempPaint1[arrayPos - 4], (paint[arrayPos - 4] + paint[arrayPos]) / 2, strength);
      tempPaint1[arrayPos - 3] =
        lerp(tempPaint1[arrayPos - 3], (paint[arrayPos - 3] + paint[arrayPos + 1]) / 2, strength);
      tempPaint1[arrayPos - 2] =
        lerp(tempPaint1[arrayPos - 2], (paint[arrayPos - 2] + paint[arrayPos + 2]) / 2, strength);
      tempPaint1[arrayPos - 1] += strength;
    }
  
    // below
    if (y < height - 1) {
      let p = arrayPos + width * 4;
      tempPaint1[p]     = lerp(tempPaint1[p],     (paint[p]     + paint[arrayPos])     / 2, strength);
      tempPaint1[p + 1] = lerp(tempPaint1[p + 1], (paint[p + 1] + paint[arrayPos + 1]) / 2, strength);
      tempPaint1[p + 2] = lerp(tempPaint1[p + 2], (paint[p + 2] + paint[arrayPos + 2]) / 2, strength);
      tempPaint1[p + 3] += strength;
    }
  
    // above
    if (y > 0) {
      let p = arrayPos - width * 4;
      tempPaint1[p]     = lerp(tempPaint1[p],     (paint[p]     + paint[arrayPos])     / 2, strength);
      tempPaint1[p + 1] = lerp(tempPaint1[p + 1], (paint[p + 1] + paint[arrayPos + 1]) / 2, strength);
      tempPaint1[p + 2] = lerp(tempPaint1[p + 2], (paint[p + 2] + paint[arrayPos + 2]) / 2, strength);
      tempPaint1[p + 3] += strength;
    }
  }
  
  
  function update() {
  
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let arrayPos = (x + y * width) * 4;
        if (paint[arrayPos + 3] > 4) {
          tempPaint1[arrayPos + 3] = paint[arrayPos + 3] - 4;
  
          // mix pixel to right
          if (x < width - 1) {
            tempPaint1[arrayPos + 4] =
              (paint[arrayPos + 4] + paint[arrayPos]) / 2;
            tempPaint1[arrayPos + 5] =
              (paint[arrayPos + 5] + paint[arrayPos + 1]) / 2;
            tempPaint1[arrayPos + 6] =
              (paint[arrayPos + 6] + paint[arrayPos + 2]) / 2;
            tempPaint1[arrayPos + 7] = paint[arrayPos + 7] + 1;
          }
  
          // mix pixel to left
          if (x > 0) {
            tempPaint1[arrayPos - 4] =
              (paint[arrayPos - 4] + paint[arrayPos]) / 2;
            tempPaint1[arrayPos - 3] =
              (paint[arrayPos - 3] + paint[arrayPos + 1]) / 2;
            tempPaint1[arrayPos - 2] =
              (paint[arrayPos - 2] + paint[arrayPos + 2]) / 2;
            tempPaint1[arrayPos - 1] = paint[arrayPos - 1] + 1;
          }
  
          // mix pixel below
          tempPaint1[arrayPos + width * 4] =
            (paint[arrayPos + width * 4] + paint[arrayPos]) / 2;
          tempPaint1[arrayPos + width * 4 + 1] =
            (paint[arrayPos + width * 4 + 1] + paint[arrayPos + 1]) / 2;
          tempPaint1[arrayPos + width * 4 + 2] =
            (paint[arrayPos + width * 4 + 2] + paint[arrayPos + 2]) / 2;
          tempPaint1[arrayPos + width * 4 + 3] =
            paint[arrayPos + width * 4 + 3] + 1;
  
          // mix pixel above
          tempPaint1[arrayPos - width * 4] =
            (paint[arrayPos - width * 4] + paint[arrayPos]) / 2;
          tempPaint1[arrayPos - width * 4 + 1] =
            (paint[arrayPos - width * 4 + 1] + paint[arrayPos + 1]) / 2;
          tempPaint1[arrayPos - width * 4 + 2] =
            (paint[arrayPos - width * 4 + 2] + paint[arrayPos + 2]) / 2;
          tempPaint1[arrayPos - width * 4 + 3] =
            paint[arrayPos - width * 4 + 3] + 1;
        }
  
        // gradually dry paint
        tempPaint1[arrayPos + 3] = paint[arrayPos + 3] - dryTime;
        if (tempPaint1[arrayPos + 3] < 0) {
          tempPaint1[arrayPos + 3] = 0;
        }
      }
    }
    
    if (runnyColors == true){
      paint = tempPaint1;
    }
      else {
    for (let x = width; x > 0; x--) {
      for (let y = height; y > 0; y--) {
        let arrayPos = (x + y * width) * 4;
        if (paint[arrayPos + 3] > 4) {
          tempPaint2[arrayPos + 3] = paint[arrayPos + 3] - 4;
  
          // mix pixel to right
          if (x < width - 1) {
            tempPaint2[arrayPos + 4] =
              (paint[arrayPos + 4] + paint[arrayPos]) / 2;
            tempPaint2[arrayPos + 5] =
              (paint[arrayPos + 5] + paint[arrayPos + 1]) / 2;
            tempPaint2[arrayPos + 6] =
              (paint[arrayPos + 6] + paint[arrayPos + 2]) / 2;
            tempPaint2[arrayPos + 7] = paint[arrayPos + 7] + 1;
          }
  
          // mix pixel to left
          if (x > 0) {
            tempPaint2[arrayPos - 4] =
              (paint[arrayPos - 4] + paint[arrayPos]) / 2;
            tempPaint2[arrayPos - 3] =
              (paint[arrayPos - 3] + paint[arrayPos + 1]) / 2;
            tempPaint2[arrayPos - 2] =
              (paint[arrayPos - 2] + paint[arrayPos + 2]) / 2;
            tempPaint2[arrayPos - 1] = paint[arrayPos - 1] + 1;
          }
  
          // mix pixel below
          tempPaint2[arrayPos + width * 4] =
            (paint[arrayPos + width * 4] + paint[arrayPos]) / 2;
          tempPaint2[arrayPos + width * 4 + 1] =
            (paint[arrayPos + width * 4 + 1] + paint[arrayPos + 1]) / 2;
          tempPaint2[arrayPos + width * 4 + 2] =
            (paint[arrayPos + width * 4 + 2] + paint[arrayPos + 2]) / 2;
          tempPaint2[arrayPos + width * 4 + 3] =
            paint[arrayPos + width * 4 + 3] + 1;
  
          // mix pixel above
          tempPaint2[arrayPos - width * 4] =
            (paint[arrayPos - width * 4] + paint[arrayPos]) / 2;
          tempPaint2[arrayPos - width * 4 + 1] =
            (paint[arrayPos - width * 4 + 1] + paint[arrayPos + 1]) / 2;
          tempPaint2[arrayPos - width * 4 + 2] =
            (paint[arrayPos - width * 4 + 2] + paint[arrayPos + 2]) / 2;
          tempPaint2[arrayPos - width * 4 + 3] =
            paint[arrayPos - width * 4 + 3] + 1;
        }
  
        // gradually dry paint
        tempPaint2[arrayPos + 3] = paint[arrayPos + 3] - dryTime;
        if (tempPaint2[arrayPos + 3] < 0) {
          tempPaint2[arrayPos + 3] = 0;
        }
      }
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let arrayPos = (x + y * width) * 4;
        paint[arrayPos] = (tempPaint1[arrayPos] + tempPaint2[arrayPos]) / 2;
      }
    }
  }
  }
  
  let avg_r = 0;
  let avg_g = 0
  let avg_b = 0
  
  // render all pixels
  function render() {
    loadPixels();
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let pix = (x + y * width) * 4;
        let arrayPos = (x + y * width) * 4;
        pixels[pix] = paint[arrayPos];
        pixels[pix + 1] = paint[arrayPos + 1];
        pixels[pix + 2] = paint[arrayPos + 2];
        //pixels[pix + 3] = paint[arrayPos + 3];
      }
    }
    updatePixels();
  }
  
  function clearCanvas() {
    paint = [];
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        paint.push(backgrd, backgrd, backgrd, 0);
      }
    }
  
    tempPaint1 = paint;
    tempPaint2 = paint;
    
    // Broadcast message to reset brush parameters
    console.log('sending resetBrushParams')
    window.parent.postMessage({ type: "resetBrushParams" }, "*");
  }
  
  function handleFile(file) {
    if (file.type === "image") {
      importPNG(file.data);
    }
  }
  
  function importPNG(dataURL) {
    clearCanvas();
    loadImage(dataURL, (img) => {
      // Draw image into the canvas so we can read its pixels
      image(img, 0, 0, width, height);
  
      loadPixels(); // load canvas pixels[]
      
      // Fill paint[] from pixels[]
      for (let i = 0; i < paint.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
  
        if (a === 0) {
          paint[i]     = backgrd;
          paint[i + 1] = backgrd;
          paint[i + 2] = backgrd;
          paint[i + 3] = 0;
        } else {
          paint[i]     = r;
          paint[i + 1] = g;
          paint[i + 2] = b;
        }
      }
  
      // now call your existing watercolor renderer
      render();  
      updatePixels();
      //update();
  
      // After watercolor is rendered, extract avg column colors
      const newPixels = getPixels();
      window.parent.postMessage(
        { type: "updatePixels", payload: newPixels },
        "*"
      );
    });
  }


