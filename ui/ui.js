import { invoke } from "@tauri-apps/api/core";
import { dom } from "./dom.js";
import { addRepo, createRepo, removeRepo, setActiveRepo } from "./repo_states.js";

export function initUI() {
  const tabs = document.getElementById("editor-tabs");
  const addButton = document.getElementById("new-repo-tab");
  if (!tabs || !addButton) return;

  hydrateInitialTab(tabs);

  tabs.addEventListener("click", event => {
    const closeButton = event.target.closest(".tab-close");
    if (closeButton) {
      const tab = closeButton.closest(".editor-tab");
      if (tab) closeTab(tab);
      return;
    }

    const tab = event.target.closest(".editor-tab");
    if (tab) {
      activateTab(tab);
    }
  });

  addButton.addEventListener("click", () => {
    const repo = createRepo("", "");
    addRepo(repo);

    const newTab = buildTab(repo);
    if (addButton.parentElement === tabs) {
      tabs.insertBefore(newTab, addButton);
    } else {
      tabs.appendChild(newTab);
    }

    activateTab(newTab);
    resetConsoleToHome();
  });
}

function hydrateInitialTab(tabs) {
  const initialTab = document.getElementById("active_repo");
  if (!initialTab) return;

  const initialName = initialTab.textContent.trim() || "main.js";
  const repo = createRepo(initialName, "");
  addRepo(repo);
  const hydratedTab = buildTab(repo, initialTab);

  if (!hydratedTab.classList.contains("editor-tab")) {
    hydratedTab.classList.add("editor-tab");
  }

  activateTab(hydratedTab);
}

function buildTab(repo, existing) {
  const tab = existing || document.createElement("div");
  tab.classList.add("editor-tab");
  tab.__repo = repo;
  tab.dataset.repoPath = repo.filepath || "";
  tab.textContent = "";

  const label = document.createElement("span");
  label.className = "editor-tab-label";
  label.textContent = repo.name;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "tab-close";
  closeButton.setAttribute("aria-label", `Close ${repo.name}`);

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.textContent = "close";
  closeButton.appendChild(icon);

  tab.append(label, closeButton);
  return tab;
}

function activateTab(tab) {
  const tabs = document.querySelectorAll("#editor-tabs .editor-tab");
  tabs.forEach(t => t.classList.remove("active"));

  tab.classList.add("active");
  dom.active_repo = tab;
  setActiveRepo(tab.__repo || null);
}

function closeTab(tab) {
  const repo = tab.__repo || null;
  const wasActive = tab.classList.contains("active");
  const nextTab = wasActive ? findNeighborTab(tab) : null;

  tab.remove();
  if (repo) removeRepo(repo);

  if (wasActive) {
    if (nextTab) {
      activateTab(nextTab);
    } else {
      dom.active_repo = null;
      setActiveRepo(null);
    }
  }
}

function findNeighborTab(tab) {
  let node = tab.nextElementSibling;
  while (node && !node.classList.contains("editor-tab")) {
    node = node.nextElementSibling;
  }
  if (node) return node;

  node = tab.previousElementSibling;
  while (node && !node.classList.contains("editor-tab")) {
    node = node.previousElementSibling;
  }
  return node || null;
}

function resetConsoleToHome() {
  invoke("write_terminal", { data: "cd ~\r\n" }).catch(() => {});
}
