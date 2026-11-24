// Register Physical Collision & Obstruction Component before Scene Loads
AFRAME.registerComponent('player-collider', {
  tick: function () {
    const pos = this.el.getAttribute('position');
    if (!pos) return;
    let x = pos.x;
    let z = pos.z;

    // 1. Room Boundary Walls (-5.0m to +5.0m)
    x = Math.max(-4.8, Math.min(4.8, x));
    z = Math.max(-4.5, Math.min(4.5, z));

    // 2. Optical Table Solid Obstruction (Table bounds: X: -1.45 to +1.45, Z: -2.15 to -0.72)
    // Prevents player from walking inside/through the optical table!
    const tableMinX = -1.45;
    const tableMaxX = 1.45;
    const tableMinZ = -2.15;
    const tableMaxZ = -0.72; // Player stops right in front of the table edge

    if (x > tableMinX && x < tableMaxX && z > tableMinZ && z < tableMaxZ) {
      const distFront = Math.abs(z - tableMaxZ);
      const distBack = Math.abs(z - tableMinZ);
      const distLeft = Math.abs(x - tableMinX);
      const distRight = Math.abs(x - tableMaxX);
      const minDist = Math.min(distFront, distBack, distLeft, distRight);

      if (minDist === distFront) z = tableMaxZ;
      else if (minDist === distBack) z = tableMinZ;
      else if (minDist === distLeft) x = tableMinX;
      else x = tableMaxX;
    }

    // 3. Left Theory Screen Obstruction
    if (x < -1.8 && z < -0.8 && z > -1.8) {
      x = -1.8;
    }

    // 4. Right Observation Screen Obstruction
    if (x > 1.8 && z < -0.8 && z > -1.8) {
      x = 1.8;
    }

    this.el.setAttribute('position', { x, y: pos.y, z });
  }
});

// Semiconductor Laser Physics Constants
const I_TH = 25.0; // Threshold Current = 25 mA
const SLOPE_EFF = 0.42; // mW per mA above threshold
const SPONT_EFF = 0.007; // Weak spontaneous efficiency
const PEAK_NM = 650; // Central wavelength (nm)

let current_mA = 0.0;
let chartPoints = [{ x: 0, y: 0 }];

let liChart = null;
let specChart = null;

// Optical Power Calculation
function getPower(I) {
  if (I <= 0) return 0;
  if (I <= I_TH) {
    return I * SPONT_EFF;
  } else {
    return (I_TH * SPONT_EFF) + (I - I_TH) * SLOPE_EFF;
  }
}

// Spectrum Calculation (Fine 0.5 nm sampling for High Definition smooth Gaussian curve)
function getSpectrum(I) {
  const lambdas = [];
  const intensities = [];
  const p = getPower(I);

  const fwhm = (I < I_TH) ? (35 - (I / I_TH) * 10) : Math.max(0.8, 25 / Math.pow(I / I_TH, 2.5));

  for (let l = 600; l <= 700; l += 0.5) {
    const roundedL = parseFloat(l.toFixed(1));
    lambdas.push(roundedL);
    if (p <= 0) {
      intensities.push(0);
    } else {
      const g = Math.exp(-Math.pow(roundedL - PEAK_NM, 2) / (2 * Math.pow(fwhm / 2.355, 2)));
      intensities.push(parseFloat((g * p).toFixed(3)));
    }
  }
  return { lambdas, intensities, fwhm };
}

// Procedural Floor & Breadboard Textures
function generateLabTextures() {
  const fCanvas = document.getElementById('floorCanvas');
  if (fCanvas) {
    const fCtx = fCanvas.getContext('2d');
    fCtx.fillStyle = '#1e2638';
    fCtx.fillRect(0, 0, 256, 256);
    fCtx.strokeStyle = '#2b354d';
    fCtx.lineWidth = 4;
    fCtx.strokeRect(2, 2, 252, 252);
    fCtx.strokeStyle = '#151c2a';
    fCtx.lineWidth = 1;
    fCtx.strokeRect(0, 0, 256, 256);
  }

  const bCanvas = document.getElementById('breadboardCanvas');
  if (bCanvas) {
    const bCtx = bCanvas.getContext('2d');
    bCtx.fillStyle = '#121721';
    bCtx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#06080d';
    for (let x = 16; x < 256; x += 32) {
      for (let y = 16; y < 256; y += 32) {
        bCtx.beginPath();
        bCtx.arc(x, y, 4, 0, Math.PI * 2);
        bCtx.fill();
      }
    }
  }
}

// Draw Emojified Laser Warning Sign (High Resolution 1024x512)
function drawWarningSign() {
  const canvas = document.getElementById('warningSignCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 1024, 512);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 24;
  ctx.strokeRect(12, 12, 1000, 488);

  ctx.fillStyle = '#000000';
  ctx.fillRect(36, 36, 952, 100);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 50px "Segoe UI Emoji", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚠️  DANGER / CAUTION  ⚠️', 512, 86);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 40px "Segoe UI Emoji", Arial, sans-serif';
  ctx.fillText('⚡ HIGH INTENSITY LASER RADIATION AHEAD ⚡', 512, 205);

  ctx.font = 'bold 34px "Segoe UI Emoji", Arial, sans-serif';
  ctx.fillText('🔴 CLASS 3B SEMICONDUCTOR LASER DIODE (650 nm)', 512, 275);

  ctx.font = 'bold 32px "Segoe UI Emoji", Arial, sans-serif';
  ctx.fillText('🕶️ PROTECTIVE SAFETY EYEWEAR MANDATORY 🕶️', 512, 345);

  ctx.font = 'bold 28px "Segoe UI Emoji", Arial, sans-serif';
  ctx.fillStyle = '#7f1d1d';
  ctx.fillText('🚫 RESTRICTED OPTICAL LAB AREA - AUTHORIZED ACCESS ONLY 🚫', 512, 425);

  const warnPlane = document.querySelector('#warning-sign');
  if (warnPlane && warnPlane.getObject3D('mesh')) {
    const mat = warnPlane.getObject3D('mesh').material;
    if (mat && mat.map) mat.map.needsUpdate = true;
  }
}

// Draw Left Screen: High Resolution Characterization Theory (1024x768, Never Overflows)
function drawTheoryScreen() {
  const canvas = document.getElementById('theoryCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 768);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 1018, 762);

  ctx.fillStyle = '#0369a1';
  ctx.fillRect(6, 6, 1012, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Segoe UI Emoji", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📖 SEMICONDUCTOR LASER CHARACTERIZATION THEORY', 512, 41);

  // Card 1: L-I Curve Characteristics
  ctx.fillStyle = '#172033';
  ctx.fillRect(20, 95, 984, 180);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 95, 984, 180);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('1. Light-Current (L-I) Operating Regimes:', 40, 128);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('• Sub-Threshold (I < 25 mA): Spontaneous emission dominates (Broadband LED mode, low efficiency).', 45, 165);
  ctx.fillText('• Threshold Current (Ith = 25.0 mA): Optical gain equals internal cavity losses; stimulated onset.', 45, 202);
  ctx.fillText('• Lasing Region (I >= 25 mA): Population inversion sustains coherent stimulated photon emission.', 45, 239);

  // Card 2: Spectral Profile
  ctx.fillStyle = '#172033';
  ctx.fillRect(20, 290, 984, 155);
  ctx.strokeRect(20, 290, 984, 155);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('2. Spectral Profile & Linewidth Narrowing:', 40, 323);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('• Spontaneous Spectrum: Broad emission band with full-width-half-maximum FWHM ~35 nm.', 45, 360);
  ctx.fillText('• Coherent Collapse: Resonant Fabry-Pérot cavity collapses emission into a single peak (FWHM < 1 nm).', 45, 397);
  ctx.fillText('• Peak Emission Wavelength: Fixed at central red peak 650 nm based on semiconductor bandgap.', 45, 428);

  // Card 3: Governing Formulas
  ctx.fillStyle = '#172033';
  ctx.fillRect(20, 460, 984, 140);
  ctx.strokeRect(20, 460, 984, 140);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('3. Governing Physics & Slope Efficiency Formula:', 40, 493);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('• Optical Power Output: P = (I - Ith) * eta_ext   (valid for injection current I >= Ith)', 45, 530);
  ctx.fillText('• Differential Slope Efficiency: eta_ext = dP / dI = 0.42 mW/mA (quantum conversion above threshold).', 45, 568);

  // Card 4: Quick Guide
  ctx.fillStyle = '#0f2942';
  ctx.fillRect(20, 615, 984, 135);
  ctx.strokeStyle = '#0284c7';
  ctx.strokeRect(20, 615, 984, 135);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 21px Arial, sans-serif';
  ctx.fillText('🔬 Virtual Experiment Workflow:', 40, 648);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('1. Click "+5 mA" or "+1 mA" buttons on the table or screen to sweep injection current.', 45, 683);
  ctx.fillText('2. Observe the knee point at Ith = 25 mA on Left Monitor & spectral collapse on Right Monitor.', 45, 718);

  const theoryPlane = document.querySelector('#theory-screen');
  if (theoryPlane && theoryPlane.getObject3D('mesh')) {
    const mat = theoryPlane.getObject3D('mesh').material;
    if (mat && mat.map) mat.map.needsUpdate = true;
  }
}

// Draw Right Screen: High Resolution Live Observation Table (1024x768)
function drawObservationTable(I, P, spec) {
  const canvas = document.getElementById('obsTableCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 768);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 1018, 762);

  ctx.fillStyle = '#0369a1';
  ctx.fillRect(6, 6, 1012, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Segoe UI Emoji", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📊 LIVE EXPERIMENT OBSERVATION & MEASUREMENTS', 512, 41);

  // Table Column Header
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(16, 88, 992, 54);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 23px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PARAMETER', 35, 122);
  ctx.fillText('LIVE VALUE', 400, 122);
  ctx.fillText('SPECIFICATION / UNIT', 620, 122);
  ctx.fillText('STATUS', 870, 122);

  const isLasing = I >= I_TH;
  const isOff = I <= 0;

  const rows = [
    {
      param: 'Injection Current (I)',
      val: `${I.toFixed(1)} mA`,
      spec: '0.0 - 60.0 mA',
      status: isOff ? 'System Idle' : 'Input Active',
      valColor: '#ffffff',
      statusColor: isOff ? '#94a3b8' : '#38bdf8'
    },
    {
      param: 'Optical Power Output (P)',
      val: `${P.toFixed(2)} mW`,
      spec: 'Photodetector (mW)',
      status: isOff ? 'No Output' : (isLasing ? 'High (Lasing)' : 'Low (Spontaneous)'),
      valColor: isOff ? '#94a3b8' : (isLasing ? '#22c55e' : '#fbbf24'),
      statusColor: isOff ? '#94a3b8' : (isLasing ? '#22c55e' : '#fbbf24')
    },
    {
      param: 'Threshold Current (Ith)',
      val: '25.0 mA',
      spec: 'Laser Benchmark',
      status: I >= 25 ? 'Exceeded (I >= Ith)' : 'Below (I < Ith)',
      valColor: '#ffffff',
      statusColor: I >= 25 ? '#22c55e' : '#94a3b8'
    },
    {
      param: 'Differential Slope Efficiency',
      val: '0.42 mW/mA',
      spec: 'eta = dP / dI',
      status: isLasing ? 'Active (Laser Slope)' : 'Inactive (I < Ith)',
      valColor: isLasing ? '#38bdf8' : '#94a3b8',
      statusColor: isLasing ? '#38bdf8' : '#94a3b8'
    },
    {
      param: 'Spectral Linewidth (FWHM)',
      val: isOff ? '-- nm' : `${spec.fwhm.toFixed(1)} nm`,
      spec: 'Optical Cavity Width',
      status: isOff ? 'No Emission' : (isLasing ? 'Coherent Spike' : 'Broadband Hump'),
      valColor: isOff ? '#94a3b8' : (isLasing ? '#ef4444' : '#fbbf24'),
      statusColor: isOff ? '#94a3b8' : (isLasing ? '#ef4444' : '#fbbf24')
    },
    {
      param: 'Laser Operating Regime',
      val: isOff ? 'OFF' : (isLasing ? 'STIMULATED' : 'SPONTANEOUS'),
      spec: 'Population Inversion',
      status: isOff ? 'Standby' : (isLasing ? 'LASING ACTIVE' : 'LED MODE'),
      valColor: isOff ? '#94a3b8' : (isLasing ? '#22c55e' : '#fbbf24'),
      statusColor: isOff ? '#94a3b8' : (isLasing ? '#22c55e' : '#fbbf24')
    }
  ];

  rows.forEach((r, idx) => {
    const y = 175 + idx * 82;
    if (idx % 2 === 0) {
      ctx.fillStyle = '#172033';
      ctx.fillRect(16, y - 28, 992, 74);
    }

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '22px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.param, 35, y + 16);

    ctx.fillStyle = r.valColor;
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(r.val, 400, y + 16);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(r.spec, 620, y + 16);

    ctx.fillStyle = r.statusColor;
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText(r.status, 870, y + 16);
  });

  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 19px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('All measurements update in real-time as current dial is adjusted', 512, 735);

  const obsPlane = document.querySelector('#obs-screen');
  if (obsPlane && obsPlane.getObject3D('mesh')) {
    const mat = obsPlane.getObject3D('mesh').material;
    if (mat && mat.map) mat.map.needsUpdate = true;
  }
}

// High-Contrast Solid Canvas Background & Bezel Plugin for Scientific Instruments
const darkCanvasPlugin = {
  id: 'darkCanvasPlugin',
  beforeDraw: (chart) => {
    const { ctx, width, height } = chart;
    ctx.save();
    // Solid rich lab dark background
    ctx.fillStyle = '#070c18';
    ctx.fillRect(0, 0, width, height);

    // Bezel border
    const isLI = chart.canvas.id === 'liChartCanvas';
    ctx.strokeStyle = isLI ? '#0284c7' : '#dc2626';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, width - 6, height - 6);

    // Header banner bar inside canvas
    ctx.fillStyle = isLI ? 'rgba(2, 132, 199, 0.22)' : 'rgba(220, 38, 38, 0.22)';
    ctx.fillRect(6, 6, width - 12, 60);

    ctx.restore();
  }
};

// Initialize Dual Virtual Monitors (Ultra-Sharp 1024x768 High-Contrast HD Displays)
function setupCharts() {
  const ctxLI = document.getElementById('liChartCanvas').getContext('2d');
  liChart = new Chart(ctxLI, {
    type: 'line',
    plugins: [darkCanvasPlugin],
    data: {
      datasets: [{
        label: 'Optical Power P (mW)',
        data: chartPoints,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.25)',
        fill: true,
        pointRadius: 8,
        pointHoverRadius: 11,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#0284c7',
        pointBorderWidth: 3,
        borderWidth: 5,
        tension: 0.1
      }]
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: { top: 12, bottom: 24, left: 36, right: 40 }
      },
      scales: {
        x: { 
          type: 'linear',
          min: 0,
          max: 60,
          title: { 
            display: true, 
            text: 'Forward Current  I (mA)  ⟶', 
            color: '#38bdf8', 
            font: { size: 28, weight: 'bold', family: 'Arial, sans-serif' },
            padding: { top: 14 }
          }, 
          ticks: { 
            color: '#ffffff', 
            font: { size: 24, weight: 'bold', family: 'Arial, sans-serif' }, 
            stepSize: 10 
          },
          grid: { 
            color: 'rgba(56, 189, 248, 0.28)', 
            lineWidth: 2 
          },
          border: {
            color: '#38bdf8',
            width: 3
          }
        },
        y: { 
          type: 'linear',
          min: 0, 
          max: 20, 
          title: { 
            display: true, 
            text: 'Optical Power  P (mW)  ⟶', 
            color: '#38bdf8', 
            font: { size: 28, weight: 'bold', family: 'Arial, sans-serif' },
            padding: { bottom: 14 }
          }, 
          ticks: { 
            color: '#ffffff', 
            font: { size: 24, weight: 'bold', family: 'Arial, sans-serif' }, 
            stepSize: 5 
          },
          grid: { 
            color: 'rgba(56, 189, 248, 0.28)', 
            lineWidth: 2 
          },
          border: {
            color: '#38bdf8',
            width: 3
          }
        }
      },
      plugins: { 
        title: {
          display: true,
          text: 'L-I Characteristic Curve',
          color: '#ffffff',
          font: { size: 30, weight: 'bold', family: 'Arial, sans-serif' },
          padding: { top: 10, bottom: 20 }
        },
        legend: { 
          labels: { 
            color: '#38bdf8', 
            font: { size: 22, weight: 'bold', family: 'Arial, sans-serif' },
            boxWidth: 26
          } 
        }
      }
    }
  });

  const ctxSpec = document.getElementById('specChartCanvas').getContext('2d');
  specChart = new Chart(ctxSpec, {
    type: 'line',
    plugins: [darkCanvasPlugin],
    data: {
      labels: [],
      datasets: [{
        label: 'Relative Spectral Intensity (a.u.)',
        data: [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.28)',
        fill: true,
        pointRadius: 0,
        borderWidth: 4.5,
        tension: 0.2
      }]
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: { top: 12, bottom: 24, left: 36, right: 40 }
      },
      scales: {
        x: { 
          type: 'linear',
          min: 600,
          max: 700,
          title: { 
            display: true, 
            text: 'Wavelength  λ (nm)  ⟶', 
            color: '#f87171', 
            font: { size: 28, weight: 'bold', family: 'Arial, sans-serif' },
            padding: { top: 14 }
          }, 
          ticks: { 
            color: '#ffffff', 
            font: { size: 24, weight: 'bold', family: 'Arial, sans-serif' }, 
            stepSize: 20 
          },
          grid: { 
            color: 'rgba(239, 68, 68, 0.28)', 
            lineWidth: 2 
          },
          border: {
            color: '#ef4444',
            width: 3
          }
        },
        y: { 
          type: 'linear',
          min: 0, 
          max: 20, 
          title: { 
            display: true, 
            text: 'Intensity  (a.u.)  ⟶', 
            color: '#f87171', 
            font: { size: 28, weight: 'bold', family: 'Arial, sans-serif' },
            padding: { bottom: 14 }
          }, 
          ticks: { 
            color: '#ffffff', 
            font: { size: 24, weight: 'bold', family: 'Arial, sans-serif' }, 
            stepSize: 5 
          },
          grid: { 
            color: 'rgba(239, 68, 68, 0.28)', 
            lineWidth: 2 
          },
          border: {
            color: '#ef4444',
            width: 3
          }
        }
      },
      plugins: { 
        title: {
          display: true,
          text: 'Optical Emission Spectrum - 650 nm',
          color: '#ffffff',
          font: { size: 30, weight: 'bold', family: 'Arial, sans-serif' },
          padding: { top: 10, bottom: 20 }
        },
        legend: { 
          labels: { 
            color: '#ef4444', 
            font: { size: 22, weight: 'bold', family: 'Arial, sans-serif' },
            boxWidth: 26
          } 
        }
      }
    }
  });
}

// Refresh VR Screens with Anisotropic Filtering & Maximum Clarity
function refreshMonitors() {
  const screens = ['#li-screen', '#spec-screen', '#warning-sign', '#theory-screen', '#obs-screen'];
  screens.forEach(sel => {
    const el = document.querySelector(sel);
    if (el && el.getObject3D('mesh')) {
      const mat = el.getObject3D('mesh').material;
      if (mat && mat.map) {
        mat.map.anisotropy = 16;
        mat.map.minFilter = THREE.LinearFilter;
        mat.map.magFilter = THREE.LinearFilter;
        mat.map.needsUpdate = true;
      }
    }
  });
}

// Update L-I Curve Data Points dynamically with current dial
function recordDataPoint(I, P) {
  const roundedI = parseFloat(I.toFixed(1));
  const roundedP = parseFloat(P.toFixed(3));

  chartPoints = chartPoints.filter(pt => pt.x <= roundedI);

  const existing = chartPoints.find(pt => pt.x === roundedI);
  if (existing) {
    existing.y = roundedP;
  } else {
    chartPoints.push({ x: roundedI, y: roundedP });
  }

  chartPoints.sort((a, b) => a.x - b.x);

  if (liChart) {
    liChart.data.datasets[0].data = chartPoints;
    liChart.update();
  }
}

// Simulation & UI Loop
function updateSimulation() {
  const p = getPower(current_mA);
  const spec = getSpectrum(current_mA);

  // LCD Readout on LD Controller
  const lcd = document.querySelector('#lcd-display');
  if (lcd) lcd.setAttribute('value', `I: ${current_mA.toFixed(1)} mA\nP: ${p.toFixed(2)} mW`);

  // Laser Beam Intensity & Collimation
  const beam = document.querySelector('#laser-beam');
  if (beam) {
    if (current_mA <= 0) {
      beam.setAttribute('material', 'opacity', 0.0);
    } else if (current_mA < I_TH) {
      beam.setAttribute('radius', 0.007);
      beam.setAttribute('material', 'opacity', 0.16);
      beam.setAttribute('color', '#f87171');
    } else {
      beam.setAttribute('radius', 0.0032);
      const intensity = Math.min(1.0, 0.5 + (current_mA - I_TH) * 0.035);
      beam.setAttribute('material', 'opacity', intensity);
      beam.setAttribute('color', '#ff0000');
    }
  }

  // Update Data Points in Chart
  recordDataPoint(current_mA, p);

  // Update Optical Spectrum Chart
  if (specChart) {
    // Generate spectrum points as {x: wavelength, y: intensity}
    const specData = spec.lambdas.map((l, i) => ({ x: l, y: spec.intensities[i] }));
    specChart.data.datasets[0].data = specData;
    specChart.update();
  }

  // Update Live Observation Table
  drawObservationTable(current_mA, p, spec);

  refreshMonitors();
}

function increaseCurrent(delta = 5) {
  if (current_mA < 60) {
    current_mA = Math.min(60, parseFloat((current_mA + delta).toFixed(1)));
    updateSimulation();
  }
}

function decreaseCurrent(delta = 5) {
  if (current_mA > 0) {
    current_mA = Math.max(0, parseFloat((current_mA - delta).toFixed(1)));
    updateSimulation();
  }
}

function resetSimulation() {
  current_mA = 0;
  chartPoints = [{ x: 0, y: 0 }];
  if (liChart) {
    liChart.data.datasets[0].data = chartPoints;
  }
  updateSimulation();
}

// Event Bindings
window.addEventListener('DOMContentLoaded', () => {
  generateLabTextures();
  drawWarningSign();
  drawTheoryScreen();
  setupCharts();
  updateSimulation();

  function attachButton(id, action) {
    const el = document.querySelector(id);
    if (!el) return;
    el.addEventListener('click', (e) => { e.stopPropagation(); action(); });
    const txt = el.querySelector('a-text');
    if (txt) txt.addEventListener('click', (e) => { e.stopPropagation(); action(); });
  }

  // 3D Table Buttons
  attachButton('#btn-increase', () => increaseCurrent(5));
  attachButton('#btn-step-fine', () => increaseCurrent(1));
  attachButton('#btn-decrease', () => decreaseCurrent(5));
  attachButton('#btn-reset', () => resetSimulation());

  // 2D Screen Overlay Buttons
  const uiInc = document.querySelector('#ui-btn-inc');
  if (uiInc) uiInc.addEventListener('click', () => increaseCurrent(5));
  const uiFine = document.querySelector('#ui-btn-fine');
  if (uiFine) uiFine.addEventListener('click', () => increaseCurrent(1));
  const uiDec = document.querySelector('#ui-btn-dec');
  if (uiDec) uiDec.addEventListener('click', () => decreaseCurrent(5));
  const uiReset = document.querySelector('#ui-btn-reset');
  if (uiReset) uiReset.addEventListener('click', () => resetSimulation());

  // Keyboard Controls: Dedicated +/- for Current, Arrow Keys for Walking
  window.addEventListener('keydown', (e) => {
    if (e.target && ['input', 'textarea'].includes(e.target.tagName?.toLowerCase())) return;
    if (e.key === '=' || e.key === '+') {
      if (e.shiftKey) {
        increaseCurrent(1);
      } else {
        increaseCurrent(5);
      }
    } else if (e.key === '-' || e.key === '_') {
      decreaseCurrent(5);
    } else if (e.key === 'r' || e.key === 'R') {
      resetSimulation();
    }
  });

  // Ensure A-Frame scene texture updates when loaded
  const scene = document.querySelector('a-scene');
  if (scene) {
    if (scene.hasLoaded) {
      drawWarningSign();
      drawTheoryScreen();
      refreshMonitors();
    } else {
      scene.addEventListener('loaded', () => {
        drawWarningSign();
        drawTheoryScreen();
        refreshMonitors();
      });
    }
  }
});
