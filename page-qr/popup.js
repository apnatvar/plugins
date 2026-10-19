(() => {
  const canvas = document.getElementById('qr-canvas');
  const loading = document.getElementById('loading');
  const errorBox = document.getElementById('error');
  const pageUrl = document.getElementById('page-url');
  const feedback = document.getElementById('feedback');
  const downloadButton = document.getElementById('download-button');
  const copyButton = document.getElementById('copy-button');
  const shareButton = document.getElementById('share-button');

  let currentBlob = null;
  let currentFile = null;
  let currentUrl = '';
  let busyAction = false;

  const setActionsEnabled = (enabled) => {
    downloadButton.disabled = !enabled || busyAction;
    copyButton.disabled = !enabled || busyAction;
    shareButton.disabled = !enabled || busyAction;
  };

  function setFeedback(message, isError = false) {
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
  }

  function showError(message) {
    loading.hidden = true;
    canvas.hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = message;
    setActionsEnabled(false);
  }

  function getCurrentTabUrl() {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || 'Could not read the current page.'));
            return;
          }
          const url = tabs && tabs[0] && tabs[0].url;
          if (!url) {
            reject(new Error('The current page address is unavailable.'));
            return;
          }
          resolve(url);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function makeQr(url) {
    if (typeof qrcode !== 'function') {
      throw new Error('The QR code library could not be loaded.');
    }

    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    }

    const qr = qrcode(0, 'M');
    qr.addData(url, 'Byte');
    qr.make();

    const moduleCount = qr.getModuleCount();
    const quietZone = 4;
    const modulePixels = Math.max(4, Math.min(7, Math.floor(320 / (moduleCount + quietZone * 2))));
    const side = (moduleCount + quietZone * 2) * modulePixels;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not create the QR preview.');

    // Keep the branding outside the square QR and its four-module quiet zone.
    const footerHeight = 40;
    canvas.width = side;
    canvas.height = side + footerHeight;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, side, canvas.height);
    context.fillStyle = '#111827';
    for (let row = 0; row < moduleCount; row += 1) {
      for (let column = 0; column < moduleCount; column += 1) {
        if (qr.isDark(row, column)) {
          context.fillRect(
            (column + quietZone) * modulePixels,
            (row + quietZone) * modulePixels,
            modulePixels,
            modulePixels
          );
        }
      }
    }
    context.fillStyle = '#64748b';
    context.font = '500 12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('[BD] Brownsmith Dynamics', side / 2, side + 20, side - 24);
  }

  function canvasToBlob() {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('The QR image could not be created.'));
        }, 'image/png');
      } catch (error) {
        reject(error);
      }
    });
  }

  async function updateShareAvailability(blob) {
    shareButton.hidden = true;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || typeof File !== 'function') {
      return;
    }
    try {
      const file = new File([blob], 'page-qr.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        currentFile = file;
        shareButton.hidden = false;
      }
    } catch (_) {
      currentFile = null;
    }
  }

  async function initialize() {
    setActionsEnabled(false);
    loading.hidden = false;
    errorBox.hidden = true;
    canvas.hidden = true;
    setFeedback('');

    try {
      currentUrl = await getCurrentTabUrl();
      pageUrl.textContent = currentUrl;
      if (!/^https?:$/i.test(new URL(currentUrl).protocol)) {
        throw new Error('Open an HTTP or HTTPS website to create a shareable QR code.');
      }
      makeQr(currentUrl);
      currentBlob = await canvasToBlob();
      await updateShareAvailability(currentBlob);
      loading.hidden = true;
      canvas.hidden = false;
      setActionsEnabled(true);
    } catch (error) {
      const message = typeof error === 'string' ? error
        : error && error.message ? error.message : 'Could not create a QR code for this page.';
      const isTooLong = /overflow|too long|code length/i.test(message);
      showError(isTooLong
        ? 'This page address is too long to fit in a QR code.'
        : message);
    }
  }

  function withAction(button, action) {
    return async () => {
      if (!currentBlob || busyAction) return;
      busyAction = true;
      setActionsEnabled(true);
      button.disabled = true;
      setFeedback('');
      try {
        await action();
      } catch (error) {
        const message = error && error.message ? error.message : 'That action could not be completed.';
        setFeedback(message, true);
      } finally {
        busyAction = false;
        setActionsEnabled(Boolean(currentBlob));
      }
    };
  }

  downloadButton.addEventListener('click', withAction(downloadButton, async () => {
    const blobUrl = URL.createObjectURL(currentBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'page-qr.png';
    link.hidden = true;
    document.body.appendChild(link);
    try {
      link.click();
      setFeedback('PNG downloaded.');
    } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  }));

  copyButton.addEventListener('click', withAction(copyButton, async () => {
    if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem === 'function') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentBlob })]);
        setFeedback('QR image copied.');
        return;
      } catch (_) {
        setFeedback('Image copying is unavailable here. Download the PNG instead.', true);
        return;
      }
    }
    setFeedback('Image copying is unavailable here. Download the PNG instead.', true);
  }));

  shareButton.addEventListener('click', withAction(shareButton, async () => {
    if (!currentFile || !navigator.share || !navigator.canShare || !navigator.canShare({ files: [currentFile] })) {
      shareButton.hidden = true;
      return;
    }
    try {
      await navigator.share({ files: [currentFile], title: 'QR code for this page', text: currentUrl });
      setFeedback('QR image shared.');
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      throw error;
    }
  }));

  initialize();
})();
