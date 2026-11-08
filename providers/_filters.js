/**
 * _filters.js — Shared stream filter utility for All-in-One-Nuvio
 * Drop this file into your /providers/ folder.
 * Then call filterStreams(streams) at the end of any provider's getStreams().
 *
 * CONFIGURE YOUR FILTERS BELOW — set to null to disable a filter.
 */

const FILTER_CONFIG = {

  // ── RESOLUTION ──────────────────────────────────────────────────────────
  // Keep only streams matching these resolutions.
  // Options: "4K", "2160p", "1080p", "720p", "480p", "360p"
  // Set to null to allow ALL resolutions.
  resolution: null, // e.g. ["4K", "2160p", "1080p"]

  // ── FORMAT / RELEASE TYPE ───────────────────────────────────────────────
  // Keep only streams matching these release types (parsed from title/filename).
  // Options: "BluRay", "BluRay Remux", "WEB-DL", "WEBRip", "HDTV", "CAM", "TS", "IMAX"
  // Set to null to allow ALL formats.
  format: null, // e.g. ["BluRay", "WEB-DL", "IMAX"]

  // ── HDR / VISUAL TAG ────────────────────────────────────────────────────
  // Keep only streams with these HDR tags.
  // Options: "Dolby Vision", "DV", "HDR10+", "HDR10", "HDR", "SDR"
  // Set to null to allow ALL.
  hdr: null, // e.g. ["Dolby Vision", "HDR10+", "HDR10"]

  // ── AUDIO ────────────────────────────────────────────────────────────────
  // Keep only streams with these audio tags.
  // Options: "Atmos", "TrueHD", "DTS-X", "DTS-HD", "DTS", "DD+", "EAC3", "AAC"
  // Set to null to allow ALL.
  audio: null, // e.g. ["Atmos", "TrueHD", "DTS"]

  // ── LANGUAGE ────────────────────────────────────────────────────────────
  // Keep only streams matching these language keywords in the title.
  // Options: "English", "Hindi", "Tamil", "Telugu", "Korean", "Japanese",
  //          "French", "Arabic", "Spanish", "Portuguese", "Russian", "Dual", "Multi"
  // Set to null to allow ALL languages.
  language: null, // e.g. ["English", "Hindi", "Dual"]

  // ── BLOCK LOW QUALITY ───────────────────────────────────────────────────
  // Automatically remove CAM/TS/HDCAM/SCR streams (cinema recordings).
  blockCam: true,

  // ── MINIMUM SIZE ────────────────────────────────────────────────────────
  // Block streams smaller than this (in MB). Catches broken/tiny links.
  // Set to 0 to disable.
  minSizeMB: 150,

};

// ── PATTERN MAPS ────────────────────────────────────────────────────────────

const RESOLUTION_PATTERNS = {
  "4K":    /\b(4K|2160p|UHD)\b/i,
  "2160p": /\b(4K|2160p|UHD)\b/i,
  "1080p": /\b1080p?\b/i,
  "720p":  /\b720p?\b/i,
  "480p":  /\b480p?\b/i,
  "360p":  /\b360p?\b/i,
};

const FORMAT_PATTERNS = {
  "BluRay Remux": /\b(blu.?ray.?remux|remux)\b/i,
  "BluRay":       /\b(blu.?ray|bdrip|brrip)\b/i,
  "WEB-DL":       /\b(web.?dl|webdl)\b/i,
  "WEBRip":       /\b(web.?rip|webrip)\b/i,
  "HDTV":         /\bhdtv\b/i,
  "IMAX":         /\bimax\b/i,
  "CAM":          /\b(cam|hdcam|camrip|hc\.?hdrip)\b/i,
  "TS":           /\b(ts|telesync|tele.?sync|hd.?ts)\b/i,
  "SCR":          /\b(scr|screener)\b/i,
};

const HDR_PATTERNS = {
  "Dolby Vision": /\b(dolby.?vision|dv)\b/i,
  "DV":           /\b(dolby.?vision|dv)\b/i,
  "HDR10+":       /\bhdr10\+/i,
  "HDR10":        /\bhdr10\b/i,
  "HDR":          /\bhdr\b/i,
  "SDR":          /\bsdr\b/i,
};

const AUDIO_PATTERNS = {
  "Atmos":   /\b(atmos|truehd.atmos|dd\+.atmos)\b/i,
  "TrueHD":  /\btruehd\b/i,
  "DTS-X":   /\bdts[-.]?x\b/i,
  "DTS-HD":  /\bdts[-.]?hd\b/i,
  "DTS":     /\bdts\b/i,
  "DD+":     /\b(dd\+|eac3|e-ac-3)\b/i,
  "EAC3":    /\b(eac3|e-ac-3|dd\+)\b/i,
  "AAC":     /\baac\b/i,
};

const LANGUAGE_PATTERNS = {
  "English":    /\b(english|eng)\b/i,
  "Hindi":      /\b(hindi|hin)\b/i,
  "Tamil":      /\b(tamil|tam)\b/i,
  "Telugu":     /\b(telugu|tel)\b/i,
  "Korean":     /\b(korean|kor)\b/i,
  "Japanese":   /\b(japanese|jpn|jap)\b/i,
  "French":     /\b(french|fra|vf|vostfr)\b/i,
  "Arabic":     /\b(arabic|ara)\b/i,
  "Spanish":    /\b(spanish|spa|esp)\b/i,
  "Portuguese": /\b(portuguese|por|pt)\b/i,
  "Russian":    /\b(russian|rus)\b/i,
  "Dual":       /\b(dual|dual.?audio)\b/i,
  "Multi":      /\b(multi|multilang|multi.?lang)\b/i,
};

// ── HELPER ───────────────────────────────────────────────────────────────────

function getSearchText(stream) {
  // Build a single string from all stream fields we can inspect
  return [
    stream.title  || "",
    stream.name   || "",
    stream.quality|| "",
    stream.size   || "",
  ].join(" ");
}

function matchesAny(text, keys, patternMap) {
  return keys.some(key => {
    const pattern = patternMap[key];
    return pattern && pattern.test(text);
  });
}

function parseSizeMB(stream) {
  const raw = (stream.size || stream.fileSize || "").toString();
  const gb = raw.match(/([\d.]+)\s*GB/i);
  if (gb) return parseFloat(gb[1]) * 1024;
  const mb = raw.match(/([\d.]+)\s*MB/i);
  if (mb) return parseFloat(mb[1]);
  return null; // unknown — don't filter out
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────

/**
 * filterStreams(streams, overrides?)
 *
 * @param {Array}  streams   - The raw stream array from your provider
 * @param {Object} overrides - Optional per-call config overrides (same keys as FILTER_CONFIG)
 * @returns {Array}          - Filtered (and optionally sorted) stream array
 *
 * Usage inside any provider:
 *   const { filterStreams } = require('./_filters');
 *   ...
 *   return filterStreams(rawStreams);
 */
function filterStreams(streams, overrides) {
  if (!streams || streams.length === 0) return streams;

  const cfg = Object.assign({}, FILTER_CONFIG, overrides || {});

  const result = streams.filter(stream => {
    const text = getSearchText(stream);

    // ── Block CAM/TS ──────────────────────────────────────────────────────
    if (cfg.blockCam) {
      const isCam = FORMAT_PATTERNS["CAM"].test(text) ||
                    FORMAT_PATTERNS["TS"].test(text)  ||
                    FORMAT_PATTERNS["SCR"].test(text);
      if (isCam) return false;
    }

    // ── Minimum size ─────────────────────────────────────────────────────
    if (cfg.minSizeMB && cfg.minSizeMB > 0) {
      const sizeMB = parseSizeMB(stream);
      if (sizeMB !== null && sizeMB < cfg.minSizeMB) return false;
    }

    // ── Resolution ───────────────────────────────────────────────────────
    if (cfg.resolution && cfg.resolution.length > 0) {
      if (!matchesAny(text, cfg.resolution, RESOLUTION_PATTERNS)) return false;
    }

    // ── Format / Release type ────────────────────────────────────────────
    if (cfg.format && cfg.format.length > 0) {
      if (!matchesAny(text, cfg.format, FORMAT_PATTERNS)) return false;
    }

    // ── HDR / Visual tag ─────────────────────────────────────────────────
    if (cfg.hdr && cfg.hdr.length > 0) {
      if (!matchesAny(text, cfg.hdr, HDR_PATTERNS)) return false;
    }

    // ── Audio ────────────────────────────────────────────────────────────
    if (cfg.audio && cfg.audio.length > 0) {
      if (!matchesAny(text, cfg.audio, AUDIO_PATTERNS)) return false;
    }

    // ── Language ─────────────────────────────────────────────────────────
    if (cfg.language && cfg.language.length > 0) {
      if (!matchesAny(text, cfg.language, LANGUAGE_PATTERNS)) return false;
    }

    return true;
  });

  return result;
}

module.exports = { filterStreams, FILTER_CONFIG };
