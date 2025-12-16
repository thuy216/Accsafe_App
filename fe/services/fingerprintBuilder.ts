import { ProfileItem } from '../types';

/**
 * Parse screen resolution từ string "1920x1080" thành width và height
 */
const parseResolution = (resolution: string): { width: number; height: number } => {
  const [width, height] = resolution.split('x').map(Number);
  return { width: width || 1920, height: height || 1080 };
};

/**
 * Parse GPU string để tạo WebGL vendor và renderer
 */
const parseGPU = (gpu: string): { vendor: string; renderer: string } => {
  // Mặc định NVIDIA
  let vendor = 'Google Inc. (NVIDIA)';
  let renderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
  
  if (gpu.includes('NVIDIA')) {
    const model = gpu.replace('NVIDIA ', '').trim();
    vendor = 'Google Inc. (NVIDIA)';
    renderer = `ANGLE (NVIDIA, ${gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
  } else if (gpu.includes('AMD')) {
    vendor = 'Google Inc. (AMD)';
    renderer = `ANGLE (AMD, ${gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
  } else if (gpu.includes('Intel')) {
    vendor = 'Google Inc. (Intel)';
    renderer = `ANGLE (Intel, ${gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
  } else if (gpu.includes('Apple')) {
    vendor = 'Apple Inc.';
    renderer = `Apple GPU (${gpu})`;
  }
  
  return { vendor, renderer };
};

/**
 * Extract Chrome version từ User Agent
 */
const extractChromeVersion = (userAgent: string): string => {
  const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
  if (match) {
    return match[1];
  }
  // Default version
  return '142.0.0.0';
};

/**
 * Extract full version từ User Agent
 */
const extractFullVersion = (userAgent: string): string => {
  const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
  if (match) {
    const version = match[1];
    // Giả sử build number
    return `${version.split('.')[0]}.0.7444.177`;
  }
  return '142.0.7444.177';
};

/**
 * Build RUYI config từ ProfileItem (tương đương RUYI_CONFIG trong Python)
 */
export const buildRuyiConfig = (profile: ProfileItem, proxyIP: string): string => {
  const resolution = parseResolution(profile.hardware.screenResolution);
  const gpuInfo = parseGPU(profile.hardware.gpu);
  const chromeVersion = extractChromeVersion(profile.userAgent);
  const fullVersion = extractFullVersion(profile.userAgent);
  const majorVersion = chromeVersion.split('.')[0];

  // Build brands array
  const brands = [
    { brand: 'Chromium', version: majorVersion },
    { brand: 'Google Chrome', version: majorVersion },
    { brand: 'Not_A Brand', version: '24' }
  ];

  // Determine platform info based on OS
  let platform = 'Windows';
  let legacyPlatform = 'Win32';
  let platformVersion = '15.0.0';
  let architecture = 'x86';
  let bitness = '64';

  if (profile.os === 'mac') {
    platform = 'MacIntel';
    legacyPlatform = 'MacIntel';
    platformVersion = '10_15_7';
  } else if (profile.os === 'linux') {
    platform = 'Linux x86_64';
    legacyPlatform = 'Linux x86_64';
    platformVersion = '5.0.0';
  }

  // Build RUYI config object
  const ruyiConfig: any = {
    uaFullVersion: fullVersion,
    ua: profile.userAgent,
    brands: brands,
    
    platform: platform,
    legacy_platform: legacyPlatform,
    platformVersion: platformVersion,
    architecture: architecture,
    bitness: bitness,
    mobile: profile.deviceType === 'mobile',

    cpu: profile.hardware.cpuCores,
    memory: profile.hardware.ram,
    screen_width: resolution.width,
    screen_height: resolution.height,
    screen_availWidth: resolution.width,
    screen_availHeight: resolution.height - 40, // Trừ taskbar
    screen_colorDepth: 24,
    screen_pixelDepth: 24,
    devicePixelRatio: 1.0,

    webgl_vendor: gpuInfo.vendor,
    webgl_renderer: gpuInfo.renderer,
    webgl_max_texture_size: 16384,
    webgl_max_cube_map_texture_size: 16384,
    webgl_max_render_buffer: 16384,
    webgl_max_viewport_dims: 16384,
    webgl_max_vertex_texture_image_units: 32,
    webgl_max_texture_image_units: 32,

    // Inject proxy IP vào WebRTC
    webrtc_public_ip: proxyIP,
    
    net_downlink: 10.0,
    net_rtt: 50,
    dnt: '1',
    noise_seed: Math.floor(Math.random() * 100000),
    battery_level: 1.0,
    battery_charging: true
  };

  return JSON.stringify(ruyiConfig, null, 0).replace(/\s+/g, '');
};

