/**
 * AI Karaoke Studio Pro — Navigation & Guided Journey Stepper
 */

import { executeStudioVideoExport } from './export.js';
import { loadProjectsList } from './library.js';

export function setupNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");

    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-tab");
            switchTab(targetId);
        });
    });

    // Guided 2-Step Journey Bar for Beginners
    document.querySelectorAll(".stepper-step").forEach(step => {
        step.addEventListener("click", () => {
            const targetTab = step.getAttribute("data-tab");
            if (targetTab) switchTab(targetTab);
        });
    });

    document.getElementById("btnGoToEditor")?.addEventListener("click", () => switchTab("editorTab"));
    document.getElementById("btnGoToExport")?.addEventListener("click", () => {
        switchTab("playerTab");
        executeStudioVideoExport();
    });
    document.getElementById("btnRedirectToStudioExport")?.addEventListener("click", () => {
        switchTab("playerTab");
        executeStudioVideoExport();
    });
}

export function scrollToStudioExport() {
    executeStudioVideoExport();
}

export function syncGuidedStepper(activeTab) {
    const step1 = document.getElementById("step1Indicator");
    const step2 = document.getElementById("step2Indicator");
    if (!step1 || !step2) return;

    step1.classList.remove("active");
    step2.classList.remove("active");

    if (activeTab === "createTab") {
        step1.classList.add("active");
    } else {
        step2.classList.add("active");
    }
}

export function switchTab(targetId) {
    // If anything requests exportTab, redirect smoothly to playerTab
    if (targetId === "exportTab") {
        targetId = "playerTab";
    }

    const navTabs = document.querySelectorAll(".nav-tab");
    const tabPanes = document.querySelectorAll(".tab-pane");

    navTabs.forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-tab") === targetId);
    });
    tabPanes.forEach(p => {
        p.classList.toggle("active", p.id === targetId);
    });

    // Sync Guided Stepper Bar (1-2)
    syncGuidedStepper(targetId);

    if (targetId === "libraryTab") {
        loadProjectsList();
    }
}
