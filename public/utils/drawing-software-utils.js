// Shared utilities for Klecks drawing components

window.DrawingSoftwareUtils = (function() {
  'use strict';

  // Default brush parameters
  const DEFAULT_BRUSH_PARAMS = {
    size: 4,
    opacity: 1,
    scatter: 0
  };

  // Normalization multipliers (can be customized per component)
  const DEFAULT_NORMALIZATION = {
    size: 1400,
    opacity: 60,
    scatter: 300
  };

  // Smudge multiplier
  const SMUDGE_MULTIPLIER = -1.2;

  /**
   * Initialize brush state variables
   */
  function initBrushState() {
    return {
      prevSize: DEFAULT_BRUSH_PARAMS.size,
      prevOpacity: DEFAULT_BRUSH_PARAMS.opacity,
      prevScatter: DEFAULT_BRUSH_PARAMS.scatter,
      newSize: DEFAULT_BRUSH_PARAMS.size,
      newOpacity: DEFAULT_BRUSH_PARAMS.opacity,
      newScatter: DEFAULT_BRUSH_PARAMS.scatter,
      size_change: 0,
      opacity_change: 0,
      scatter_change: 0,
      norm_size_change: 0,
      norm_opacity_change: 0,
      norm_scatter_change: 0,
      smudgingActive: false,
      prevPixels: new Uint8ClampedArray(1000).fill(255)
    };
  }

  /**
   * Reset brush parameters to defaults
   */
  function resetBrushParams(state, KL) {
    if (!KL) return;

    state.prevSize = DEFAULT_BRUSH_PARAMS.size;
    state.prevOpacity = DEFAULT_BRUSH_PARAMS.opacity;
    state.prevScatter = DEFAULT_BRUSH_PARAMS.scatter;
    state.newSize = DEFAULT_BRUSH_PARAMS.size;
    state.newOpacity = DEFAULT_BRUSH_PARAMS.opacity;
    state.newScatter = DEFAULT_BRUSH_PARAMS.scatter;
    
    // Reset change tracking variables
    state.size_change = 0;
    state.opacity_change = 0;
    state.scatter_change = 0;
    state.norm_size_change = 0;
    state.norm_opacity_change = 0;
    state.norm_scatter_change = 0;
    
    // Reset prevPixels to cleared canvas state (all white)
    if (state.prevPixels && state.prevPixels.length > 0) {
      state.prevPixels = new Uint8ClampedArray(state.prevPixels.length).fill(255);
    }
    
    // Apply the reset values to Klecks
    KL.setBrushSize(DEFAULT_BRUSH_PARAMS.size);
    KL.setBrushOpacity(DEFAULT_BRUSH_PARAMS.opacity);
    KL.setBrushScatter(DEFAULT_BRUSH_PARAMS.scatter);
  }

  /**
   * Process pixel changes and update brush parameters
   */
  function processPixelChanges(pixels, state, KL, options = {}) {
    const {
      normalization = DEFAULT_NORMALIZATION,
      smudgeMultiplier = SMUDGE_MULTIPLIER,
      onUpdate = null
    } = options;

    //console.log('pixels kl', pixels, KL)

    if (!pixels || !state.prevPixels || pixels.length !== state.prevPixels.length) {
    //   if (pixels && pixels.length > 0) {
        state.prevPixels = new Uint8ClampedArray(pixels);
    //   }
    //   return;
    }

    const {solvePaintRatios, solvePaintRatiosRGB, softmaxRGB} = window.ColorSplineUtils;
    const {indexToXY, getPixel, pixel_is_different} = window.PixelUtils;

    state.size_change = 0;
    state.opacity_change = 0;
    state.scatter_change = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const {x, y} = indexToXY(i, 500); // because array is 500x500x4

      let curr_pixel = getPixel(pixels, 500, x, y);
      let prev_pixel = getPixel(state.prevPixels, 500, x, y);

      if (pixel_is_different(prev_pixel, curr_pixel)) {
        let curr_ratio = solvePaintRatios(curr_pixel['r'], curr_pixel['g'], curr_pixel['b']);
        let prev_ratio = solvePaintRatios(prev_pixel['r'], prev_pixel['g'], prev_pixel['b']);
        //console.log(curr_pixel)
        // let curr_ratio = {'red': curr_pixel['r']/255, 'green': curr_pixel['g']/255, 'blue': curr_pixel['b']/255}
        // let prev_ratio = {'red': prev_pixel['r']/255, 'green': prev_pixel['g']/255, 'blue': prev_pixel['b']/255}
        // let curr_ratio = solvePaintRatiosRGB(curr_pixel['r'], curr_pixel['g'], curr_pixel['b']);
        // let prev_ratio = solvePaintRatiosRGB(curr_pixel['r'], curr_pixel['g'], curr_pixel['b'])

        // let curr_ratio = softmaxRGB(curr_pixel['r'], curr_pixel['g'], curr_pixel['b']);
        // let prev_ratio = softmaxRGB(prev_pixel['r'], prev_pixel['g'], prev_pixel['b']);

        let ratio_diff_red = curr_ratio['red'] - prev_ratio['red'];
        let ratio_diff_yellow = curr_ratio['yellow'] - prev_ratio['yellow'];
        // let ratio_diff_yellow = curr_ratio['green'] - prev_ratio['green'];
        let ratio_diff_blue = curr_ratio['blue'] - prev_ratio['blue'];

        if (state.smudgingActive) {
          ratio_diff_red = ratio_diff_red * smudgeMultiplier;
          ratio_diff_yellow = ratio_diff_yellow * smudgeMultiplier;
          ratio_diff_blue = ratio_diff_blue * smudgeMultiplier;
        }

        // console.log('ratio diffs', ratio_diff_red, ratio_diff_yellow, ratio_diff_blue)

        state.size_change += ratio_diff_red;
        state.opacity_change += ratio_diff_yellow;
        state.scatter_change += ratio_diff_blue;
      }
    }

    //console.log('size_change, opacity_change, scatter_change', state.size_change, state.opacity_change, state.scatter_change)

    // Normalize changes
    state.norm_size_change = state.size_change / pixels.length * normalization.size;
    state.norm_opacity_change = state.opacity_change / pixels.length * normalization.opacity;
    state.norm_scatter_change = state.scatter_change / pixels.length * normalization.scatter;

    // Calculate new values
    state.newSize = Math.min(Math.max(0, state.prevSize + state.norm_size_change), 100);
    state.newOpacity = Math.min(Math.max(0, state.prevOpacity - state.norm_opacity_change), 1);
    state.newScatter = Math.min(Math.max(0, state.prevScatter + state.norm_scatter_change), 100);

    // Apply to Klecks
    if (KL) {
      KL.setBrushSize(state.newSize);
      KL.setBrushOpacity(state.newOpacity);
      KL.setBrushScatter(state.newScatter);
    }

    // Update previous values
    state.prevSize = state.newSize;
    state.prevOpacity = state.newOpacity;
    state.prevScatter = state.newScatter;

    // Copy the array, don't assign a reference!
    state.prevPixels = new Uint8ClampedArray(pixels);

    // Call optional update callback
    if (onUpdate) {
      onUpdate(state);
    }
  }

  /**
   * Create message handler for common message types
   */
  function createMessageHandler(state, KL, customHandlers = {}) {
    return function handleMessage(msg) {
      const inst = KL?.instance;
      if (inst?.klApp?.mobileUi) {
        const ui = inst.klApp.mobileUi;
        ui.toolspaceIsOpen = false;
      }

      switch (msg.type) {
        case "smudgingActive":
          state.smudgingActive = true;
          break;

        case "smudgingInactive":
          state.smudgingActive = false;
          break;

        case "resetBrushParams":
          resetBrushParams(state, KL);
          break;

        case "updatePixels":
          window.pixels = msg.payload.pixelsRef.current;
          processPixelChanges(window.pixels, state, KL, customHandlers.processPixelOptions);
          break;

        default:
          // Call custom handlers if provided
          if (customHandlers[msg.type]) {
            customHandlers[msg.type](msg, state, KL);
          }
          break;
      }
    };
  }


  /**
   * Hide toolbar and toolspace elements
   */
  function hideToolbar(KL) {
    // Hide toolbar
    const toolbar = document.querySelector('.kl-toolbar');
    if (toolbar) {
      toolbar.style.display = 'none';
      toolbar.style.visibility = 'hidden';
      toolbar.style.opacity = '0';
      toolbar.style.width = '0';
      toolbar.style.height = '0';
      toolbar.style.overflow = 'hidden';
      toolbar.style.pointerEvents = 'none';
      toolbar.style.position = 'absolute';
      toolbar.style.left = '-9999px';
      toolbar.style.top = '-9999px';
    }
    
    // Hide toolspace
    const toolspace = document.querySelector('.kl-toolspace');
    if (toolspace) {
      toolspace.style.display = 'none';
      toolspace.style.visibility = 'hidden';
      toolspace.style.opacity = '0';
      toolspace.style.width = '0';
      toolspace.style.height = '0';
      toolspace.style.overflow = 'hidden';
      toolspace.style.pointerEvents = 'none';
      toolspace.style.position = 'absolute';
      toolspace.style.left = '-9999px';
      toolspace.style.top = '-9999px';
    }
    
    // Hide any elements with toolbar/toolspace in class name
    const allToolbars = document.querySelectorAll('[class*="toolbar"], [class*="toolspace"]');
    allToolbars.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.width = '0';
      el.style.height = '0';
      el.style.overflow = 'hidden';
      el.style.pointerEvents = 'none';
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
    });
    
    // Also close toolspace via KL API if available
    if (KL?.instance?.klApp?.mobileUi) {
      KL.instance.klApp.mobileUi.toolspaceIsOpen = false;
    }
  }

  /**
   * Setup toolbar hiding with MutationObserver
   */
  function setupToolbarHiding(KL, interval = 50) {
    // MutationObserver to hide toolbar as soon as it appears
    const observer = new MutationObserver(() => {
      hideToolbar(KL);
    });

    // Start observing the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try to hide it immediately and periodically
    hideToolbar(KL);
    setInterval(() => hideToolbar(KL), interval);
  }

  return {
    initBrushState,
    resetBrushParams,
    processPixelChanges,
    createMessageHandler,
    hideToolbar,
    setupToolbarHiding,
    DEFAULT_BRUSH_PARAMS,
    DEFAULT_NORMALIZATION,
    SMUDGE_MULTIPLIER
  };
})();
