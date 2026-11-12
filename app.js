/**
 * Hacknet OS - Linux Distribution
 * Fetches latest release and checksums from:
 * https://github.com/HacknetAOS/hacknet-iso/releases
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const screenContainer = document.getElementById('screen-container');
  const canvas = document.getElementById('hex-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const customCursor = document.getElementById('custom-cursor');
  const audioEl = document.getElementById('bgm');
  audioEl.volume = 0.2;
  const audioToggle = document.getElementById('audio-toggle');
  const audioLabel = document.getElementById('audio-label');

  const releaseMetaEl = document.getElementById('release-meta');

  const modalOverlay = document.getElementById('modal-overlay');
  const windowTitle = document.getElementById('window-title');
  const windowBody = document.getElementById('window-body');
  const windowClose = document.getElementById('window-close');

  const buttons = document.querySelectorAll('.menu-btn');

  // --- Viewport Scaling (Reference 1920x1080) ---
  let scale = 1.0;
  function updateScale() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    scale = Math.min(w / 1920, h / 1080);
    screenContainer.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', updateScale);
  updateScale();

  // --- Custom Cursor Tracking ---
  let mouseX = 859;
  let mouseY = 375;

  function updateCursorPos(x, y) {
    customCursor.style.transform = `translate(${x}px, ${y}px)`;
  }
  updateCursorPos(mouseX, mouseY);

  window.addEventListener('mousemove', (e) => {
    const rect = screenContainer.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / scale;
    mouseY = (e.clientY - rect.top) / scale;
    updateCursorPos(mouseX, mouseY);
  });

  // --- Hacker Text Scramble Effect Engine (No Audio on Hover) ---
  class TextScramble {
    constructor(el) {
      this.el = el;
      this.chars = '!<>-_\\/[]{}—=+*^?#01XABCDEF';
      this.update = this.update.bind(this);
    }

    setText(newText) {
      const oldText = this.el.innerText || '';
      const length = Math.max(oldText.length, newText.length);
      const promise = new Promise((resolve) => (this.resolve = resolve));

      this.queue = [];
      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 8);
        const end = start + Math.floor(Math.random() * 14) + 6;
        this.queue.push({ from, to, start, end });
      }

      cancelAnimationFrame(this.frameRequest);
      this.frame = 0;
      this.update();
      return promise;
    }

    update() {
      let output = '';
      let complete = 0;

      for (let i = 0, n = this.queue.length; i < n; i++) {
        let { from, to, start, end, char } = this.queue[i];

        if (this.frame >= end) {
          complete++;
          output += to;
        } else if (this.frame >= start) {
          if (!char || Math.random() < 0.38) {
            char = this.chars[Math.floor(Math.random() * this.chars.length)];
            this.queue[i].char = char;
          }
          output += `<span class="scramble-char">${char}</span>`;
        } else {
          output += from;
        }
      }

      this.el.innerHTML = output;

      if (complete === this.queue.length) {
        this.resolve();
      } else {
        this.frameRequest = requestAnimationFrame(this.update);
        this.frame++;
      }
    }
  }

  // Bind scramble effect to buttons (strictly visual, no hover sound)
  const scramblers = new Map();
  buttons.forEach((btn) => {
    const textEl = btn.querySelector('.btn-text');
    if (textEl) {
      const targetText = textEl.dataset.text || textEl.innerText;
      const scrambler = new TextScramble(textEl);
      scramblers.set(btn, { scrambler, targetText, textEl });

      btn.addEventListener('mouseenter', () => {
        scrambler.setText(targetText);
      });
    }
  });

  // Initial decode sequence on load
  window.addEventListener('load', () => {
    setTimeout(() => {
      let delay = 0;
      buttons.forEach((btn) => {
        setTimeout(() => {
          const item = scramblers.get(btn);
          if (item) {
            item.scrambler.setText(item.targetText);
          }
        }, delay);
        delay += 120;
      });
    }, 200);
  });

  // --- Release State Management ---
  const releaseData = {
    tag: 'v0.1',
    isoName: 'hacknetos-0.1.0-20261112-x86_64.iso',
    isoSizeFormatted: '1.82 GB',
    downloadUrl: 'https://github.com/HacknetAOS/hacknet-iso/releases/download/v0.1/hacknetos-0.1.0-20261112-x86_64.iso',
    sha256: '5beda443fdaa2b41be8c37885950347b7cd7f40175907a11b3924d696c3eb8a6',
    sha256Url: 'https://github.com/HacknetAOS/hacknet-iso/releases/download/v0.1/sha256sums.txt',
    releaseUrl: 'https://github.com/HacknetAOS/hacknet-iso/releases'
  };

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '1.82 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2) + ' GB';
  }

  // Fetch Latest Release from GitHub API
  async function fetchLatestRelease() {
    try {
      const response = await fetch('https://api.github.com/repos/HacknetAOS/hacknet-iso/releases', {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (!response.ok) return;

      const releases = await response.json();
      if (!Array.isArray(releases) || releases.length === 0) return;

      const latest = releases[0];
      releaseData.tag = latest.tag_name || 'v0.1';
      releaseData.releaseUrl = latest.html_url || 'https://github.com/HacknetAOS/hacknet-iso/releases';

      if (Array.isArray(latest.assets)) {
        const isoAsset = latest.assets.find(a => a.name.endsWith('.iso'));
        if (isoAsset) {
          releaseData.isoName = isoAsset.name;
          releaseData.isoSizeFormatted = formatBytes(isoAsset.size);
          releaseData.downloadUrl = isoAsset.browser_download_url;
        }

        const shaAsset = latest.assets.find(a => a.name.includes('sha256') || a.name.endsWith('.txt'));
        if (shaAsset) {
          releaseData.sha256Url = shaAsset.browser_download_url;
          try {
            const shaResp = await fetch(shaAsset.browser_download_url);
            if (shaResp.ok) {
              const text = await shaResp.text();
              const match = text.match(/([a-fA-F0-9]{64})/);
              if (match) {
                releaseData.sha256 = match[1].toLowerCase();
              }
            }
          } catch (_) {}
        }
      }

      if (releaseMetaEl) {
        releaseMetaEl.textContent = `${releaseData.tag} | ${releaseData.isoSizeFormatted}`;
      }
    } catch (_) {}
  }

  fetchLatestRelease();

  // --- Procedural Hexagon Background Animation ---
  const R = 27.0;
  const colStep = 1.5 * R;          // 40.5px
  const rowStep = Math.sqrt(3) * R;   // ~46.77px
  const rowOffset = (Math.sqrt(3) / 2) * R; // ~23.385px
  const gap = 1.6;
  const innerR = R - gap;

  const vertexOffsets = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    vertexOffsets.push({
      x: innerR * Math.cos(angle),
      y: innerR * Math.sin(angle)
    });
  }

  const hexagons = [];
  const startX = -colStep;
  const endX = 1920 + colStep * 2;
  const startY = -rowStep;
  const endY = 1080 + rowStep * 2;

  const waveAngleRad = -34 * (Math.PI / 180);
  const sinAngle = Math.sin(waveAngleRad);
  const cosAngle = Math.cos(waveAngleRad);
  const wavelength = 430.0;
  const waveSpeed = 68.0;

  let colIdx = 0;
  for (let x = startX; x <= endX; x += colStep) {
    const isOdd = (colIdx % 2 !== 0);
    const yShift = isOdd ? rowOffset : 0;
    for (let y = startY; y <= endY; y += rowStep) {
      const cy = y + yShift;
      const cx = x;
      const proj = cx * sinAngle + cy * cosAngle;
      hexagons.push({ cx, cy, proj });
    }
    colIdx++;
  }

  const colorLUT = [];
  for (let i = 0; i <= 255; i++) {
    const r = Math.round(i * 0.96);
    const g = Math.round(i * 1.0);
    const b = Math.round(i * 1.04);
    colorLUT.push(`rgb(${r},${g},${b})`);
  }

  let startTime = performance.now();

  function renderHexagons(time) {
    const t = (time - startTime) / 1000.0;

    ctx.fillStyle = '#020202';
    ctx.fillRect(0, 0, 1920, 1080);

    const baseVal = 2.5;
    const ampVal = 23.5;
    const waveShift = t * waveSpeed;

    for (let j = 0; j < hexagons.length; j++) {
      const hex = hexagons[j];
      const phase = ((hex.proj - waveShift) % wavelength + wavelength) % wavelength;
      const normalizedPhase = phase / wavelength;

      const wave1 = 0.5 + 0.5 * Math.sin(normalizedPhase * Math.PI * 2);
      const wave2 = 0.5 + 0.5 * Math.sin(normalizedPhase * Math.PI * 4);
      const waveVal = Math.pow(wave1, 2.2) * 0.85 + Math.pow(wave2, 1.8) * 0.15;

      const brightness = Math.min(255, Math.max(0, Math.round(baseVal + ampVal * waveVal)));
      ctx.fillStyle = colorLUT[brightness];

      ctx.beginPath();
      ctx.moveTo(hex.cx + vertexOffsets[0].x, hex.cy + vertexOffsets[0].y);
      for (let k = 1; k < 6; k++) {
        ctx.lineTo(hex.cx + vertexOffsets[k].x, hex.cy + vertexOffsets[k].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    requestAnimationFrame(renderHexagons);
  }

  requestAnimationFrame(renderHexagons);

  // --- Audio Management ---
  let isAudioPlaying = false;

  function updateAudioUI() {
    audioLabel.textContent = isAudioPlaying ? 'AUDIO: ON' : 'AUDIO: OFF';
    audioToggle.classList.toggle('active', isAudioPlaying);
  }

  function initAudio() {
    audioEl.volume = 0.2;
    audioEl.play().then(() => {
      isAudioPlaying = true;
      updateAudioUI();
    }).catch(() => {
      isAudioPlaying = false;
      updateAudioUI();
    });
  }

  audioToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isAudioPlaying) {
      audioEl.pause();
      isAudioPlaying = false;
      updateAudioUI();
    } else {
      audioEl.play().then(() => {
        isAudioPlaying = true;
        updateAudioUI();
      });
    }
  });

  window.addEventListener('click', () => {
    if (!isAudioPlaying && audioEl.paused) {
      initAudio();
    }
  }, { once: true });

  // --- Modal Window Handlers (Copies Button Design) ---
  function openModal(title, contentHtml) {
    windowTitle.textContent = title;
    windowBody.innerHTML = contentHtml;
    modalOverlay.classList.remove('hidden');

    const titleScrambler = new TextScramble(windowTitle);
    titleScrambler.setText(title);
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
  }

  windowClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.getElementById('btn-download').addEventListener('click', () => {
    openModal(`DOWNLOAD HACKNET OS [${releaseData.tag}]`, `
      <div style="font-family: Consolas, monospace; line-height: 1.8;">
        <p>> FILE: <span style="color:#ffffff;">${releaseData.isoName}</span></p>
        <p>> SIZE: <span style="color:#ffffff;">${releaseData.isoSizeFormatted}</span></p>
        <p>> RELEASE: <span class="terminal-accent">${releaseData.tag}</span></p>
        <p>> ARCHITECTURE: <span style="color:#ffffff;">x86_64</span></p>

        <div class="terminal-block">
          ${releaseData.downloadUrl}
        </div>

        <div class="modal-actions">
          <button class="modal-btn" onclick="document.getElementById('window-close').click()">CLOSE</button>
          <button class="modal-btn" onclick="navigator.clipboard.writeText('${releaseData.downloadUrl}'); alert('Download link copied to clipboard.');">COPY LINK</button>
          <a class="modal-btn primary" href="${releaseData.downloadUrl}" target="_blank" rel="noopener noreferrer">DOWNLOAD ISO</a>
        </div>
      </div>
    `);
  });

  document.getElementById('btn-verify').addEventListener('click', () => {
    openModal(`VERIFY CHECKSUMS [${releaseData.tag}]`, `
      <div style="font-family: Consolas, monospace; line-height: 1.8;">
        <p>> TARGET: <span style="color:#ffffff;">${releaseData.isoName}</span></p>
        
        <div class="terminal-block">
          SHA-256:<br>
          <strong style="color:#00ff88;">${releaseData.sha256}</strong>
        </div>

        <div class="terminal-block" style="color:#88aacc;">
          echo "${releaseData.sha256}  ${releaseData.isoName}" | sha256sum -c
        </div>

        <div class="modal-actions">
          <button class="modal-btn" onclick="document.getElementById('window-close').click()">CLOSE</button>
          <a class="modal-btn" href="${releaseData.sha256Url}" target="_blank" rel="noopener noreferrer">SHA256SUMS.TXT</a>
          <button class="modal-btn primary" onclick="navigator.clipboard.writeText('echo &quot;${releaseData.sha256}  ${releaseData.isoName}&quot; | sha256sum -c'); alert('SHA-256 copied to clipboard.');">COPY HASH</button>
        </div>
      </div>
    `);
  });

})();
