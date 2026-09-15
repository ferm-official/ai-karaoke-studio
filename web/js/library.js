/**
 * AI Karaoke Studio Pro — Library & Project Management Module
 * Handles projects list, loading projects into studio, deleting projects, opening folders, and cache clearing.
 */

import { state, beatAudio, vocalAudio, dom } from "./state.js";
import { formatTime, showToastNotification } from "./utils.js";
import { switchTab } from "./navigation.js";
import { loadProjectData } from "./controls.js";
import { openStudioExportResultModal, executeStudioVideoExport } from "./export.js";

export async function loadProjectsList() {
    if (!dom.projectsGrid) return;
    try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = await res.json();
        state.projectsList = data.projects || [];
        renderProjectsGrid(state.projectsList);
    } catch (e) {
        console.error("Failed to load projects list:", e);
    }
}

export function renderProjectsGrid(projects) {
    if (!dom.projectsGrid) return;

    if (!projects || projects.length === 0) {
        dom.projectsGrid.innerHTML = `
            <div class="library-empty-state">
                <h3 class="library-empty-title">Chưa có bài hát nào trong thư viện</h3>
                <p class="library-empty-desc">Hãy tải lên một file bài hát hoặc dán liên kết để AI tách Beat và tạo video Karaoke tức thì.</p>
                <button class="btn-primary" onclick="switchTab('createTab')">Tạo Bài Mới Ngay</button>
            </div>
        `;
        return;
    }

    dom.projectsGrid.innerHTML = projects.map(p => {
        const status = p.status || "ready";
        const statusLabel = status === "ready" ? "Sẵn sàng" : (status === "processing" ? "Đang xử lý" : "Lỗi");
        const statusClass = status === "ready" ? "ready" : (status === "processing" ? "processing" : "error");
        const formattedDate = p.created_at ? new Date(p.created_at * 1000).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Vừa tạo";
        const safeTitle = (p.title || "Bài hát").replace(/"/g, "&quot;");
        const safeId = p.id;

        return `
            <div class="project-card glass-card" id="projCard_${safeId}">
                <div class="project-card-header">
                    <span class="project-status-badge ${statusClass}">${statusLabel}</span>
                    <span class="project-date">${formattedDate}</span>
                </div>
                <h3 class="project-title" title="${safeTitle}">${safeTitle}</h3>
                <div class="project-meta-row">
                    <span class="project-meta-pill">${formatTime(p.duration || 0)}</span>
                    <span class="project-meta-pill">Ngôn ngữ: ${p.language || 'vi'}</span>
                    <span class="project-meta-pill">${p.lyrics_source === 'hybrid_acoustic_aligned' ? 'Lời Chuẩn + AI' : (p.lyrics_source === 'imported_file' ? 'File Lời Ngoài' : 'Whisper AI')}</span>
                </div>
                <div class="project-card-actions">
                    <button class="btn-sm btn-primary" onclick="openProjectInStudio('${safeId}')" title="Mở phòng thu để hát và chỉnh nhạc">
                        Hát / Thu
                    </button>
                    <button class="btn-sm btn-secondary" onclick="openProjectInExport('${safeId}')" title="Xuất video MP4">
                        Xuất Video
                    </button>
                    <button class="btn-sm btn-secondary" onclick="openProjectFolder('${safeId}')" title="Mở thư mục chứa file trên máy">
                        Thư Mục
                    </button>
                    <button class="btn-sm btn-danger" onclick="confirmDeleteProject('${safeId}', '${encodeURIComponent(p.title || "Bài hát")}')" title="Xóa bài hát này khỏi máy">
                        Xóa
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

export async function loadExistingProject(projectId, targetTab = "playerTab") {
    try {
        const res = await fetch(`/api/status/${projectId}`);
        const data = await res.json();
        if (data.status === "ready" && data.data) {
            loadProjectData(data.data);
            switchTab(targetTab || "playerTab");
        } else {
            alert("Bài hát này chưa sẵn sàng hoặc bị lỗi.");
        }
    } catch (e) {
        alert("Không thể tải bài hát này: " + e.message);
    }
}

export async function openProjectInStudio(projectId) {
    try {
        const res = await fetch(`/api/status/${projectId}`);
        if (!res.ok) throw new Error("Không thể tải thông tin bài hát");
        const data = await res.json();
        if (data.data) {
            loadProjectData(data.data);
            switchTab("playerTab");
        } else {
            alert("Bài hát này chưa sẵn sàng hoặc bị lỗi.");
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}

export async function openProjectInExport(projectId) {
    try {
        const res = await fetch(`/api/status/${projectId}`);
        if (!res.ok) throw new Error("Không thể tải thông tin bài hát");
        const data = await res.json();
        if (data.data) {
            loadProjectData(data.data);
            switchTab("playerTab");
            if (data.data.video_url) {
                openStudioExportResultModal();
            } else {
                executeStudioVideoExport();
            }
        } else {
            alert("Bài hát này chưa sẵn sàng hoặc bị lỗi.");
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}

export async function openProjectFolder(projectId) {
    try {
        await fetch(`/api/open-folder/${projectId}`, { method: "POST" });
    } catch (err) {
        console.error("Open folder failed:", err);
        showToastNotification("Không thể mở thư mục trên máy tính");
    }
}

export async function confirmDeleteProject(projectId, encodedTitle) {
    const title = decodeURIComponent(encodedTitle);
    const confirmed = confirm(`BẠN CÓ CHẮC MUỐN XÓA BÀI HÁT NÀY?\n\n"${title}"\n\nToàn bộ file beat, vocal tách rời và phụ đề liên quan sẽ được xóa vĩnh viễn khỏi máy tính.`);
    if (!confirmed) return;

    // Giải phóng toàn bộ file handle / media stream trong trình duyệt ngay lập tức
    const isCurrentActive = state.currentProject && (state.currentProject.id === projectId);
    const isBeatLoaded = beatAudio.src && beatAudio.src.includes(projectId);
    const isVocalLoaded = vocalAudio.src && vocalAudio.src.includes(projectId);
    const isVideoLoaded = dom.renderedVideoPlayer && dom.renderedVideoPlayer.src && dom.renderedVideoPlayer.src.includes(projectId);

    if (isCurrentActive || isBeatLoaded || isVocalLoaded || isVideoLoaded) {
        beatAudio.pause();
        beatAudio.removeAttribute("src");
        beatAudio.load();

        vocalAudio.pause();
        vocalAudio.removeAttribute("src");
        vocalAudio.load();

        if (dom.renderedVideoPlayer) {
            dom.renderedVideoPlayer.pause();
            dom.renderedVideoPlayer.removeAttribute("src");
            dom.renderedVideoPlayer.load();
            dom.renderedVideoPlayer.style.display = "none";
            if (dom.emptyVideoPlaceholder) dom.emptyVideoPlaceholder.style.display = "flex";
        }

        if (isCurrentActive) {
            state.currentProject = null;
            state.isPlaying = false;
            const playPauseBtn = document.getElementById("playPauseBtn");
            if (playPauseBtn) playPauseBtn.textContent = "Phát";
            const songTitle = document.getElementById("songTitle");
            if (songTitle) songTitle.textContent = "Chưa chọn bài hát";
        }

        // Chờ 150ms để trình duyệt đóng socket và Windows giải phóng file descriptor
        await new Promise(resolve => setTimeout(resolve, 150));
    }

    try {
        const res = await fetch(`/api/project/${projectId}`, {
            method: "DELETE"
        });
        const data = await res.json();

        if (res.ok && data.status === "success") {
            const card = document.getElementById(`projCard_${projectId}`);
            if (card) {
                card.style.transition = "all 0.3s ease";
                card.style.opacity = "0";
                card.style.transform = "scale(0.9)";
            }

            setTimeout(() => {
                loadProjectsList();
            }, 300);
            showToastNotification(`Đã xóa bài hát "${title}" thành công!`);
        } else {
            alert("Lỗi khi xóa bài hát: " + (data.detail || data.message || "Unknown error"));
        }
    } catch (e) {
        alert("Lỗi kết nối máy chủ: " + e.message);
    }
}

export function setupLibraryHandlers() {
    dom.btnRefreshLibrary?.addEventListener("click", () => {
        dom.btnRefreshLibrary.textContent = "Đang tải...";
        loadProjectsList().finally(() => {
            setTimeout(() => {
                dom.btnRefreshLibrary.textContent = "Làm Mới";
            }, 400);
        });
    });

    const btnClearCache = document.getElementById("btnClearCache");
    btnClearCache?.addEventListener("click", async () => {
        if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ đệm (cache beat & lời) để giải phóng ổ cứng không?")) {
            return;
        }
        const originalText = btnClearCache.textContent;
        btnClearCache.textContent = "Đang xóa...";
        btnClearCache.disabled = true;
        try {
            const res = await fetch("/api/clear-cache", { method: "POST" });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                try { sessionStorage.clear(); } catch (e) {}
                alert(data.message || "Đã xóa sạch cache thành công!");
            } else {
                alert("Lỗi khi xóa cache: " + (data.detail || data.message || "Unknown error"));
            }
        } catch (e) {
            alert("Lỗi kết nối máy chủ: " + e.message);
        } finally {
            btnClearCache.textContent = originalText;
            btnClearCache.disabled = false;
        }
    });
}
