import html2canvas from 'html2canvas';

/**
 * Converts OKLAB color values to RGB/RGBA CSS color strings.
 */
function oklabToRgb(l: number, aLab: number, bLab: number, alpha: number = 1): string {
  // OKLAB to LMS
  const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
  const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
  const s_ = l - 0.0894841775 * aLab - 1.291485548 * bLab;

  const l3 = Math.sign(l_) * Math.pow(Math.abs(l_), 3);
  const m3 = Math.sign(m_) * Math.pow(Math.abs(m_), 3);
  const s3 = Math.sign(s_) * Math.pow(Math.abs(s_), 3);

  // LMS to Linear sRGB
  let rLin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Clamp linear sRGB
  rLin = Math.max(0, Math.min(1, rLin));
  gLin = Math.max(0, Math.min(1, gLin));
  bLin = Math.max(0, Math.min(1, bLin));

  // Linear sRGB to Standard sRGB
  const toSrgb = (val: number) =>
    val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;

  const r = Math.round(toSrgb(rLin) * 255);
  const g = Math.round(toSrgb(gLin) * 255);
  const b = Math.round(toSrgb(bLin) * 255);

  if (alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(alpha.toFixed(3))})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Converts OKLCH color values to RGB/RGBA CSS color strings.
 */
function oklchToRgb(l: number, c: number, h: number, alpha: number = 1): string {
  // Convert h from degrees to radians
  const hRad = (h * Math.PI) / 180;

  // OKLCH to OKLAB
  const aLab = c * Math.cos(hRad);
  const bLab = c * Math.sin(hRad);

  return oklabToRgb(l, aLab, bLab, alpha);
}

/**
 * Replaces all oklch(...) and oklab(...) color definitions in a string with equivalent rgb(...)/rgba(...) strings.
 */
function replaceModernColorsInString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (!str.includes('oklab') && !str.includes('oklch')) return str;

  // Match oklch(...)
  let result = str.replace(/oklch\(\s*([^)]+)\s*\)/gi, (match, p1) => {
    try {
      const parts = p1.trim().split(/[\s,/]+/).filter(Boolean);
      if (parts.length < 3) return 'rgb(0, 0, 0)';

      let l = parseFloat(parts[0].replace('none', '0'));
      if (parts[0].endsWith('%')) l = parseFloat(parts[0]) / 100;

      let c = parseFloat(parts[1].replace('none', '0'));
      let h = parseFloat(parts[2].replace('none', '0').replace('deg', ''));

      let a = 1;
      if (parts.length >= 4) {
        if (parts[3].endsWith('%')) {
          a = parseFloat(parts[3]) / 100;
        } else {
          a = parseFloat(parts[3]);
        }
      }

      if (isNaN(l)) l = 0;
      if (isNaN(c)) c = 0;
      if (isNaN(h)) h = 0;
      if (isNaN(a)) a = 1;

      return oklchToRgb(l, c, h, a);
    } catch {
      return 'rgb(0, 0, 0)';
    }
  });

  // Match oklab(...)
  result = result.replace(/oklab\(\s*([^)]+)\s*\)/gi, (match, p1) => {
    try {
      const parts = p1.trim().split(/[\s,/]+/).filter(Boolean);
      if (parts.length < 3) return 'rgb(0, 0, 0)';

      let l = parseFloat(parts[0].replace('none', '0'));
      if (parts[0].endsWith('%')) l = parseFloat(parts[0]) / 100;

      let aLab = parseFloat(parts[1].replace('none', '0'));
      let bLab = parseFloat(parts[2].replace('none', '0'));

      let alpha = 1;
      if (parts.length >= 4) {
        if (parts[3].endsWith('%')) {
          alpha = parseFloat(parts[3]) / 100;
        } else {
          alpha = parseFloat(parts[3]);
        }
      }

      if (isNaN(l)) l = 0;
      if (isNaN(aLab)) aLab = 0;
      if (isNaN(bLab)) bLab = 0;
      if (isNaN(alpha)) alpha = 1;

      return oklabToRgb(l, aLab, bLab, alpha);
    } catch {
      return 'rgb(0, 0, 0)';
    }
  });

  return result;
}

/**
 * Captures a specified DOM element or the entire main screen content and saves it as a PNG image.
 * @param elementId The ID of the HTML element to capture. Defaults to 'app-main-content' or document.body
 * @param fileName The desired name for the downloaded PNG file
 */
export async function captureScreenToPng(
  elementId: string = 'app-main-content',
  fileName: string = 'hub-sim-tela.png'
): Promise<boolean> {
  try {
    const element =
      document.getElementById(elementId) ||
      document.getElementById('main-content') ||
      document.body;

    if (!element) {
      console.error('Elemento para captura de tela não encontrado:', elementId);
      return false;
    }

    const canvas = await html2canvas(element, {
      scale: 2, // High DPI resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#090d16',
      logging: false,
      onclone: (clonedDoc) => {
        // 1. Intercept getComputedStyle on cloned document window
        if (clonedDoc.defaultView) {
          const win = clonedDoc.defaultView;
          const origGetComputedStyle = win.getComputedStyle.bind(win);
          win.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
            const style = origGetComputedStyle(elt, pseudoElt);
            return new Proxy(style, {
              get(target, prop, receiver) {
                if (prop === 'getPropertyValue') {
                  return (propertyName: string) => {
                    const val = target.getPropertyValue(propertyName);
                    if (typeof val === 'string' && (val.includes('oklab') || val.includes('oklch'))) {
                      return replaceModernColorsInString(val);
                    }
                    return val;
                  };
                }
                const val = Reflect.get(target, prop, receiver);
                if (typeof val === 'string' && (val.includes('oklab') || val.includes('oklch'))) {
                  return replaceModernColorsInString(val);
                }
                return val;
              },
            });
          };
        }

        // 2. Re-create all <style> elements in cloned document to force re-parsing without oklab/oklch
        const styleEls = Array.from(clonedDoc.querySelectorAll('style'));
        styleEls.forEach((styleEl) => {
          const text = styleEl.textContent || '';
          if (text.includes('oklab') || text.includes('oklch')) {
            const newText = replaceModernColorsInString(text);
            const newStyle = clonedDoc.createElement('style');
            newStyle.textContent = newText;
            if (styleEl.parentNode) {
              styleEl.parentNode.replaceChild(newStyle, styleEl);
            }
          }
        });

        // 3. Process all styleSheets in cloned document and rebuild rules if needed
        try {
          const stylesheets = Array.from(clonedDoc.styleSheets);
          stylesheets.forEach((sheet) => {
            try {
              if (!sheet.cssRules) return;
              const rules = Array.from(sheet.cssRules);
              let needsRewrite = false;
              let newCssText = '';
              rules.forEach((rule) => {
                let cssText = rule.cssText;
                if (cssText.includes('oklab') || cssText.includes('oklch')) {
                  needsRewrite = true;
                  cssText = replaceModernColorsInString(cssText);
                }
                newCssText += cssText + '\n';
              });

              if (needsRewrite) {
                const newStyle = clonedDoc.createElement('style');
                newStyle.textContent = newCssText;
                clonedDoc.head.appendChild(newStyle);
                if (sheet.ownerNode && sheet.ownerNode.parentNode) {
                  sheet.ownerNode.parentNode.removeChild(sheet.ownerNode);
                }
              }
            } catch {
              // ignore cross-origin stylesheet access errors
            }
          });
        } catch {
          // ignore
        }

        // 4. Process all inline styles on cloned DOM elements
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((node) => {
          const el = node as HTMLElement;
          if (el.style) {
            for (let i = 0; i < el.style.length; i++) {
              const propName = el.style[i];
              const propVal = el.style.getPropertyValue(propName);
              if (propVal && (propVal.includes('oklab') || propVal.includes('oklch'))) {
                el.style.setProperty(propName, replaceModernColorsInString(propVal));
              }
            }
          }
          const styleAttr = el.getAttribute('style');
          if (styleAttr && (styleAttr.includes('oklab') || styleAttr.includes('oklch'))) {
            el.setAttribute('style', replaceModernColorsInString(styleAttr));
          }
        });
      },
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Erro ao gerar captura PNG da tela:', error);
    return false;
  }
}
