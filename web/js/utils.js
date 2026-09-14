/**
 * AI Karaoke Studio Pro — Utility Functions
 */

export function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatTimeMs(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00.00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export function parseTimeMs(str) {
    try {
        const parts = str.trim().split(":");
        const m = parseFloat(parts[0]);
        const s = parseFloat(parts[1]);
        return m * 60 + s;
    } catch {
        return 0;
    }
}

export function roundNum(val, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
}

export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function hexToAssColor(hex) {
    // Convert #RRGGBB to &H00BBGGRR&
    hex = (hex || "").replace("#", "").trim();
    if (hex.length === 6) {
        const r = hex.substring(0, 2);
        const g = hex.substring(2, 4);
        const b = hex.substring(4, 6);
        return `&H00${b}${g}${r}&`.toUpperCase();
    }
    return "&H00FFFFFF&";
}

export function assColorToHex(assStr) {
    // Convert &H00BBGGRR or &H00BBGGRR& to #RRGGBB
    if (!assStr) return "#ffffff";
    const clean = assStr.replace(/&/g, "").replace(/^H/i, "");
    if (clean.length >= 8) {
        const b = clean.substring(2, 4);
        const g = clean.substring(4, 6);
        const r = clean.substring(6, 8);
        return `#${r}${g}${b}`;
    }
    return "#ffffff";
}

export function showToastNotification(msg, duration = 3000) {
    let toast = document.getElementById("studioToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "studioToast";
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: rgba(14, 20, 35, 0.95);
            border: 1px solid var(--cyan-accent);
            color: #fff;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 700;
            box-shadow: 0 4px 20px rgba(0, 242, 254, 0.35);
            z-index: 9999;
            transition: opacity 0.3s ease, transform 0.3s ease;
            backdrop-filter: blur(10px);
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
    }, duration);
}
