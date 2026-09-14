/**
 * AI Karaoke Studio Pro — System Info & Auto-Update Engine
 */

import { state } from './state.js';
import { showToastNotification } from './utils.js';

export async function fetchSystemInfo() {
    const gpuStatusText = document.getElementById("gpuStatusText");
    const whisperModelSelect = document.getElementById("whisperModelSelect");
    try {
        const res = await fetch("/api/system-info");
        const data = await res.json();
        state.cudaAvailable = data.cuda_available;
        const hwInput = document.getElementById("hardwareModeInput");
        const hwGpuBtn = document.getElementById("hwGpuBtn");
        const hwCpuBtn = document.getElementById("hwCpuBtn");

        if (data.cuda_available) {
            if (gpuStatusText) {
                gpuStatusText.textContent = `${data.gpu_name} • GPU CUDA Online`;
                gpuStatusText.style.color = "#10B981";
            }
            if (hwInput) hwInput.value = "gpu";
            if (hwGpuBtn && hwCpuBtn) {
                hwGpuBtn.classList.add("active");
                hwCpuBtn.classList.remove("active");
            }
        } else {
            const cpuLabel = data.gpu_name ? `Phần Cứng: ${data.gpu_name}` : "Phần Cứng: CPU Đa Luồng";
            if (gpuStatusText) {
                gpuStatusText.textContent = cpuLabel;
                gpuStatusText.style.color = "#38BDF8";
            }
            if (hwInput) hwInput.value = "cpu";
            if (hwGpuBtn && hwCpuBtn) {
                hwCpuBtn.classList.add("active");
                hwGpuBtn.classList.remove("active");
                hwGpuBtn.style.opacity = "0.6";
                const gpuSub = hwGpuBtn.querySelector(".hw-sub");
                if (gpuSub) gpuSub.textContent = "Máy không có card rời NVIDIA • Đã kích hoạt Chế Độ CPU Siêu Tốc";
            }
            if (whisperModelSelect) {
                whisperModelSelect.value = data.recommended_whisper || "tiny";
            }
        }
    } catch (e) {
        if (gpuStatusText) gpuStatusText.textContent = "100% Local Server Connected";
    }
}

export function initAppVersionAndUpdateSystem() {
    const btnVersionPill = document.getElementById("btnVersionPill");
    const updateModal = document.getElementById("updateVersionModal");
    const closeUpdateModalBtn = document.getElementById("closeUpdateModalBtn");
    const btnDismissUpdateModal = document.getElementById("btnDismissUpdateModal");
    const btnCheckUpdateNow = document.getElementById("btnCheckUpdateNow");
    const btnPerformUpdate = document.getElementById("btnPerformUpdate");

    const appVersionName = document.getElementById("appVersionName");
    const versionBadgeNotify = document.getElementById("versionBadgeNotify");
    const modalCurrentVer = document.getElementById("modalCurrentVer");
    const modalUpdateStatus = document.getElementById("modalUpdateStatus");
    const modalGitCommit = document.getElementById("modalGitCommit");
    const updateChangelogBox = document.getElementById("updateChangelogBox");
    const updateConsoleBox = document.getElementById("updateConsoleBox");
    const updateConsoleLog = document.getElementById("updateConsoleLog");

    const openModal = () => {
        if (updateModal) updateModal.style.display = "flex";
        checkUpdate(false);
    };

    const closeModal = () => {
        if (updateModal) updateModal.style.display = "none";
    };

    btnVersionPill?.addEventListener("click", openModal);
    closeUpdateModalBtn?.addEventListener("click", closeModal);
    btnDismissUpdateModal?.addEventListener("click", closeModal);
    updateModal?.addEventListener("click", (e) => {
        if (e.target === updateModal) closeModal();
    });

    async function checkUpdate(isManual = false) {
        if (modalUpdateStatus) modalUpdateStatus.textContent = "Đang kiểm tra kết nối máy chủ...";
        if (btnCheckUpdateNow) btnCheckUpdateNow.disabled = true;

        try {
            const res = await fetch("/api/check-update");
            const data = await res.json();

            const curVer = data.current_version || "test 1.0.000";
            if (appVersionName) appVersionName.textContent = curVer;
            if (modalCurrentVer) modalCurrentVer.textContent = curVer;
            if (modalGitCommit && data.commit) modalGitCommit.textContent = `${data.commit} (main)`;

            if (data.has_update) {
                btnVersionPill?.classList.add("has-update");
                if (versionBadgeNotify) versionBadgeNotify.style.display = "inline-block";
                if (modalUpdateStatus) {
                    modalUpdateStatus.textContent = `🔔 Có bản cập nhật mới (${data.behind_commits || 1} thay đổi)`;
                    modalUpdateStatus.style.color = "#F59E0B";
                }
                if (btnPerformUpdate) {
                    btnPerformUpdate.style.display = "inline-flex";
                    btnPerformUpdate.innerHTML = `🚀 Cập Nhật Ngay (${data.behind_commits || 1} bản mới)`;
                }

                if (data.changelog && data.changelog.length && updateChangelogBox) {
                    updateChangelogBox.innerHTML = data.changelog.map(c => `<div class="changelog-item">🔹 ${c}</div>`).join("");
                }

                if (!isManual) {
                    showToastNotification(`🔔 Đã có bản cập nhật mới! (Bản hiện tại: ${curVer}). Bấm phiên bản để cập nhật.`);
                }
            } else {
                btnVersionPill?.classList.remove("has-update");
                if (versionBadgeNotify) versionBadgeNotify.style.display = "none";
                if (modalUpdateStatus) {
                    modalUpdateStatus.textContent = data.is_offline ? `Chế độ độc lập (${curVer})` : `✅ Bạn đang dùng phiên bản mới nhất (${curVer})`;
                    modalUpdateStatus.style.color = "#10B981";
                }
                if (btnPerformUpdate) {
                    btnPerformUpdate.innerHTML = `✅ Hệ Thống Đã Mới Nhất`;
                }
                if (isManual) {
                    showToastNotification(`✅ Bạn đang sử dụng bản mới nhất (${curVer})!`);
                }
            }
        } catch (e) {
            if (modalUpdateStatus) modalUpdateStatus.textContent = "Sẵn sàng hoạt động cục bộ (test 1.0.000)";
        } finally {
            if (btnCheckUpdateNow) btnCheckUpdateNow.disabled = false;
        }
    }

    btnCheckUpdateNow?.addEventListener("click", () => checkUpdate(true));

    btnPerformUpdate?.addEventListener("click", async () => {
        if (!confirm("Bạn có chắc chắn muốn tiến hành cập nhật hệ thống ngay bây giờ không?")) return;

        btnPerformUpdate.disabled = true;
        btnPerformUpdate.innerHTML = `<span class="spinner-small" style="margin-right: 6px;">⏳</span> Đang cập nhật...`;
        if (updateConsoleBox) updateConsoleBox.style.display = "block";
        if (updateConsoleLog) updateConsoleLog.textContent = "[*] Đang kéo bản cập nhật mới nhất từ Git...\n";

        try {
            const res = await fetch("/api/perform-update", { method: "POST" });
            const data = await res.json();

            if (updateConsoleLog) updateConsoleLog.textContent += (data.output || "") + "\n";

            if (data.success) {
                if (updateConsoleLog) updateConsoleLog.textContent += "\n[✔] CẬP NHẬT THÀNH CÔNG! Đang khởi động lại trang...";
                showToastNotification("🎉 Đã cập nhật thành công! Đang làm mới hệ thống...");
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                if (updateConsoleLog) updateConsoleLog.textContent += `\n[x] Lỗi: ${data.message || "Không thể hoàn thành cập nhật"}`;
                btnPerformUpdate.disabled = false;
                btnPerformUpdate.innerHTML = `🚀 Thử Cập Nhật Lại`;
                showToastNotification("❌ Cập nhật gặp lỗi! Xem chi tiết trong cửa sổ thông báo.");
            }
        } catch (err) {
            if (updateConsoleLog) updateConsoleLog.textContent += `\n[x] Lỗi mạng: ${err.message}`;
            btnPerformUpdate.disabled = false;
            btnPerformUpdate.innerHTML = `🚀 Thử Cập Nhật Lại`;
        }
    });

    // Auto-check version & update after 2s on startup
    setTimeout(() => checkUpdate(false), 2000);
}
