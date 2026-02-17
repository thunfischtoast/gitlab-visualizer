import { loadFromStorage, saveToStorage, removeFromStorage } from "$lib/utils/storage.js";

const STORAGE_KEY = "gitlab-group-selection";

const stored = loadFromStorage<number[] | null>(STORAGE_KEY, null);

let selectedIds = $state<number[]>(stored ?? []);

const hasSelection = $derived(selectedIds.length > 0);

function setSelection(ids: number[]) {
  selectedIds = ids;
  saveToStorage(STORAGE_KEY, ids);
}

function clear() {
  selectedIds = [];
  removeFromStorage(STORAGE_KEY);
}

export const groupSelectionStore = {
  get selectedIds() { return selectedIds; },
  get hasSelection() { return hasSelection; },
  setSelection,
  clear,
};
